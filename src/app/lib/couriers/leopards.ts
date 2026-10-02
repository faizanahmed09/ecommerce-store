/*
 * ---------------------------------------------------------
 * LEOPARDS COURIER
 * ---------------------------------------------------------
 *
 * The one courier of the three with field names documented
 * publicly, through its community wrappers - which is why it is
 * the one built first.
 *
 * Two things about this file are deliberate:
 *
 *  - The request mapping is a pure function, exported, so it
 *    can be tested without an account or a network. Getting
 *    `booked_packet_collect_amount` wrong is a COD amount
 *    wrong, and that is worth a test rather than a deploy.
 *  - The endpoint paths come from configuration. The host is
 *    documented (merchantapi.leopardscourier.com); the exact
 *    paths are not, so they are not hard-coded as though they
 *    were verified. Confirm them against the account's own
 *    integration document before going live.
 */

import {
  CourierUnavailableError,
  type BookShipmentInput,
  type BookShipmentResult,
  type CourierAdapter,
  type CourierCity,
  type TrackResult,
} from "@/src/app/lib/couriers/types";

const CODE = "leopards";

/*
 * Weight is sent in grams and the API rejects zero, so an
 * unweighed parcel gets a floor rather than a failed booking.
 */
const MIN_WEIGHT_GRAMS = 100;

interface LeopardsConfig {
  apiKey: string;
  apiPassword: string;
  baseUrl: string;
  bookPath: string;
  trackPath: string;
  citiesPath: string;
  /* 'self' uses the account's own city, per their docs. */
  originCity: string;
}

function readConfig(): LeopardsConfig {
  const apiKey = process.env.LEOPARDS_API_KEY;
  const apiPassword = process.env.LEOPARDS_API_PASSWORD;

  if (!apiKey || !apiPassword) {
    throw new CourierUnavailableError(CODE, "LEOPARDS_API_KEY / LEOPARDS_API_PASSWORD are not set");
  }

  return {
    apiKey,
    apiPassword,
    baseUrl: process.env.LEOPARDS_BASE_URL ?? "https://merchantapi.leopardscourier.com",
    bookPath: process.env.LEOPARDS_BOOK_PATH ?? "/api/bookPacket/format/json/",
    trackPath: process.env.LEOPARDS_TRACK_PATH ?? "/api/trackBookedPacket/format/json/",
    citiesPath: process.env.LEOPARDS_CITIES_PATH ?? "/api/getAllCities/format/json/",
    originCity: process.env.LEOPARDS_ORIGIN_CITY ?? "self",
  };
}

/*
 * Our booking, in Leopards' words.
 *
 * Exported and pure: every field name here came from their
 * documented parameter list, and this is the function a test
 * pins so a rename cannot quietly move the COD amount.
 */
export function toLeopardsBooking(
  input: BookShipmentInput,
  config: Pick<LeopardsConfig, "apiKey" | "apiPassword" | "originCity">
): Record<string, string | number> {
  return {
    api_key: config.apiKey,
    api_password: config.apiPassword,

    booked_packet_weight: Math.max(Math.round(input.weightGrams), MIN_WEIGHT_GRAMS),
    booked_packet_no_piece: Math.max(input.pieces, 1),
    /* The money the rider collects. Zero means prepaid. */
    booked_packet_collect_amount: input.codAmount,
    booked_packet_order_id: input.orderReference,

    origin_city: config.originCity,
    destination_city: input.destinationCityRef,

    /* The shipper - us. Their fields, our details. */
    shipment_name_eng: process.env.NEXT_PUBLIC_STORE_NAME ?? "HAANI Threads",
    shipment_email: process.env.NEXT_PUBLIC_STORE_EMAIL ?? "",
    shipment_phone: process.env.NEXT_PUBLIC_STORE_PHONE ?? "",
    shipment_address: (process.env.NEXT_PUBLIC_STORE_ADDRESS ?? "").split("|").join(", "),

    /* The consignee - the customer. */
    consignment_name_eng: input.consignee.name,
    consignment_email: input.consignee.email ?? "",
    consignment_phone: input.consignee.phone,
    consignment_address: input.consignee.address,

    special_instructions: input.instructions ?? "",
  };
}

async function post(url: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    /* Courier APIs are not fast, but nor should they hang. */
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Leopards responded ${response.status}`);
  }

  return response.json();
}

/*
 * Their success shape is not documented publicly, so the
 * tracking number is read defensively rather than assumed. A
 * response we cannot read a number out of is a failure, not a
 * shipment - writing a row with a null tracking number would
 * lose the parcel.
 */
function readTrackingNumber(payload: unknown): string | null {
  const body = payload as Record<string, unknown> | null;

  const candidate = body?.track_number ?? body?.cn_number ?? body?.trackingNumber ?? body?.slip_no;

  return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : null;
}

export const leopards: CourierAdapter = {
  code: CODE,

  async book(input: BookShipmentInput): Promise<BookShipmentResult> {
    const config = readConfig();
    const request = toLeopardsBooking(input, config);

    const response = await post(`${config.baseUrl}${config.bookPath}`, request);
    const trackingNumber = readTrackingNumber(response);

    if (!trackingNumber) {
      throw new Error("Leopards accepted the booking but returned no tracking number.");
    }

    return {
      trackingNumber,
      rawRequest: { ...request, api_key: "[redacted]", api_password: "[redacted]" },
      rawResponse: response,
    };
  },

  async track(trackingNumbers: string[]): Promise<TrackResult[]> {
    const config = readConfig();

    const response = (await post(`${config.baseUrl}${config.trackPath}`, {
      api_key: config.apiKey,
      api_password: config.apiPassword,
      /* "10 digits each", comma-separated for bulk. */
      track_numbers: trackingNumbers.join(","),
    })) as { packet_list?: Record<string, unknown>[] } | null;

    return (response?.packet_list ?? []).map((packet) => ({
      trackingNumber: String(packet.track_number ?? ""),
      courierStatus: String(packet.booked_packet_status ?? ""),
      raw: packet,
    }));
  },

  async cities(): Promise<CourierCity[]> {
    const config = readConfig();

    const response = (await post(`${config.baseUrl}${config.citiesPath}`, {
      api_key: config.apiKey,
      api_password: config.apiPassword,
    })) as { city_list?: Record<string, unknown>[] } | null;

    return (response?.city_list ?? []).map((city) => ({
      id: String(city.id ?? ""),
      name: String(city.name ?? ""),
    }));
  },
};
