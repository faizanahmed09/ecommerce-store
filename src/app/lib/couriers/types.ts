/*
 * ---------------------------------------------------------
 * COURIER ADAPTERS
 * ---------------------------------------------------------
 *
 * One shape the shop books against, and one adapter per
 * courier to translate it.
 *
 * Pakistani couriers share no schema: Leopards wants
 * `consignment_name_eng` and a numeric city id from its own
 * list, PostEx wants its own vocabulary behind a bearer token,
 * M&P publishes nothing at all. None of that belongs anywhere
 * except inside an adapter - the rest of the app deals only in
 * the types below.
 *
 * Adapters are pure translation plus one HTTP call. Nothing
 * here reads the database or decides policy; the route that
 * calls them does that, so an adapter can be tested by handing
 * it an input and reading what it would send.
 */

/** Our vocabulary. The only statuses the app branches on. */
export type ShipmentStatus =
  | "pending"
  | "booked"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "cancelled"
  | "failed";

export interface BookShipmentInput {
  /* What the customer quotes back at us, e.g. LM-C3F9A1C0. */
  orderReference: string;
  /* Zero for a prepaid order; couriers treat that as "no COD". */
  codAmount: number;
  weightGrams: number;
  pieces: number;
  instructions?: string;

  consignee: {
    name: string;
    /*
     * Mandatory, not optional. PostEx rejects an order without
     * it (format 03xxxxxxxxx), and a rider with no number to
     * call is a failed delivery whatever the courier.
     */
    phone: string;
    email?: string;
    address: string;
    /* As the shopper typed it. The adapter resolves the id. */
    city: string;
  };

  /*
   * Whatever the chosen courier's own list calls the
   * destination, looked up in courier_cities before the adapter
   * is called.
   *
   * Deliberately not "cityId": Leopards wants a numeric id
   * ("204"), PostEx wants the name ("Karachi"). Both are just
   * the opaque token that courier accepts, so the shop stores
   * one per courier and never tries to interpret it.
   */
  destinationCityRef: string;
}

export interface BookShipmentResult {
  /* CN, slip number, tracking id - one thing, many names. */
  trackingNumber: string;
  /* Their status word, verbatim, before any mapping. */
  courierStatus?: string;
  /* Kept for reconciliation disputes months later. */
  rawRequest: unknown;
  rawResponse: unknown;
}

export interface TrackResult {
  trackingNumber: string;
  courierStatus: string;
  occurredAt?: string;
  raw: unknown;
}

export interface CourierCity {
  id: string;
  name: string;
}

export interface CourierAdapter {
  readonly code: string;
  book(input: BookShipmentInput): Promise<BookShipmentResult>;
  track(trackingNumbers: string[]): Promise<TrackResult[]>;
  /* Refreshes courier_cities. Their ids change; ours must follow. */
  cities(): Promise<CourierCity[]>;
}

/*
 * A courier that has no adapter yet, or is missing its
 * credentials.
 *
 * Thrown rather than returned so a half-booked shipment cannot
 * be written: the route never reaches the insert.
 */
export class CourierUnavailableError extends Error {
  constructor(code: string, reason: string) {
    super(`${code}: ${reason}`);
    this.name = "CourierUnavailableError";
  }
}
