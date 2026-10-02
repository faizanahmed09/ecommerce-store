/*
 * ---------------------------------------------------------
 * CACHED CATALOGUE READS
 * ---------------------------------------------------------
 *
 * Every shopper used to pay for the catalogue themselves.
 * React Query's cache is per browser session, so it helps only
 * the second page one visitor opens - a thousand people looking
 * at the same dresses meant a thousand identical queries.
 *
 * These are the same reads behind a `use cache` scope: one
 * query answers all of them for the life of the entry, and the
 * result can be prerendered into the page's static shell.
 *
 * Scope: the category tree, the filter options, and the FIRST
 * page of a listing with its review stars. Later pages stay on
 * the client - someone who scrolls is one visitor in ten, and
 * an infinite scroll cannot be prerendered anyway.
 *
 * Two rules for anything added here:
 *
 *  - It must be the same for every visitor. Cart, wishlist,
 *    orders and anything under data/users are per-person and
 *    caching them would serve one shopper another's data.
 *  - No request-time APIs. A cached scope cannot read cookies,
 *    headers or searchParams, and neither can anything it
 *    calls; values like those are read outside and passed in.
 *
 * The Supabase client is built inside each scope on purpose.
 * Constructing one calls Math.random(), which cannot be
 * prerendered - inside a cached function it is part of what
 * gets cached, which is what Next's blocking-prerender-random
 * error asks for.
 */

import { cacheLife, cacheTag } from "next/cache";

import {
  fetchCategories,
  fetchCategoriesBySlugs,
  fetchCategoryById,
  fetchCategoryChildren,
  fetchRootCategories,
  type CategoryRecord,
} from "@/src/app/lib/categories";
import { visibleCategories } from "@/src/app/lib/category-visibility";
import { CATEGORIES_TAG, PRODUCTS_TAG } from "@/src/app/lib/cache-tags";
import {
  fetchProductBySlug,
  fetchStorefrontProductPage,
  fetchVariantOptions,
  type ProductPage,
  type ProductQuery,
  type StorefrontProduct,
  type VariantGroup,
} from "@/src/app/lib/products";
import {
  fetchReviewStatsByProduct,
  type ReviewStats,
  type SeededReviewStats,
} from "@/src/app/lib/reviews";
import { createClient } from "@/src/app/lib/supabase/server";

/* ---------------------------------------------------------
 * Categories
 * ------------------------------------------------------- */

export async function getCategoriesBySlugs(slugs: string[]): Promise<CategoryRecord[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATEGORIES_TAG);

  return fetchCategoriesBySlugs(slugs, createClient());
}

export async function getRootCategories(limit?: number): Promise<CategoryRecord[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATEGORIES_TAG);

  return fetchRootCategories(limit, createClient());
}

/*
 * One category by id, for resolving a child's parent so the
 * canonical URL can be built.
 */
export async function getCategoryById(id: string): Promise<CategoryRecord | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATEGORIES_TAG);

  return fetchCategoryById(id, createClient());
}

export async function getCategoryChildren(parentSlug: string): Promise<CategoryRecord[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATEGORIES_TAG);

  return fetchCategoryChildren(parentSlug, createClient());
}

/* ---------------------------------------------------------
 * Products
 * ------------------------------------------------------- */

/*
 * The first page of a listing, and the ratings for the products
 * on it. Both are seeded into React Query on the client, which
 * then owns paging from page two onwards.
 *
 * Revalidate after a minute, but do not expire for a day.
 *
 * The two are different questions and the presets tie them
 * together. `minutes` means revalidate 60s AND expire 3600s -
 * and expiry is the one that hurts: past it, the next visitor
 * waits for a fresh read instead of being served a stale one
 * while it refreshes behind them. An hour of no traffic is an
 * ordinary night for a shop this size, so the first person
 * through the door each morning was paying for the whole cold
 * path.
 *
 * A minute of staleness is what we actually want; a day is how
 * long it stays worth serving. Neither risks selling anything
 * wrongly - the cart has always held an older snapshot than
 * this, and place_order re-prices and re-checks stock inside
 * the transaction.
 *
 * The arguments are part of the cache key, so each distinct set
 * of filters gets its own entry. Most traffic lands on the
 * unfiltered view, which is therefore the entry that does the
 * work; a narrow filter combination simply gets a low hit rate
 * rather than costing anything extra.
 */
export async function getProductPage(
  options: ProductQuery,
  withCount = false
): Promise<ProductPage> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 60, expire: 86_400 });
  cacheTag(PRODUCTS_TAG);

  return fetchStorefrontProductPage(options, withCount, createClient());
}

