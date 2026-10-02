import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * ---------------------------------------------------------
   * A note on where this runs
   * ---------------------------------------------------------
   *
   * vercel.json pins functions to sin1 (Singapore) because the
   * Supabase project lives in AWS ap-southeast-1, and the
   * caching below moved the catalogue reads onto the server.
   *
   * That move only pays off if the server is near the database.
   * Vercel defaults to iad1 (Washington DC), which put every
   * read on a Virginia-to-Singapore round trip of roughly
   * 230ms - so a page doing two of them in sequence spent most
   * of half a second before its first byte, where the browser
   * had previously reached the same data through Cloudflare's
   * nearest edge in about a tenth of that.
   *
   * If the Supabase project is ever moved, move the region in
   * vercel.json with it. The two are a pair.
   */

  /*
   * Caches catalogue reads across visitors rather than per
   * browser. Everything the shop shows was fetched from the
   * client, so a thousand people looking at the same dresses
   * meant a thousand identical Supabase queries; a `use cache`
   * scope answers all of them from one. The cached reads live
   * in src/app/lib/catalogue.ts and are cleared on admin writes
   * by src/app/lib/revalidate.ts.
   *
   * This replaces the route segment configs (`dynamic`,
   * `revalidate`, `fetchCache`), which now error if present.
   *
   * ---------------------------------------------------------
   * About the `export const instant = false` lines
   * ---------------------------------------------------------
   *
   * Nineteen routes carry one, each with a TODO. It means
   * "allowed to block", NOT "uncached" - a route that can still
   * be prerendered is, and the caching above is unaffected.
   * What it defers is Next's instant-navigation validation.
   *
   * Most were added by the documented codemod when the flag was
   * turned on. Six are listing routes that read searchParams
   * before they can render (the filters, sort and page live in
   * the URL), which is what blocks an instant shell.
   *
   * To lift one: move the part that reads searchParams into a
   * child wrapped in <Suspense>, then delete the line and see
   * whether the route still builds.
   */
  cacheComponents: true,
  /* Auth-gated client pages cannot render during the dev-only instant check. */
  experimental: {
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },

  /*
   * Turbopack infers the workspace root from the nearest lockfile, and a
   * stray package-lock.json in a parent directory makes it guess wrong (and
   * then ignore ours). This directory is the root.
   */
  turbopack: {
    root: path.join(__dirname),
  },

  images: {
    /*
     * Product and category art is served from Supabase storage; the seed
     * data points at picsum.photos. next/image refuses any host that is not
     * listed here, so a new image source has to be added before it is used.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      { protocol: "https", hostname: "picsum.photos" },
    ],
    /*
     * The optimizer skips SVG unless it is opted in. /placeholder.svg is our
     * own asset, and the CSP below keeps any SVG it does serve inert.
     */
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    /*
     * How long an optimised image is kept before it is built
     * again. The default is 4 hours, which means the same
     * product photograph is re-optimised six times a day for
     * the life of the product - and image optimisation is
     * metered separately from bandwidth on most hosts.
     *
     * 31 days is safe here because uploads carry a generated
     * suffix (farah-pleated-maxi-mtoi3f92-kpcy81.jpeg), so
     * replacing a product's photograph produces a new URL
     * rather than new bytes behind the old one. Nothing is
     * being served stale; there is simply nothing to re-fetch.
     */
    minimumCacheTTL: 2678400,
  },

  /*
   * ---------------------------------------------------------
   * SECURITY HEADERS
   * ---------------------------------------------------------
   *
   * The shop shipped with none of these. Each closes a class of
   * attack that needs no bug in our own code to work.
   *
   * A note on what is deliberately NOT here: script-src. A
   * meaningful one would have to allow Next's own inline
   * bootstrap, which means either 'unsafe-inline' - which
   * allows every other inline script too, so it protects
   * nothing - or per-request nonces, which need a proxy this
   * app does not have. A CSP that has to be weakened until it
   * permits everything is worse than an honest omission: it
   * reads as protection on an audit and provides none. The
   * directives below are the ones that bite without it.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          /*
           * Clickjacking. Without this an attacker frames the
           * shop invisibly over their own page and harvests
           * clicks on real buttons - "Place order" among them.
           */
          { key: "X-Frame-Options", value: "DENY" },

          /*
           * Stops a browser second-guessing Content-Type. An
           * uploaded image that a browser decides is HTML runs
           * as HTML, on our origin.
           */
          { key: "X-Content-Type-Options", value: "nosniff" },

          /*
           * Full URLs stop leaking to third parties. Order
           * confirmations carry the order id in the query
           * string (/checkout/success?order=<uuid>), and that
           * id is enough to read a customer's email and address
           * through claim_order_confirmation.
           */
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          /*
           * Nothing here needs a camera, a microphone or a
           * location, so nothing may ask.
           */
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },

          /*
           * HTTPS only, remembered for a year. Vercel serves
           * HTTPS anyway; this closes the first plaintext
           * request, which is the one an attacker on the
           * network wants.
           */
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },

          /*
           * The parts of a CSP that need no nonce and cannot
           * break a working page: no plugins, no <base> rewrite,
           * forms may only post to us, and no one may frame us
           * (frame-ancestors is what modern browsers honour -
           * X-Frame-Options above is for older ones).
           */
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
              /*
               * Everything the app genuinely loads from
               * elsewhere. Anything not listed is blocked, so a
               * new integration has to be added here first.
               */
              "img-src 'self' data: blob: https://*.supabase.co https://picsum.photos https://fastly.picsum.photos",
              "media-src 'self' https://*.supabase.co",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com https://vitals.vercel-insights.com",
              /*
               * See the note above: this is not a restriction,
               * it is a statement of where scripts come from.
               * Tightening it is the job of a nonce-issuing proxy.
               */
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      /*
       * The fragrance department lived under a misspelt
       * `/fragnance` directory. Departments are now addressed by
       * their category slug, so the correct spelling is the real
       * URL - but the old one has been linked and indexed, so it
       * is redirected permanently rather than deleted.
       */
      {
        source: "/fragnance",
        destination: "/fragrance",
        permanent: true,
      },
      {
        source: "/fragnance/:subcategory",
        destination: "/fragrance/:subcategory",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
