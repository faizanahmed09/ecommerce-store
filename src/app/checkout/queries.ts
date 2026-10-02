/*
 * ---------------------------------------------------------
 * CHECKOUT DATA ACCESS
 * ---------------------------------------------------------
 *
 * Turns a cart into rows in `orders` and `order_items` — the
 * same two tables the admin Orders screen reads back. Throws
 * on failure, returns the new order id. No React here.
 */

import { createClient, createPublicClient } from "@/src/app/lib/supabase/client";
import type { CartItem } from "@/src/app/components/cart-provider";
import type { OrderTotals } from "@/src/app/lib/order-totals";

/** The delivery details collected by the checkout form. */
export interface CheckoutCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes: string;
}

/*
 * The only way to pay. This value is what lands in
 * orders.payment_method, and it deliberately matches the "cod"
 * option in the admin's PAYMENT_METHODS - checkout used to
 * write "cash-on-delivery", which that dropdown did not
 * recognise, so every placed order showed a blank method.
 */
export const PAYMENT_METHOD = "cod";

export interface PlaceOrderInput {
  /** The signed-in shopper, or null for a guest order. */
  userId: string | null;
  customer: CheckoutCustomer;
  items: CartItem[];
  paymentMethod: string;
  totals: OrderTotals;
  /*
   * The code the cart applied, or null. place_order re-earns
   * the discount from it rather than accepting the figure in
   * `totals` - which is why the code travels rather than the
   * amount it was worth.
   */
  couponCode: string | null;
}

/*
 * shipping_address is a single TEXT column, and the admin drawer prints it
 * verbatim — so the parts are joined into an address block rather than a
 * one-line string.
 */
export function formatShippingAddress(customer: CheckoutCustomer): string {
  const name = `${customer.firstName} ${customer.lastName}`.trim();

  const region = [customer.city, customer.state, customer.postalCode]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  return [name, customer.address.trim(), region, customer.country.trim()]
    .filter(Boolean)
    .join("\n");
}

/*
 * A guest leaves no users row, so their contact details would otherwise be lost
 * with the form state. They ride along in `notes`, which is the only free-text
 * column on the order.
 */
function buildNotes(customer: CheckoutCustomer, userId: string | null): string | null {
  const lines: string[] = [];

  if (!userId) {
    lines.push(`Guest contact: ${customer.email} / ${customer.phone}`);
  }

  if (customer.notes.trim()) {
    lines.push(customer.notes.trim());
  }

  return lines.length > 0 ? lines.join("\n\n") : null;
}

/** One cart line the shop cannot fulfil, and what it can offer instead. */
export interface StockShortfall {
  name: string;
  requested: number;
  available: number;
}

/*
 * Re-reads stock for everything in the cart.
 *
 * The cart's own ceiling is a snapshot taken when the item was added - it can
 * be hours old, it survives in localStorage across sessions, and it says
 * nothing about what other shoppers have bought since. This is the reading
 * that decides whether the order can be placed.
 *
 * A line configured with variants is limited by the tightest of them, matching
 * how the product page computes availability.
 */
export async function checkStock(items: CartItem[]): Promise<StockShortfall[]> {
  if (items.length === 0) {
    return [];
  }

  const supabase = createClient();

  const productIds = [...new Set(items.map((item) => item.productId))];
  const variantIds = [...new Set(items.flatMap((item) => item.variantIds))];

  const { data: products, error: productError } = await createPublicClient()
    .from("products")
    .select("id, stock_quantity")
    .in("id", productIds);

  if (productError) {
    throw productError;
  }

  const productStock = new Map(
    (products ?? []).map((product) => [product.id, Number(product.stock_quantity)])
  );

  const variantStock = new Map<string, number>();

  if (variantIds.length > 0) {
    const { data: variants, error: variantError } = await supabase
      .from("product_variants")
      .select("id, stock_quantity")
      .in("id", variantIds);

    if (variantError) {
      throw variantError;
    }

    for (const variant of variants ?? []) {
      variantStock.set(variant.id, Number(variant.stock_quantity));
    }
  }

  const shortfalls: StockShortfall[] = [];

  for (const item of items) {
    /*
     * A product or variant that has been deleted since the cart was filled
     * reads as unavailable rather than unlimited.
     */
    const available =
      !productStock.has(item.productId)
        ? 0
        : item.variantIds.length > 0
        ? Math.min(...item.variantIds.map((id) => variantStock.get(id) ?? 0))
        : (productStock.get(item.productId) ?? 0);

    if (item.quantity > available) {
      shortfalls.push({
        name: item.name,
        requested: item.quantity,
        available,
      });
    }
  }

  return shortfalls;
}

