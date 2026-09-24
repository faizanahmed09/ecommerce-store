/*
 * ---------------------------------------------------------
 * "YOUR ORDER IS ON ITS WAY"
 * ---------------------------------------------------------
 *
 * Sent once, when an admin books a parcel with a courier.
 *
 * The link goes to our own /track-order rather than straight to
 * the courier. That page asks for the email address as well as
 * the reference, which is what actually proves the order is
 * yours - an eight-character reference on its own is guessable,
 * and a link that skips the check would hand anyone who saw it
 * a customer's order status and address.
 *
 * Same plain-table HTML as the order confirmation: mail clients
 * strip <style> blocks and ignore most of flexbox.
 */

import { formatCurrency } from "@/src/app/lib/utils";
import { escapeHtml } from "@/src/app/lib/email-html";

export interface ShipmentEmailInput {
  orderReference: string;
  courierName: string;
  trackingNumber: string;
  codAmount: number;
  paymentMethod: string | null;
  shippingAddress: string;
  storeName: string;
  storeUrl: string;
}

/* /track-order?ref=LM-… - the page prefills from it. */
const trackUrl = (input: ShipmentEmailInput): string =>
  `${input.storeUrl}/track-order?ref=${encodeURIComponent(input.orderReference)}`;

export function shipmentSubject(input: ShipmentEmailInput): string {
  return `${input.storeName} - order ${input.orderReference} is on its way`;
}

export function shipmentText(input: ShipmentEmailInput): string {
  return [
    `Your order is on its way.`,
    "",
    `Order ${input.orderReference}`,
    `Courier: ${input.courierName}`,
    `Tracking number: ${input.trackingNumber}`,
    "",
    input.paymentMethod === "cod"
      ? `Please have ${formatCurrency(input.codAmount)} ready for the rider.`
      : "",
    "",
    "Delivering to",
    input.shippingAddress,
    "",
    `Track it: ${trackUrl(input)}`,
    "(You will be asked for the email address you ordered with.)",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function shipmentHtml(input: ShipmentEmailInput): string {
  const row = (label: string, value: string) => `
        <tr>
          <td style="padding:6px 0;color:#555;">${label}</td>
          <td style="padding:6px 0;text-align:right;color:#111;font-weight:600;white-space:nowrap;">
            ${value}
          </td>
        </tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 6px;font-size:20px;color:#111;">Your order is on its way</h1>
          <p style="margin:0;color:#666;font-size:14px;">
            Order <strong style="color:#111;">${escapeHtml(input.orderReference)}</strong>
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            ${row("Courier", escapeHtml(input.courierName))}
            ${row("Tracking number", escapeHtml(input.trackingNumber))}
            ${
              input.paymentMethod === "cod"
                ? row("Please have ready", formatCurrency(input.codAmount))
                : ""
            }
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:22px 28px 0;">
          <a href="${escapeHtml(trackUrl(input))}"
             style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">
            Track your order
          </a>

          <p style="margin:10px 0 0;font-size:12px;color:#888;">
            You will be asked for the email address you ordered with.
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:20px 28px 0;font-size:14px;color:#555;">
          <strong style="color:#111;">Delivering to</strong><br />
          ${escapeHtml(input.shippingAddress).replace(/\n/g, "<br />")}
        </td>
      </tr>

      <tr>
        <td style="padding:24px 28px 28px;font-size:13px;color:#888;">
          Questions about this order? Reply to this email.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
