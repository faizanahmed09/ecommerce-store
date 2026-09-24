import { formatCurrency } from "@/src/app/lib/utils";

/*
 * ---------------------------------------------------------
 * ORDER PRICING
 * ---------------------------------------------------------
 *
 * The storefront's money rules, in one place. The checkout
 * summary and the total_amount written to the orders table
 * both read from here, so the figure a shopper agrees to is
 * the figure that reaches the database and the admin screen.
 */

/** Delivery charge on an order below the free-shipping threshold. */
export const SHIPPING_FEE = 300;

/**
 * Basket subtotal at or above which delivery is free.
 *
 * The homepage, the mega menu and every product page promised
 * this, and the calculation charged the flat fee anyway - a
 * shopper with a Rs. 8,000 basket was told "free shipping"
 * four times and then billed for it at checkout.
 *
 * Every one of those places now reads this constant and
 * FREE_SHIPPING_COPY below, so the promise and the arithmetic
 * cannot drift apart again.
 */
export const FREE_SHIPPING_THRESHOLD = 5000;

/*
 * Written once, so the four places that say it always agree -
 * and formatted through formatCurrency, so the threshold reads
 * the same as every other figure on the site.
 */
export const FREE_SHIPPING_LABEL = formatCurrency(FREE_SHIPPING_THRESHOLD);

export const FREE_SHIPPING_COPY = `Free delivery on orders over ${FREE_SHIPPING_LABEL}`;

export interface OrderTotals {
  subtotal: number;
  /* What a discount code took off, or 0. */
  discount: number;
  shipping: number;
  total: number;
  /* True when the fee was waived, so the summary can say so. */
  freeShipping: boolean;
  /* What is still needed to qualify, or 0 once it is met. */
  remainingForFreeShipping: number;
}

/* total_amount is DECIMAL(10, 2), so nothing finer than a paisa survives. */
const toMoney = (amount: number): number => Math.round(amount * 100) / 100;

export function calculateOrderTotals(subtotal: number, discount = 0): OrderTotals {
  const roundedSubtotal = toMoney(subtotal);

  /* Never more than the basket, never negative. */
  const appliedDiscount = toMoney(Math.min(Math.max(discount, 0), roundedSubtotal));

  /*
   * The threshold is judged on what the shopper pays for goods,
   * after the discount. Judging it on the pre-discount subtotal
   * would let a code take a basket below the threshold while
   * still handing out the free delivery it no longer earns.
   */
  const discountedSubtotal = toMoney(roundedSubtotal - appliedDiscount);

  /*
   * An empty basket is not a free delivery - it is no delivery.
   * Without this a cart of nothing would report "free shipping"
   * while it waited for its first line.
   */
  const qualifies = discountedSubtotal > 0 && discountedSubtotal >= FREE_SHIPPING_THRESHOLD;

  const shipping = qualifies ? 0 : SHIPPING_FEE;

  return {
    subtotal: roundedSubtotal,
    discount: appliedDiscount,
    shipping,
    total: toMoney(discountedSubtotal + shipping),
    freeShipping: qualifies,
    remainingForFreeShipping: qualifies
      ? 0
      : toMoney(Math.max(0, FREE_SHIPPING_THRESHOLD - discountedSubtotal)),
  };
}
