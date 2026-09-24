/*
 * ---------------------------------------------------------
 * POSTEX
 * ---------------------------------------------------------
 *
 * Merchant API v4.1.9.
 *
 * Two things differ from Leopards in ways worth naming, because
 * they are exactly what the adapter layer exists to absorb:
 *
 *  - Auth is a `token` header. Not `Authorization: Bearer` -
 *    every summary of this API says bearer, and the working
 *    integrations send a bare `token`.
 *  - The destination is a city NAME, where Leopards wants a
 *    numeric id. Both arrive here as destinationCityRef and
 *    neither is interpreted; courier_cities holds whatever
 *    that courier's own list calls the place.
 *
 * The field names below come from PostEx's own v4.1.9
 * integration guide, transcribed in a public MCP server. That
 * is second-hand: verify against the guide your account gets
 * before booking anything real. Response shapes in particular
 * are not documented publicly, so they are read defensively.
 */

import {
  CourierUnavailableError,
  type BookShipmentInput,
  type BookShipmentResult,
  type CourierAdapter,
  type CourierCity,
  type TrackResult,
} from "@/src/app/lib/couriers/types";

const CODE = "postex";

/* Parcels tracked at once. Enough to be quick, few enough to be polite. */
const TRACK_CONCURRENCY = 10;

/* "Normal", "Reverse" or "Replacement". A sale is Normal. */
const ORDER_TYPE_NORMAL = "Normal";

interface PostExConfig {
  token: string;
  baseUrl: string;
  /* Which of the merchant's pickup addresses to collect from. */
  pickupAddressCode?: string;
}

function readConfig(): PostExConfig {
  const token = process.env.POSTEX_API_TOKEN;

  if (!token) {
    throw new CourierUnavailableError(CODE, "POSTEX_API_TOKEN is not set");
  }

  return {
    token,
    baseUrl: process.env.POSTEX_BASE_URL ?? "https://api.postex.pk/services/integration/api/order",
    pickupAddressCode: process.env.POSTEX_PICKUP_ADDRESS_CODE || undefined,
  };
}

/*
 * Our booking, in PostEx's words. Pure and exported so the
 * mapping can be tested without a token - `invoicePayment` is
 * the COD amount, and getting that wrong is getting the money
 * wrong.
 */
export function toPostExOrder(
  input: BookShipmentInput,
  config: Pick<PostExConfig, "pickupAddressCode">
): Record<string, string | number | undefined> {
  return {
    /* A name here, not an id - see the note above. */
    cityName: input.destinationCityRef,
    customerName: input.consignee.name,
    /* Their documented format is 03xxxxxxxxx. */
    customerPhone: normalisePhone(input.consignee.phone),
    deliveryAddress: input.consignee.address,

    /* Packages, not pieces. PostEx counts both, separately. */
    invoiceDivision: 1,
    invoicePayment: input.codAmount,
    items: Math.max(input.pieces, 1),

    orderRefNumber: input.orderReference,
    orderType: ORDER_TYPE_NORMAL,
    orderDetail: input.instructions,
    transactionNotes: input.instructions,

    pickupAddressCode: config.pickupAddressCode,
  };
}

/*
 * 03xxxxxxxxx, from whatever the shopper typed.
 *
 * +923001234567, 0092-300-1234567 and "0300 1234567" are the
 * same number written three ways, and PostEx accepts one.
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  /* 00923001234567 - the international prefix written out. */
  if (digits.startsWith("0092")) {
    return `0${digits.slice(4)}`;
  }

  /* 923001234567 - a country code with no prefix at all. */
  if (digits.startsWith("92") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }

  if (digits.startsWith("0")) {
    return digits;
  }

  /* A bare 3001234567, missing its leading zero. */
  return digits.length === 10 ? `0${digits}` : digits;
}

async function call(
  config: PostExConfig,
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<unknown> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      /* Not Authorization, not Bearer. */
      token: config.token,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`PostEx responded ${response.status}`);
  }

  return response.json();
}

/*
 * Their success envelope is not public, so the tracking number
 * is read from the likely places and its absence is a failure.
 * A shipment row with no tracking number is a lost parcel.
 */
function readTrackingNumber(payload: unknown): string | null {
  const body = payload as { dist?: Record<string, unknown> } & Record<string, unknown>;

  const candidate =
    body?.dist?.trackingNumber ?? body?.trackingNumber ?? body?.dist?.orderRefNumber;

  return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : null;
}

export const postex: CourierAdapter = {
  code: CODE,

  async book(input: BookShipmentInput): Promise<BookShipmentResult> {
    const config = readConfig();
    const request = toPostExOrder(input, config);

    const response = await call(config, "/v3/create-order", {
      method: "POST",
      body: request,
    });

    const trackingNumber = readTrackingNumber(response);

    if (!trackingNumber) {
      throw new Error("PostEx accepted the order but returned no tracking number.");
    }

    return {
      trackingNumber,
      rawRequest: request,
      rawResponse: response,
    };
  },

  async track(trackingNumbers: string[]): Promise<TrackResult[]> {
    const config = readConfig();

    /*
     * One at a time through track-order rather than
     * track-bulk-order: the bulk endpoint's request shape is
     * not documented publicly, and guessing it would fail
     * silently for every parcel at once.
     *
     * Chunked rather than one big Promise.all. The sync route
     * can hand this two hundred numbers, and two hundred
     * simultaneous requests is how a courier's rate limiter
     * decides you are abusing it - which would fail the whole
     * batch rather than slow it down.
     */
    const results: TrackResult[] = [];

    for (let index = 0; index < trackingNumbers.length; index += TRACK_CONCURRENCY) {
      const batch = trackingNumbers.slice(index, index + TRACK_CONCURRENCY);

      const settled = await Promise.all(
        batch.map(async (trackingNumber) => {
          const response = (await call(
            config,
            `/v1/track-order/${encodeURIComponent(trackingNumber)}`
          )) as { dist?: Record<string, unknown> } | null;

          return {
            trackingNumber,
            courierStatus: String(response?.dist?.transactionStatus ?? ""),
            raw: response,
          };
        })
      );

      results.push(...settled);
    }

    return results;
  },

  async cities(): Promise<CourierCity[]> {
    const config = readConfig();

    const response = (await call(config, "/v2/get-operational-city")) as {
      dist?: Record<string, unknown>[];
    } | null;

    /*
     * The id and the name are the same value on purpose: PostEx
     * books against the city's name, so that is what
     * courier_cities must hold for it.
     */
    return (response?.dist ?? []).map((city) => {
      const name = String(city.operationalCityName ?? city.cityName ?? "");

      return { id: name, name };
    });
  },
};
