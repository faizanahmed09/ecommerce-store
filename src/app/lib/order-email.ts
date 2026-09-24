/*
 * ---------------------------------------------------------
 * ORDER CONFIRMATION EMAIL
 * ---------------------------------------------------------
 *
 * The body of the mail a shopper gets after checking out.
 * Server-only - it is imported by the route handler, never by
 * a component.
 *
 * Deliberately plain HTML with inline styles: mail clients
 * strip <style> blocks, ignore most of flexbox, and Gmail's
 * web client rewrites what it does keep. A table and inline
 * attributes are what survives all of them.
 */

import { formatCurrency } from "@/src/app/lib/utils";
import { escapeHtml } from "@/src/app/lib/email-html";

export interface OrderEmailItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderEmailInput {
  orderReference: string;
  contactEmail: string;
  totalAmount: number;
  discountAmount: number;
  couponCode: string | null;
  paymentMethod: string | null;
  shippingAddress: string;
  placedAt: string;
  items: OrderEmailItem[];
  storeName: string;
  storeUrl: string;
}

/*
 * The goods total, worked back from the figures the order was
 * written with. The order row stores the total actually
 * charged, so subtotal is not stored separately - it is
 * whatever the lines add up to.
 */
const sumLines = (items: OrderEmailItem[]): number =>
  items.reduce((running, item) => running + Number(item.total_price), 0);

export function orderConfirmationSubject(input: OrderEmailInput): string {
  return `${input.storeName} - order ${input.orderReference} confirmed`;
}

/* A text part is sent alongside the HTML, for clients that prefer it. */
export function orderConfirmationText(input: OrderEmailInput): string {
  const lines = input.items.map(
    (item) => `  ${item.quantity} x ${item.name} - ${formatCurrency(item.total_price)}`
  );

  const subtotal = sumLines(input.items);
  const shipping = input.totalAmount - (subtotal - input.discountAmount);

  return [
    `Thanks for your order, and welcome to ${input.storeName}.`,
    "",
    `Order ${input.orderReference}`,
    `Placed ${new Date(input.placedAt).toUTCString()}`,
    "",
    "Items",
    ...lines,
    "",
    `Subtotal: ${formatCurrency(subtotal)}`,
    ...(input.discountAmount > 0
      ? [
          `Discount${input.couponCode ? ` (${input.couponCode})` : ""}: -${formatCurrency(input.discountAmount)}`,
        ]
      : []),
    `Delivery: ${shipping > 0 ? formatCurrency(shipping) : "Free"}`,
    `Total: ${formatCurrency(input.totalAmount)}`,
    "",
    input.paymentMethod === "cod"
      ? "Payment: cash on delivery."
      : `Payment: ${input.paymentMethod ?? "-"}`,
    "",
    "Delivering to",
    input.shippingAddress,
    "",
    `Track your order: ${input.storeUrl}/track-order`,
  ].join("\n");
}

export function orderConfirmationHtml(input: OrderEmailInput): string {
  const subtotal = sumLines(input.items);
  const shipping = input.totalAmount - (subtotal - input.discountAmount);

  const rows = input.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#111;">
            ${escapeHtml(item.name)}
            <span style="color:#777;">&times; ${item.quantity}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;color:#111;white-space:nowrap;">
            ${formatCurrency(item.total_price)}
          </td>
        </tr>`
    )
    .join("");

  /* One row of the totals block, so the three below cannot drift apart. */
  const totalRow = (label: string, value: string, strong = false) => `
        <tr>
          <td style="padding:6px 0;color:${strong ? "#111" : "#555"};${strong ? "font-weight:700;" : ""}">
            ${label}
          </td>
          <td style="padding:6px 0;text-align:right;color:${strong ? "#111" : "#555"};${strong ? "font-weight:700;" : ""}white-space:nowrap;">
            ${value}
          </td>
        </tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 6px;font-size:20px;color:#111;">Thanks for your order</h1>
          <p style="margin:0;color:#666;font-size:14px;">
            Order <strong style="color:#111;">${escapeHtml(input.orderReference)}</strong> &middot;
            ${escapeHtml(new Date(input.placedAt).toDateString())}
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            ${rows}
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:12px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            ${totalRow("Subtotal", formatCurrency(subtotal))}
            ${
              input.discountAmount > 0
                ? totalRow(
                    `Discount${input.couponCode ? ` (${escapeHtml(input.couponCode)})` : ""}`,
                    `-${formatCurrency(input.discountAmount)}`
                  )
                : ""
            }
            ${totalRow("Delivery", shipping > 0 ? formatCurrency(shipping) : "Free")}
            ${totalRow("Total", formatCurrency(input.totalAmount), true)}
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:20px 28px 0;font-size:14px;color:#555;">
          ${
            input.paymentMethod === "cod"
              ? "Pay cash when your order is delivered."
              : `Payment: ${escapeHtml(input.paymentMethod ?? "-")}`
          }
        </td>
      </tr>

      <tr>
        <td style="padding:16px 28px 0;font-size:14px;color:#555;">
          <strong style="color:#111;">Delivering to</strong><br />
          ${escapeHtml(input.shippingAddress).replace(/\n/g, "<br />")}
        </td>
      </tr>

      <tr>
        <td style="padding:24px 28px 28px;font-size:13px;color:#888;">
          Questions about this order? Reply to this email.<br />
          <a href="${escapeHtml(input.storeUrl)}/track-order" style="color:#111;">Track your order</a>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