/*
 * Ratings for a set of products, as a plain object: a Map is
 * not something a cache entry can be serialised as, so the
 * shape crossing the boundary is a record and the caller
 * rebuilds whatever it needs from it.
 */
export async function getReviewStats(productIds: string[]): Promise<Record<string, ReviewStats>> {
  "use cache";
  /* Stars change less than stock; same reasoning as above. */
  cacheLife({ stale: 300, revalidate: 300, expire: 86_400 });
  cacheTag(PRODUCTS_TAG);

  return Object.fromEntries(await fetchReviewStatsByProduct(productIds));
}

/*
 * One product by slug, for its detail page.
 *
 * Same lifetime as a listing: the page shows stock and price,
 * and place_order is the authority on both at the moment an
 * order is placed.
 */
export async function getProductBySlug(slug: string): Promise<StorefrontProduct | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 60, expire: 86_400 });
  cacheTag(PRODUCTS_TAG);

  return fetchProductBySlug(slug, createClient());
}

/* ---------------------------------------------------------
 * Sitemap
 * ------------------------------------------------------- */

export async function getAllCategories(): Promise<CategoryRecord[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATEGORIES_TAG);

  return visibleCategories(await fetchCategories(createClient()));
}

export interface SitemapProduct {
  slug: string;
  updated_at: string | null;
  images: string[];
}

/*
 * Supabase caps a single response at 1,000 rows (the project's
 * "Max rows" API setting) whatever limit the query asks for,
 * and truncates silently - so the products are read a page at
 * a time. Keep this at or below that setting.
 */
const SITEMAP_PAGE_SIZE = 1_000;

/* Google reads at most 50,000 URLs from one sitemap file. */
const SITEMAP_MAX_PRODUCTS = 50_000;

/*
 * Every product's URL, last edit and photos - just enough for
 * sitemap.xml, without the variants and stock a listing reads.
 */
export async function getSitemapProducts(): Promise<SitemapProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(PRODUCTS_TAG);

  const client = createClient();
  const products: SitemapProduct[] = [];

  while (products.length < SITEMAP_MAX_PRODUCTS) {
    const from = products.length;

    /*
     * Ordered by id because it is unique: paging on updated_at,
     * which ties, can skip or repeat a row at a page boundary.
     */
    const { data, error } = await client
      .from("products")
      .select("slug, updated_at, product_images(image_url, is_primary)")
      .order("id", { ascending: true })
      .range(from, from + SITEMAP_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = data ?? [];

    for (const row of rows) {
      products.push({
        slug: row.slug,
        updated_at: row.updated_at,
        images: [...(row.product_images ?? [])]
          .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
          .map((image) => image.image_url),
      });
    }

    /* A short page is the last one. */
    if (rows.length < SITEMAP_PAGE_SIZE) {
      break;
    }
  }

  return products.slice(0, SITEMAP_MAX_PRODUCTS);
}

/*
 * The sizes and colours the filter rail offers. These follow
 * the catalogue rather than the stock level, so they change
 * only when a product is added or edited.
 */
export async function getVariantOptions(): Promise<VariantGroup[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(PRODUCTS_TAG);

  return fetchVariantOptions(createClient());
}

/* ---------------------------------------------------------
 * Preloading a grid
 * ------------------------------------------------------- */

/** Everything a ProductGrid needs to render without asking. */
export interface ListingPreload {
  page: ProductPage | undefined;
  stats: SeededReviewStats | undefined;
}

/*
 * The two reads a grid would otherwise make from the browser,
 * done once on the server and shared by every visitor.
 *
 * Lives here rather than at each call site because there are
 * two of them - the listing pages and the department rails -
 * and the second one had already drifted: it preloaded the
 * products and left the stars to be fetched per visitor, which
 * is half a fix that looks like a whole one.
 *
 * Neither failure is worth a blank page. An undefined result
 * puts the grid back to fetching for itself, exactly as it
 * behaved before any of this.
 */
export async function preloadListing(
  options: ProductQuery,
  withCount = false
): Promise<ListingPreload> {
  const page = await getProductPage(options, withCount).catch((error: unknown) => {
    console.error("Could not preload products:", error);
    return undefined;
  });

  const ids = page?.products.map((product) => product.id) ?? [];

  if (ids.length === 0) {
    return { page, stats: undefined };
  }

  const stats = await getReviewStats(ids).catch((error: unknown) => {
    console.error("Could not preload review stats:", error);
    /* Stars are decorative; the grid renders without them. */
    return {};
  });

  return { page, stats: { ids, stats } };
}
