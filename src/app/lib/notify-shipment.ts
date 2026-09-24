/*
 * ---------------------------------------------------------
 * SENDING THE "ON ITS WAY" EMAIL
 * ---------------------------------------------------------
 *
 * Server-only. Returns whether the mail actually went out, so
 * the caller can record it - and, more usefully, so it can NOT
 * record it when nothing was sent.
 *
 * Never throws. A courier booking that succeeded must not be
 * reported as a failure because the mail server was down; the
 * parcel is real either way, and the shipment row is the thing
 * that must be right.
 */

import { sendMail, STORE_NAME } from "@/src/app/lib/mailer";
import {
  shipmentHtml,
  shipmentSubject,
  shipmentText,
  type ShipmentEmailInput,
} from "@/src/app/lib/shipment-email";

interface NotifyInput {
  to: string | null;
  orderReference: string;
  courierName: string;
  trackingNumber: string;
  codAmount: number;
  paymentMethod: string | null;
  shippingAddress: string;
}

export async function notifyCustomer(input: NotifyInput): Promise<boolean> {
  if (!input.to) {
    /* Orders placed before contact_email existed have nowhere to write to. */
    console.warn("Shipment notification: the order has no contact email.");
    return false;
  }

  const body: ShipmentEmailInput = {
    orderReference: input.orderReference,
    courierName: input.courierName,
    trackingNumber: input.trackingNumber,
    codAmount: input.codAmount,
    paymentMethod: input.paymentMethod,
    shippingAddress: input.shippingAddress,
    storeName: STORE_NAME,
    storeUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  };

  const result = await sendMail({
    to: input.to,
    subject: shipmentSubject(body),
    text: shipmentText(body),
    html: shipmentHtml(body),
  });

  return result.sent;
}
