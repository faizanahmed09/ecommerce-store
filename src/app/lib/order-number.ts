/*
 * ---------------------------------------------------------
 * ORDER NUMBERS
 * ---------------------------------------------------------
 *
 * What a customer is given to quote back at us.
 *
 * The order's real identity is its uuid, and that stays the
 * identity - it is what the tables join on. But 36 characters
 * is not something anyone reads out over WhatsApp, so the
 * number they see is the first block of it, prefixed:
 *
 *   c3f9a1c0-4b2e-...  ->  LM-C3F9A1C0
 *
 * Derived rather than stored, deliberately. A separate column
 * would mean a generator, a uniqueness constraint, a backfill
 * for existing rows, and a change to place_order so it could
 * hand the new value back - all on the one code path in the
 * shop that must not break. This needs none of that, and every
 * order that already exists has a number the moment it ships.
 *
 * The trade is that it is hex, so 8 characters carry ~4.3
 * billion combinations rather than the ~1 trillion a base32
 * code of the same length would. That is not a security
 * boundary: tracking asks for the email as well, and the email
 * is what actually proves the order is yours.
 */

const PREFIX = "LM";

/* The uuid's first block: 8 hex characters. */
const SHORT_LENGTH = 8;

const FULL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHORT_CODE = /^[0-9a-f]{8}$/i;

/** `LM-C3F9A1C0` — what the customer sees everywhere. */
export function toOrderNumber(orderId: string): string {
  return `${PREFIX}-${orderId.slice(0, SHORT_LENGTH).toUpperCase()}`;
}

/**
 * What the customer typed, reduced to something the database
 * can match: either a full uuid or an 8-character short code.
 *
 * Accepts the number as printed, without the prefix, in either
 * case, and with stray spaces or dashes - people retype these
 * from a screenshot, and rejecting "lm c3f9a1c0" for its
 * spacing would be its own kind of bug.
 */
export function parseOrderReference(input: string): string | null {
  const cleaned = input.trim().toLowerCase();

  /* A full uuid, pasted from the confirmation URL. */
  if (FULL_UUID.test(cleaned)) {
    return cleaned;
  }

  /* Otherwise: drop the prefix and any punctuation around it. */
  const stripped = cleaned.replace(/^lm/i, "").replace(/[^0-9a-f]/gi, "");

  if (SHORT_CODE.test(stripped)) {
    return stripped;
  }

  /*
   * A full uuid that arrived without its dashes still resolves,
   * since its first block is the short code.
   */
  if (/^[0-9a-f]{32}$/i.test(stripped)) {
    return stripped.slice(0, SHORT_LENGTH);
  }

  return null;
}
