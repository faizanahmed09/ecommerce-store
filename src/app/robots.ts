import type { MetadataRoute } from "next";

import { absoluteUrl, SITE_URL } from "@/src/app/lib/seo";

/*
 * /robots.txt - crawl the shop, not the till.
 *
 * The disallowed paths are per-shopper or back-office pages:
 * nothing on them can rank, and crawling them only spends the
 * crawl budget the product pages need. Search result URLs
 * (/products?q=) are left out too, because every query is a
 * new near-duplicate of the catalogue.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/account",
          "/cart",
          "/checkout",
          "/wishlist",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/track-order",
          "/products?q=",
          "/*?*sort=",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
