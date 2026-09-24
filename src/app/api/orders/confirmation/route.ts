/*
 * ---------------------------------------------------------
 * POST /api/orders/confirmation
 * ---------------------------------------------------------
 *
 * Sends the order confirmation email. The browser calls this
 * with nothing but the order id it was just handed.
 *
 * Two things are worth knowing about how it reads the order:
 *
 *  - It holds no service key. claim_order_confirmation is
 *    SECURITY DEFINER, so the anon key is enough, and the
 *    function returns exactly one order - the one whose id the
 *    caller already has - and nothing else in the table.
 *  - The claim is atomic. The UPDATE inside it only matches
 *    while confirmation_sent_at is null, so a double submit, a
 *    retry, or a refreshed success page cannot produce a second
 *    email. The second caller simply gets no rows.
 *
 * SMTP is Gmail with an app password. If the credentials are
 * absent the route says so and returns 200: a shop that has not
 * set up mail yet should still be able to take orders, and a
 * failed email must never make a placed order look failed.
 */

import { createClient } from "@supabase/supabase-js";
import { mailerConfigured, sendMail, STORE_NAME } from "@/src/app/lib/mailer";
import { NextResponse } from "next/server";

import type { Database } from "@/src/app/lib/supabase/database.types";
import {
  orderConfirmationHtml,
  orderConfirmationSubject,
  orderConfirmationText,
  type OrderEmailItem,
} from "@/src/app/lib/order-email";
import { toOrderNumber } from "@/src/app/lib/order-number";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let orderId: unknown;

  try {
    ({ orderId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  /*
   * Checked here so a malformed id is a 400 rather than a
   * Postgres cast error surfacing as a 500.
   */
  if (typeof orderId !== "string" || !UUID.test(orderId)) {
    return NextResponse.json({ error: "Expected an order id." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("Order confirmation: Supabase is not configured.");
    return NextResponse.json({ sent: false, reason: "not-configured" });
  }

  /*
   * Checked BEFORE the claim, not after.
   *
   * claim_order_confirmation is one-shot: it stamps
   * confirmation_sent_at and every later call gets nothing. So
   * claiming first and only then discovering there is no mailer
   * marked the order as confirmed while sending nothing, and no
   * retry could ever recover it. A deploy that lost these two
   * variables would have silently burned every order placed
   * while it was broken.
   *
   * Returning here leaves the order unclaimed and retryable.
   */
  if (!mailerConfigured()) {
    return NextResponse.json({ sent: false, reason: "mail-not-configured" });
  }

  const supabase = createClient<Database>(url, anonKey);

  const { data, error } = await supabase.rpc("claim_order_confirmation", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("Order confirmation: could not claim the order:", error);
    return NextResponse.json({ sent: false, reason: "claim-failed" }, { status: 500 });
  }

  const order = data?.[0];

  /*
   * Already emailed, no address on the order, or older than the
   * function's 24-hour window. None of these is an error the
   * shopper should ever see.
   */
  if (!order) {
    return NextResponse.json({ sent: false, reason: "already-sent-or-not-eligible" });
  }

  const body = {
    orderReference: toOrderNumber(order.order_id),
    contactEmail: order.contact_email,
    totalAmount: Number(order.total_amount),
    discountAmount: Number(order.discount_amount),
    couponCode: order.coupon_code,
    paymentMethod: order.payment_method,
    shippingAddress: order.shipping_addr,
    placedAt: order.placed_at,
    items: (order.items ?? []) as unknown as OrderEmailItem[],
    storeName: STORE_NAME,
    storeUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  };

  const result = await sendMail({
    to: order.contact_email,
    subject: orderConfirmationSubject(body),
    text: orderConfirmationText(body),
    html: orderConfirmationHtml(body),
  });

  if (!result.sent) {
    /*
     * The claim has already been taken, so this order will not
     * be retried automatically. That is the deliberate trade:
     * one missed confirmation is recoverable by hand, a loop of
     * duplicates emailed to a customer is not.
     */
    return NextResponse.json({ sent: false, reason: result.reason }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
