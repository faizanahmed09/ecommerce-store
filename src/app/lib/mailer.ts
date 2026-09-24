/*
 * ---------------------------------------------------------
 * OUTGOING MAIL
 * ---------------------------------------------------------
 *
 * One place that knows how the shop sends email.
 *
 * There were two: the order confirmation route and the shipment
 * notifier each built their own transport, read the same two
 * env vars, and set the same from/bcc/replyTo. Two copies of
 * "who we are and how we connect" is two places to fix when the
 * mailbox moves, and a good chance only one of them gets fixed.
 *
 * Gmail over STARTTLS on 587. `service: "gmail"` would pick
 * those for us, but naming them keeps the failure legible when
 * a host blocks the port.
 */

import nodemailer from "nodemailer";

export const STORE_NAME = "Lamees";

/*
 * Whether mail can be sent at all.
 *
 * Separate from sending because one caller needs to know
 * BEFORE it changes any state: claim_order_confirmation is
 * one-shot, so discovering an unconfigured mailer after the
 * claim would mark an order as notified while sending nothing,
 * with no way to retry.
 */
export function mailerConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type MailResult =
  { sent: true } | { sent: false; reason: "mail-not-configured" | "send-failed" };

/*
 * Never throws.
 *
 * Every caller is doing something that already succeeded - an
 * order was placed, a parcel was booked - and an unreachable
 * mail server must not turn that into an error the user or the
 * admin will retry. The result says what happened; the caller
 * decides whether it matters.
 */
export async function sendMail(mail: OutgoingMail): Promise<MailResult> {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;

  if (!user || !password) {
    console.warn("Mailer: GMAIL_USER / GMAIL_APP_PASSWORD are not set.");
    return { sent: false, reason: "mail-not-configured" };
  }

  try {
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass: password },
    });

    await transport.sendMail({
      from: `${STORE_NAME} <${user}>`,
      to: mail.to,
      /*
       * The shop's own copy of whatever the customer was told,
       * so what lands in the shop inbox is exactly what they
       * received rather than a second, drifting template.
       */
      bcc: process.env.ORDER_NOTIFICATION_EMAIL || undefined,
      replyTo: process.env.NEXT_PUBLIC_STORE_EMAIL || user,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    return { sent: true };
  } catch (caught: unknown) {
    console.error("Mailer: sending failed:", caught);
    return { sent: false, reason: "send-failed" };
  }
}
