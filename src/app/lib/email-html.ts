/*
 * Shared helpers for the transactional email templates.
 *
 * escapeHtml was written out in both of them. One copy that
 * misses a character is a customer's name breaking the layout,
 * or worse, so it lives in one place.
 */

/** Anything from the database that lands inside an email's HTML. */
export const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
