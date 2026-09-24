/*
 * ---------------------------------------------------------
 * POST /api/admin/couriers/cities
 * ---------------------------------------------------------
 *
 * Refreshes courier_cities from a courier's own list.
 *
 * Without this every booking fails: a courier will not accept a
 * free-text city, so the shipments route looks the destination
 * up first and refuses with 422 when it finds nothing. An empty
 * courier_cities means nothing is ever serviceable.
 *
 * Each courier's list is its own. Leopards returns numeric ids
 * ("204" for Karachi); PostEx books against the name, so its id
 * and name are the same string. Neither is interpreted here -
 * whatever the adapter returns is what gets stored, and the
 * adapter is the only thing that knows what its courier means.
 */

import { NextResponse } from "next/server";

import { requireAdmin } from "@/src/app/lib/admin-route";
import { adapterFor, CourierUnavailableError } from "@/src/app/lib/couriers";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  let body: { courierCode?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const courierCode = typeof body.courierCode === "string" ? body.courierCode : "";

  if (!courierCode) {
    return NextResponse.json({ error: "Expected a courier." }, { status: 400 });
  }

  try {
    const cities = await adapterFor(courierCode).cities();

    if (cities.length === 0) {
      return NextResponse.json({ error: "The courier returned no cities." }, { status: 502 });
    }

    /*
     * Upserted rather than replaced. Deleting first would leave
     * the shop with no serviceable cities at all if the insert
     * then failed - and a courier dropping a city is far rarer
     * than a network hiccup mid-sync.
     */
    const { error } = await admin.supabase.from("courier_cities").upsert(
      cities.map((city) => ({
        courier_code: courierCode,
        city_id: city.id,
        city_name: city.name,
      })),
      { onConflict: "courier_code,city_id" }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ synced: cities.length });
  } catch (caught: unknown) {
    if (caught instanceof CourierUnavailableError) {
      return NextResponse.json({ error: caught.message }, { status: 501 });
    }

    console.error("City sync failed:", caught);

    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "The sync failed." },
      { status: 502 }
    );
  }
}