/*
 * Thrown instead of a bare Error so the checkout page can tell "we cannot
 * fulfil this" apart from a network or policy failure, and say so precisely.
 */
export class StockError extends Error {
  /* Empty when the shortfall was detected by the database rather than the
   * pre-flight check - the message is then Postgres's, naming the product. */
  readonly shortfalls: StockShortfall[];

  constructor(shortfalls: StockShortfall[], message?: string) {
    super(message ?? describeShortfalls(shortfalls));
    this.name = "StockError";
    this.shortfalls = shortfalls;
  }
}

/*
 * The order was refused for a reason that is not stock: the
 * total no longer matches what the shop computes, or the
 * discount code stopped being valid between the cart and the
 * Place Order button. place_order raises these with SQLSTATE
 * LM001 so they can be told apart from its stock messages.
 */
export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

/* Turns shortfalls into one line a shopper can act on. */
export function describeShortfalls(shortfalls: StockShortfall[]): string {
  return shortfalls
    .map(({ name, requested, available }) =>
      available === 0
        ? `${name} is out of stock`
        : `${name}: only ${available} left, ${requested} requested`
    )
    .join(". ");
}

export async function placeOrder({
  userId,
  customer,
  items,
  paymentMethod,
  totals,
  couponCode,
}: PlaceOrderInput): Promise<string> {
  if (items.length === 0) {
    throw new Error("Cannot place an order with an empty cart.");
  }

  /*
   * Checked here rather than only in the form, so no path to placeOrder can
   * write an order the shop cannot fulfil.
   */
  const shortfalls = await checkStock(items);

  if (shortfalls.length > 0) {
    throw new StockError(shortfalls);
  }

  const supabase = createClient();

  /*
   * One RPC, one transaction (place-order.sql). The browser has no insert
   * permission on orders or order_items any more - the SECURITY DEFINER
   * function is the only writer, which is what makes the header, its lines
   * and the stock decrements all-or-nothing.
   *
   * It also settles the two problems the old three-write version had: a
   * failed line insert can no longer strand an order header, and the stock
   * decrement is conditional inside the same transaction, so two shoppers
   * racing for the last unit cannot both succeed.
   */
  const { data: orderId, error } = await supabase.rpc("place_order", {
    p_user_id: userId,
    p_shipping_address: formatShippingAddress(customer),
    p_payment_method: paymentMethod,
    p_notes: buildNotes(customer, userId),
    /*
     * Sent as a cross-check, not as the price. place_order prices every line
     * from products and product_variants, re-earns the discount, and adds
     * delivery itself; this figure only decides whether what the shopper
     * agreed to still matches. If it does not, the order is refused rather
     * than written at a total nobody saw.
     */
    p_total_amount: totals.total,
    p_items: items.map((item) => ({
      product_id: item.productId,
      /*
       * order_items holds one variant per line while a cart line can carry
       * several (size *and* colour). All of them are decremented; the first
       * is what the line records, and the full configuration stays readable
       * in the product name.
       *
       * The variants are also what the server prices the line with, since
       * each one carries its own price_adjustment.
       */
      variant_ids: item.variantIds,
      quantity: item.quantity,
      /* No unit_price: the browser no longer has a say in what this costs. */
    })),
    p_coupon_code: couponCode,
    /* Where the confirmation goes. A guest leaves no users row. */
    p_contact_email: customer.email.trim() || null,
    /*
     * Where the courier calls. Collected by the form since the
     * beginning and, until now, kept only for guests and only
     * inside the notes column.
     */
    p_contact_phone: customer.phone.trim() || null,
  });

  if (error) {
    /*
     * LM001 is place_order refusing the money: the recomputed total does not
     * match, or the discount code no longer stands. Its message is already
     * addressed to the shopper.
     */
    if (error.code === "LM001") {
      throw new CheckoutError(error.message);
    }

    /*
     * P0001 is anything else raised inside the function, which leaves its
     * stock messages - the only other thing in there that raises.
     */
    if (error.code === "P0001") {
      throw new StockError([], error.message);
    }

    throw error;
  }

  if (!orderId) {
    throw new Error("The order was placed but no order id came back.");
  }

  return orderId;
}
