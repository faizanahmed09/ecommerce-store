/*
 * ---------------------------------------------------------
 * SAFE REDIRECT TARGETS
 * ---------------------------------------------------------
 *
 * Where a shopper lands after signing in comes from
 * ?redirect= in the URL, which anyone can write.
 *
 * The old check was `value.startsWith("/")`, which looks like
 * it pins the destination to this site and does not: a browser
 * reads "//evil.com" as protocol-relative and resolves it to
 * https://evil.com. So /login?redirect=//evil.com passed the
 * guard and sent the visitor off-site immediately after they
 * had typed their password - on a link that, up to that moment,
 * showed our real domain in the address bar. That is the exact
 * shape of a credential-phishing hop.
 *
 * A single leading slash, and nothing that a browser will read
 * as the start of a host. Backslash is included because some
 * browsers normalise "/\" to "//".
 */

export function safeRedirect(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!value.startsWith("/")) {
    return null;
  }

  /* "//host" and "/\host" are absolute, whatever they look like. */
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }

  return value;
}
