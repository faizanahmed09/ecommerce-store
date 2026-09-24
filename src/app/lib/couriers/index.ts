/*
 * ---------------------------------------------------------
 * COURIER REGISTRY
 * ---------------------------------------------------------
 *
 * Maps a couriers.code to the adapter that speaks it.
 *
 * M&P is absent on purpose rather than stubbed. It publishes no
 * developer documentation anywhere reachable - no endpoints, no
 * field names, no SDK - and hands API credentials out with a
 * COD portal account instead. Writing an adapter against
 * guessed field names would produce code that compiles, books
 * nothing, and looks finished; an absent adapter fails loudly
 * at the one moment it matters.
 */

import { leopards } from "@/src/app/lib/couriers/leopards";
import { postex } from "@/src/app/lib/couriers/postex";
import { CourierUnavailableError, type CourierAdapter } from "@/src/app/lib/couriers/types";

const ADAPTERS: Record<string, CourierAdapter> = {
  [leopards.code]: leopards,
  [postex.code]: postex,
};

/* Why a courier the admin enabled still cannot be booked. */
const NOT_BUILT: Record<string, string> = {
  mp:
    "M&P publishes no developer API. Request the integration document from " +
    "contact@mulphilog.com after registering for their COD portal.",
};

export function adapterFor(code: string): CourierAdapter {
  const adapter = ADAPTERS[code];

  if (adapter) {
    return adapter;
  }

  throw new CourierUnavailableError(code, NOT_BUILT[code] ?? "no adapter is registered");
}

export function hasAdapter(code: string): boolean {
  return code in ADAPTERS;
}

export { CourierUnavailableError };
export type { BookShipmentInput, BookShipmentResult, ShipmentStatus } from "./types";
