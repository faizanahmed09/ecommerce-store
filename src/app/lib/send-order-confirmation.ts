"use client";

/*
 * ---------------------------------------------------------
 * ORDER CONFIRMATION - CLIENT TRIGGER
 * ---------------------------------------------------------
 *
 * Asks the route handler to send the confirmation email.
 *
 * Nothing here can fail loudly. The order is already in the
 * database by the time this runs, and cash on delivery means
 * nothing else is pending - so a mail server that is slow, down
 * or unconfigured must not reach the shopper as an error about
 * an order that went through perfectly well.
 *
 * The route is idempotent (claim_order_confirmation takes the
 * order atomically), so calling it twice is harmless.
 */

export async function sendOrderConfirmation(orderId: string): Promise<void> {
  try {
    await fetch("/api/orders/confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
      /*
       * The success page navigation happens straight after this
       * is fired. keepalive lets the request outlive the unload
       * rather than being cancelled halfway.
       */
      keepalive: true,
    });
  } catch (error: unknown) {
    console.error("Could not send the order confirmation email:", error);
  }
}
