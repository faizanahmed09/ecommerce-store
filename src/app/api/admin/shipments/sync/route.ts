/*
 * ---------------------------------------------------------
 * POST /api/admin/shipments/sync
 * ---------------------------------------------------------
 *
 * Asks each courier what happened to the parcels still in
 * flight, and records it.
 *
 * This is what courier_status_map and shipment_events were
 * built for and, until now, nothing filled. Every courier
 * invents its own words for "returned", so the mapping is data:
 * adding a status a courier started sending last week is a row,
 * not a deploy.
 *
 * An UNMAPPED status is deliberately not an error and does not
 * change the shipment's internal status. The courier's own word
 * is still recorded, so it shows up in the events and can be
 * mapped afterwards - which is safer than guessing, because the
 * wrong guess marks a parcel delivered.
 */

import { NextResponse } from "next/server";

import { requireAdmin } from "@/src/app/lib/admin-route";
import { adapterFor, CourierUnavailableError } from "@/src/app/lib/couriers";

/* Parcels that can still move. Delivered and returned are final. */
const IN_FLIGHT = ["booked", "in_transit", "out_for_delivery"];

export async function POST(request: Request) {
  /*
   * Admin-triggered only.
   *
   * Scheduling this would need a credential a cron can hold,
   * and shipments are admin-only under RLS - so it would mean
   * either a service role key or SECURITY DEFINER functions to
   * read and write them. Both are decisions about how much
   * power a scheduled job gets, not details to slip in behind
   * a feature.
   */
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data: shipments } = await admin.supabase
    .from("shipments")
    .select("id, courier_code, tracking_number, status, courier_status")
    .in("status", IN_FLIGHT)
    .not("tracking_number", "is", null)
    .limit(200);

  if (!shipments || shipments.length === 0) {
    return NextResponse.json({ checked: 0, updated: 0 });
  }

  /* One call per courier, not one per parcel. */
  const byCourier = new Map<string, typeof shipments>();

  for (const shipment of shipments) {
    byCourier.set(shipment.courier_code, [
      ...(byCourier.get(shipment.courier_code) ?? []),
      shipment,
    ]);
  }

  /* The whole mapping in one read, rather than per shipment. */
  const { data: mappings } = await admin.supabase
    .from("courier_status_map")
    .select("courier_code, courier_status, status");

  const mapped = new Map(
    (mappings ?? []).map((row) => [`${row.courier_code}:${row.courier_status}`, row.status])
  );

  /*
   * Collected, then written once.
   *
   * The first version inserted an event and updated a shipment
   * inside the loop - two round trips per parcel, in series,
   * for up to two hundred parcels. The courier calls were
   * already batched per courier; the database writes were not,
   * which made the database the slow part of a job whose whole
   * purpose is talking to couriers.
   */
  const events: {
    shipment_id: string;
    status: string;
    courier_status: string;
    raw: never;
  }[] = [];

  /* Target status -> the shipments moving to it. */
  const transitions = new Map<string, { ids: string[]; courierStatus: string }>();

  const unmapped: string[] = [];

  for (const [courierCode, rows] of byCourier) {
    try {
      const results = await adapterFor(courierCode).track(
        rows.map((row) => row.tracking_number as string)
      );

      for (const result of results) {
        const shipment = rows.find((row) => row.tracking_number === result.trackingNumber);

        if (!shipment || !result.courierStatus) {
          continue;
        }

        const internal = mapped.get(`${courierCode}:${result.courierStatus.toLowerCase()}`);

        if (!internal) {
          unmapped.push(`${courierCode}: ${result.courierStatus}`);
        }

        /*
         * Only when something actually changed.
         *
         * The unique constraint on the events table does NOT
         * make a repeated sync idempotent, whatever an earlier
         * version of this comment claimed: occurred_at defaults
         * to now(), so every sync produced a new key and a
         * duplicate row. Polling a parcel hourly for a week
         * would have written a hundred and sixty identical
         * events.
         *
         * Comparing against what the shipment already says is
         * the actual guard - and it makes the table a history
         * of changes, which is what it is for.
         */
        const changed =
          result.courierStatus !== shipment.courier_status ||
          (internal !== undefined && internal !== shipment.status);

        if (changed) {
          events.push({
            shipment_id: shipment.id,
            status: internal ?? shipment.status,
            courier_status: result.courierStatus,
            raw: result.raw as never,
          });
        }

        if (!internal || internal === shipment.status) {
          continue;
        }

        const moving = transitions.get(internal) ?? {
          ids: [],
          courierStatus: result.courierStatus,
        };

        moving.ids.push(shipment.id);
        transitions.set(internal, moving);
      }
    } catch (caught: unknown) {
      /*
       * One courier being unreachable must not stop the others.
       * A missing adapter is expected, not exceptional.
       */
      if (!(caught instanceof CourierUnavailableError)) {
        console.error(`Tracking sync failed for ${courierCode}:`, caught);
      }
    }
  }

  if (events.length > 0) {
    /* One insert, however many parcels moved. */
    const { error } = await admin.supabase.from("shipment_events").insert(events);

    if (error) {
      console.error("Could not record shipment events:", error);
    }
  }

  /*
   * One update per distinct target status - at most eight,
   * however many parcels there are - rather than one per
   * parcel. Each statement carries the ids moving to it.
   */
  let updated = 0;

  for (const [status, moving] of transitions) {
    const { error } = await admin.supabase
      .from("shipments")
      .update({
        status,
        courier_status: moving.courierStatus,
        /*
         * Set on delivery and never cleared. Writing null for
         * every other transition would erase the delivery date
         * of a parcel that moved again afterwards - a return,
         * say - losing the one timestamp anyone asks about.
         */
        ...(status === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
      })
      .in("id", moving.ids);

    if (error) {
      console.error(`Could not move shipments to ${status}:`, error);
      continue;
    }

    updated += moving.ids.length;
  }

  return NextResponse.json({
    checked: shipments.length,
    updated,
    /* Surfaced so a new courier status can be mapped, not guessed. */
    unmapped: [...new Set(unmapped)],
  });
}
