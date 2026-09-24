/*
 * ---------------------------------------------------------
 * POST /api/admin/shipments
 * ---------------------------------------------------------
 *
 * Books an order with a courier and records the shipment.
 *
 * Server-only because the courier credentials are: they live in
 * env vars, never in Postgres and never in the browser. That is
 * the same reasoning as the Gmail app password - the anon key
 * ships inside the JavaScript bundle, so anything the browser
 * can read, anyone can.
 *
 * The caller's own token is forwarded to Supabase, so RLS runs
 * as that admin rather than as a service role. This route holds
 * no key that could read more than the person using it.
 */

import { NextResponse } from "next/server";

import { requireAdmin } from "@/src/app/lib/admin-route";
import { adapterFor, CourierUnavailableError } from "@/src/app/lib/couriers";
import { notifyCustomer } from "@/src/app/lib/notify-shipment";
import { toOrderNumber } from "@/src/app/lib/order-number";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const supabase = admin.supabase;

  let body: { orderId?: unknown; courierCode?: unknown; weightGrams?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const courierCode = typeof body.courierCode === "string" ? body.courierCode : "";

  if (!UUID.test(orderId) || !courierCode) {
    return NextResponse.json({ error: "Expected an order id and a courier." }, { status: 400 });
  }

  /*
   * The courier check and the order read are independent, so
   * they go together. From a Singapore function beside the
   * database each is a couple of milliseconds - but they were
   * in series for no reason, and the habit is what matters:
   * this route already makes seven round trips before it
   * reaches the courier.
   */
  const [{ data: courier }, { data: order }] = await Promise.all([
    supabase.from("couriers").select("code, name, enabled").eq("code", courierCode).maybeSingle(),
    supabase
      .from("orders")
      .select(
        "id, total_amount, shipping_address, contact_email, contact_phone, payment_method, notes"
      )
      .eq("id", orderId)
      .maybeSingle(),
  ]);

  if (!courier?.enabled) {
    return NextResponse.json({ error: "That courier is not enabled." }, { status: 400 });
  }

  if (!order) {
    return NextResponse.json({ error: "No such order." }, { status: 404 });
  }

  /*
   * shipping_address is one TEXT column, written as an address
   * block: name, street, "city, state, postcode", country.
   */
  const lines = String(order.shipping_address)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  /*
   * The city is found by asking the courier's own list what it
   * recognises, rather than by counting lines.
   *
   * Reading lines[2] worked for addresses shaped exactly the
   * way checkout writes them and failed on everything else - a
   * missing street line shifted every field up one, and the
   * booking was refused for an address that was perfectly
   * serviceable. Matching against courier_cities is the same
   * lookup that has to happen anyway, so doing it first costs
   * nothing and no longer depends on the shape.
   */
  const { data: serviceable } = await supabase
    .from("courier_cities")
    .select("city_id, city_name, normalised")
    .eq("courier_code", courierCode);

  if (!serviceable || serviceable.length === 0) {
    return NextResponse.json(
      {
        error:
          `No cities are synced for ${courierCode}. ` +
          "Sync them from Admin -> Couriers before booking.",
      },
      { status: 422 }
    );
  }

  /* Longest first, so "Karachi" cannot shadow "Karachi Cantt". */
  const byLength = [...serviceable].sort((a, b) => b.normalised.length - a.normalised.length);

  const haystack = lines.join(" | ").toLowerCase();

  const match = byLength.find((row) => haystack.includes(row.normalised));

  if (!match) {
    return NextResponse.json(
      {
        error:
          `${courierCode} does not list any city in this address as serviceable. ` +
          `Address: ${lines.slice(1).join(", ")}`,
      },
      { status: 422 }
    );
  }

  try {
    const result = await adapterFor(courierCode).book({
      orderReference: toOrderNumber(order.id),
      codAmount: Number(order.total_amount),
      weightGrams: typeof body.weightGrams === "number" ? body.weightGrams : 500,
      pieces: 1,
      destinationCityRef: match.city_id,
      consignee: {
        name: lines[0] ?? "Customer",
        phone: order.contact_phone ?? "",
        email: order.contact_email ?? undefined,
        address: lines.slice(1).join(", "),
        city: match.city_name,
      },
    });

    /*
     * Written only after the courier has committed. A row with
     * no tracking number is a parcel nobody can find, so the
     * adapter throws rather than returning one.
     */
    const { data: shipment, error } = await supabase
      .from("shipments")
      .insert({
        order_id: orderId,
        courier_code: courierCode,
        tracking_number: result.trackingNumber,
        status: "booked",
        courier_status: result.courierStatus ?? null,
        cod_amount: Number(order.total_amount),
        weight_grams: typeof body.weightGrams === "number" ? body.weightGrams : 500,
        raw_request: result.rawRequest as never,
        raw_response: result.rawResponse as never,
        booked_at: new Date().toISOString(),
      })
      .select("id, tracking_number")
      .single();

    if (error) {
      /*
       * 23505 is the one-active-shipment-per-order index. The
       * parcel IS booked with the courier at this point, so
       * this is reported rather than retried.
       */
      const duplicate = (error as { code?: string }).code === "23505";

      console.error("Shipment booked but not recorded:", error);

      return NextResponse.json(
        {
          error: duplicate
            ? "That order already has an active shipment."
            : "The courier booked this parcel but it could not be saved.",
          trackingNumber: result.trackingNumber,
        },
        { status: duplicate ? 409 : 500 }
      );
    }

    /*
     * Tell the customer, then record that we did.
     *
     * Deliberately after the shipment is saved and never
     * allowed to fail the request: the parcel is booked with
     * the courier and the row is written, so an unreachable
     * mail server must not turn a completed booking into an
     * error the admin will retry - a retry would be refused by
     * the one-active-shipment index anyway.
     *
     * customer_notified_at is what makes it recoverable. Null
     * means they were never told, so a later sweep can chase
     * exactly those and cannot mail anyone twice.
     */
    const notified = await notifyCustomer({
      to: order.contact_email,
      orderReference: toOrderNumber(order.id),
      courierName: courier.name,
      trackingNumber: result.trackingNumber,
      codAmount: Number(order.total_amount),
      paymentMethod: order.payment_method,
      shippingAddress: String(order.shipping_address),
    });

    if (notified) {
      await supabase
        .from("shipments")
        .update({ customer_notified_at: new Date().toISOString() })
        .eq("id", shipment.id);
    }

    return NextResponse.json({ shipment, notified });
  } catch (caught: unknown) {
    if (caught instanceof CourierUnavailableError) {
      return NextResponse.json({ error: caught.message }, { status: 501 });
    }

    console.error("Courier booking failed:", caught);

    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "The booking failed." },
      { status: 502 }
    );
  }
}
