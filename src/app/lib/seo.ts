/*
 * ---------------------------------------------------------
 * SEO
 * ---------------------------------------------------------
 *
 * One place for what search engines and link previews are told
 * about the shop: the canonical origin, the default title and
 * description, the keywords the copy is written around, and the
 * schema.org structured data.
 *
 * The keywords are the phrases Pakistani shoppers actually type
 * for eastern wear. They are not a ranking lever on their own -
 * Google ignores the keywords meta tag - but titles,
 * descriptions and headings written around them are, so keep
 * page copy in step with this list.
 */

import type { Metadata } from "next";

import type { StorefrontProduct } from "@/src/app/lib/products";
import { getEffectivePrice, getPrimaryImage, isInStock } from "@/src/app/lib/products";
import {
  SOCIAL_PROFILES,
  STORE_ADDRESS,
  STORE_EMAIL,
  STORE_PHONE,
} from "@/src/app/lib/store-contact";

/* No trailing slash, so paths can be appended as-is. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
);

export const SITE_NAME = "HAANI Threads";

export const LOGO_PATH = "/haani-threads-logo-shorter-h.png";

/*
 * The brand card link previews fall back to (WhatsApp,
 * Facebook, X). Set in config rather than as an app/
 * opengraph-image file, because file-based metadata outranks
 * config and would replace a product's own photo.
 */
export const DEFAULT_OG_IMAGE = {
  url: "/haani-fabrics-hero.png",
  width: 1536,
  height: 1024,
  alt: "HAANI Threads - summer and winter unstitched fabrics",
};

export const DEFAULT_TITLE = "HAANI Threads | Summer & Winter Unstitched";

export const DEFAULT_DESCRIPTION =
  "Discover summer and winter unstitched fabrics at HAANI Threads. Explore Pakistani prints and embroidery to tailor your way, with delivery across Pakistan.";

/*
 * Grouped by intent so it is obvious where a new phrase
 * belongs. Flattened for the keywords meta tag.
 */
export const SEO_KEYWORDS = {
  brand: ["HAANI Threads", "HAANI Threads unstitched", "HAANI Threads clothing"],
  eastern: [
    "eastern wear",
    "women's eastern wear",
    "ladies suits",
    "ladies dresses Pakistan",
    "women's clothing Pakistan",
    "Pakistani eastern wear",
    "eastern wear online Pakistan",
    "Pakistani clothes online",
    "Pakistani dresses",
    "desi clothes",
    "ethnic wear Pakistan",
  ],
  women: [
    "embroidered dress",
    "embroidered suits",
    "stitched dress",
    "stitched suits",
    "ready to wear dresses",
    "pret wear",
    "unstitched suits",
    "3 piece suit",
    "2 piece suit",
    "3 piece stitched suit",
    "embroidered 3 piece suit",
    "lawn suits",
    "embroidered lawn",
    "chikankari suits",
    "shalwar kameez for women",
    "kurti",
    "kurti for women",
    "embroidered kurti",
    "unstitched lawn suits",
    "party wear dresses",
    "formal dresses Pakistan",
    "Eid collection",
    "wedding wear",
  ],
  local: ["online shopping Pakistan", "cash on delivery Pakistan", "unstitched fabric Pakistan"],
} as const;

export const ALL_KEYWORDS: string[] = Object.values(SEO_KEYWORDS).flat();

/* "/summer-unstitched" -> the matching URL on NEXT_PUBLIC_SITE_URL */
export const absoluteUrl = (path = "/"): string =>
  path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/*
 * Titles past ~60 characters are cut off in results, and
 * descriptions past ~160. Trimming here keeps the cut on a
 * word boundary rather than wherever Google decides.
 */
export function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();

  if (clean.length <= max) {
    return clean;
  }

  const cut = clean.slice(0, max - 1);

  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:\s-]+$/, "")}…`;
}

/*
 * The metadata every indexable page wants beyond a title:
 * a canonical URL, and Open Graph / Twitter fields that match
 * the page rather than falling back to the homepage's.
 */
export function pageMetadata({
  title,
  description,
  path,
  images,
  noIndex,
}: {
  title: string;
  description: string;
  path: string;
  images?: (string | typeof DEFAULT_OG_IMAGE)[];
  noIndex?: boolean;
}): Metadata {
  const desc = truncate(description);

  /*
   * A page's openGraph replaces the layout's wholesale, so the
   * fallback card has to be repeated here or it is lost.
   */
  const ogImages = images?.length ? images : [DEFAULT_OG_IMAGE];

  return {
    title,
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: desc,
      url: path,
      siteName: SITE_NAME,
      locale: "en_PK",
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: ogImages,
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

/* Account, cart and checkout pages: useful to a shopper, useless in results. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: true };

/*
 * ---------------------------------------------------------
 * STRUCTURED DATA (schema.org JSON-LD)
 * ---------------------------------------------------------
 */

type JsonLdObject = Record<string, unknown>;

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: ["HAANI Threads Official"],
    url: SITE_URL,
    logo: absoluteUrl(LOGO_PATH),
    image: absoluteUrl(DEFAULT_OG_IMAGE.url),
    description: DEFAULT_DESCRIPTION,
    ...(STORE_EMAIL ? { email: STORE_EMAIL } : {}),
    telephone: STORE_PHONE,
    priceRange: "Rs",
    currenciesAccepted: "PKR",
    paymentAccepted: "Cash on Delivery",
    address: {
      "@type": "PostalAddress",
      streetAddress: STORE_ADDRESS,
      addressCountry: "PK",
    },
    areaServed: { "@type": "Country", name: "Pakistan" },
    ...(SOCIAL_PROFILES.length ? { sameAs: SOCIAL_PROFILES.map((p) => p.href) } : {}),
  };
}

/* Tells Google the site's name, so results read "HAANI Threads" rather than the domain. */
export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "en-PK",
    alternateName: ["HAANI Threads Official"],
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/* Price, stock and photos in the result itself - the rich product snippet. */
export function productJsonLd(product: StorefrontProduct, path: string): JsonLdObject {
  const images = [
    getPrimaryImage(product),
    ...product.product_images.map((image) => image.image_url),
  ].filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: truncate(product.description || defaultProductDescription(product), 5000),
    sku: product.id,
    url: absoluteUrl(path),
    ...(images.length ? { image: images.map((url) => absoluteUrl(url)) } : {}),
    brand: { "@type": "Brand", name: SITE_NAME },
    ...(product.categories?.name ? { category: product.categories.name } : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(path),
      priceCurrency: "PKR",
      price: getEffectivePrice(product),
      availability: isInStock(product)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${SITE_URL}/#organization` },
    },
  };
}

/* For products an admin saved without a description. */
export function defaultProductDescription(product: StorefrontProduct): string {
  const category = product.categories?.name;

  return `Buy ${product.name}${category ? ` from our ${category} collection` : ""} online at HAANI Threads. Pakistani eastern wear with cash on delivery across Pakistan.`;
}

/*
 * Serialised for a <script type="application/ld+json">. The
 * "<" escape stops a product name containing "</script>" from
 * closing the tag early.
 */
export const serializeJsonLd = (data: JsonLdObject | JsonLdObject[]): string =>
  JSON.stringify(data).replace(/</g, "\\u003c");
