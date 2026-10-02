/*
 * ---------------------------------------------------------
 * STOREFRONT PRODUCT MODEL
 * ---------------------------------------------------------
 *
 * One place that knows how a `products` row maps onto what
 * the storefront renders: which image is primary, what the
 * effective price is, and how `product_variants` rows group
 * into the pickers on the product page.
 *
 * Mirrors schema.sql:
 *   products         (price, sale_price, stock_quantity, featured)
 *   product_images   (image_url, is_primary, display_order)
 *   product_variants (name, value, price_adjustment, stock_quantity)
 */

import { createClient } from "@/src/app/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/app/lib/supabase/database.types";
import { isMissingFunction } from "@/src/app/lib/rpc";

/*
 * Reads default to the browser client. Server components pass
 * their own (lib/supabase/server) rather than reaching for the
 * singleton meant for the browser.
 */
type Client = SupabaseClient<Database>;

export interface ProductImage {
  image_url: string;
  is_primary: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  price_adjustment: number;
  stock_quantity: number;
}

export interface ProductCategory {
  id: string | null;
  name: string | null;
  slug: string | null;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  featured: boolean;
  category_id: string | null;
  categories: ProductCategory | null;
  product_images: ProductImage[];
  product_variants: ProductVariant[];
  /*
   * Whether the product has options at all. The card select
   * fetches variant ids only, so `product_variants` there
   * carries no names or values - read this rather than the
   * array's length when all you need is "does it have any".
   */
  hasVariants: boolean;
}

/* A variant group, e.g. { name: "Size", values: [S, M, L] }. */
export interface VariantGroup {
  name: string;
  values: ProductVariant[];
}

/*
 * ---------------------------------------------------------
 * SELECTS
 * ---------------------------------------------------------
 *
 * `!inner` on categories matters: without it PostgREST filters
 * the embedded row rather than the parent, so a category
 * filter silently returns every product with `categories:
 * null` instead of narrowing the list.
 */

export const PRODUCT_LIST_SELECT = `
  id,
  name,
  slug,
  description,
  price,
  sale_price,
  stock_quantity,
  featured,
  category_id,
  created_at,
  product_images (image_url, is_primary, display_order),
  product_variants (id, name, value, price_adjustment, stock_quantity),
  categories:category_id (id, name, slug)
`;

/*
 * What a card actually renders. The full select above pulls
 * every product's description and every one of its variant
 * rows for a tile that shows neither - measured at ~2.1 KB per
 * product against ~450 B for this, so a page of 24 was 49 KB
 * of JSON to paint 11 KB of it.
 *
 * Variants are asked for by id and stock only. The card has to
 * know two things about them: whether the product has options
 * at all (it links through to configure them rather than
 * adding to the cart), and whether any of them is in stock -
 * isInStock() reads variant stock in preference to the
 * product's own, so a card fetched without it renders every
 * product as out of stock. Their names and prices are the
 * detail page's business.
 */
/* `created_at` is absent on purpose: it is ordered on in SQL,
   and nothing reads it off the mapped product. */
export const PRODUCT_CARD_SELECT = `
  id,
  name,
  slug,
  price,
  sale_price,
  stock_quantity,
  featured,
  category_id,
  product_images (image_url, is_primary, display_order),
  product_variants (id, stock_quantity),
  categories:category_id (id, name, slug)
`;

export const PRODUCT_CARD_SELECT_INNER_CATEGORY = PRODUCT_CARD_SELECT.replace(
  "categories:category_id (",
  "categories:category_id!inner ("
);

export const PRODUCT_LIST_SELECT_INNER_CATEGORY = PRODUCT_LIST_SELECT.replace(
  "categories:category_id (",
  "categories:category_id!inner ("
);

/*
 * ---------------------------------------------------------
 * MAPPING
 * ---------------------------------------------------------
 */

type Row = Record<string, unknown>;

/* Embedded relations arrive as an object or a single-item array. */
const firstRelation = (value: unknown): Row | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] as Row) ?? null;
  }

  return value as Row;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function mapProduct(row: Row): StorefrontProduct {
  const category = firstRelation(row.categories);

  const images = Array.isArray(row.product_images)
    ? (row.product_images as Row[])
        .filter((image) => Boolean(image?.image_url))
        .sort((a, b) => {
          /* Primary first, then display_order. */
          if (Boolean(a.is_primary) !== Boolean(b.is_primary)) {
            return a.is_primary ? -1 : 1;
          }

          return toNumber(a.display_order) - toNumber(b.display_order);
        })
        .map((image) => ({
          image_url: String(image.image_url),
          is_primary: Boolean(image.is_primary),
        }))
    : [];

  const variants = Array.isArray(row.product_variants)
    ? (row.product_variants as Row[]).map((variant) => ({
        id: String(variant.id),
        name: String(variant.name ?? ""),
        value: String(variant.value ?? ""),
        price_adjustment: toNumber(variant.price_adjustment),
        stock_quantity: toNumber(variant.stock_quantity),
      }))
    : [];

  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: (row.description as string | null) ?? null,
    price: toNumber(row.price),
    sale_price:
      row.sale_price === null || row.sale_price === undefined ? null : toNumber(row.sale_price),
    stock_quantity: toNumber(row.stock_quantity),
    featured: Boolean(row.featured),
    category_id: (row.category_id as string | null) ?? null,
    categories: category
      ? {
          id: (category.id as string | null) ?? null,
          name: (category.name as string | null) ?? null,
          slug: (category.slug as string | null) ?? null,
        }
      : null,
    product_images: images,
    product_variants: variants,
    hasVariants: variants.length > 0,
  };
}

/*
 * ---------------------------------------------------------
 * DERIVED VALUES
 * ---------------------------------------------------------
 */

/* The primary image, else the first one, else null. */
export const getPrimaryImage = (product: { product_images: ProductImage[] }): string | null =>
  product.product_images.find((image) => image.is_primary)?.image_url ??
  product.product_images[0]?.image_url ??
  null;

/*
 * A sale_price only counts when it is actually cheaper than
 * the list price.
 */
export const hasDiscount = (product: { price: number; sale_price: number | null }): boolean =>
  product.sale_price !== null && product.sale_price > 0 && product.sale_price < product.price;

export const getEffectivePrice = (product: { price: number; sale_price: number | null }): number =>
  hasDiscount(product) ? (product.sale_price as number) : product.price;

export const getDiscountPercent = (product: {
  price: number;
  sale_price: number | null;
}): number =>
  hasDiscount(product)
    ? Math.round(((product.price - (product.sale_price as number)) / product.price) * 100)
    : 0;

/*
 * Stock: a product with variants is in stock when any variant
 * is; otherwise the product-level quantity decides.
 */
export const isInStock = (product: {
  stock_quantity: number;
  product_variants: ProductVariant[];
}): boolean =>
  product.product_variants.length > 0
    ? product.product_variants.some((variant) => variant.stock_quantity > 0)
    : product.stock_quantity > 0;

/*
 * ---------------------------------------------------------
 * VARIANT GROUPING
 * ---------------------------------------------------------
 *
 * product_variants stores one row per option value, so "Size"
 * and "Color" are just different `name` values on the same
 * table. Group them to build one picker per attribute.
 */
export function groupVariants(variants: ProductVariant[]): VariantGroup[] {
  const groups = new Map<string, VariantGroup>();

  for (const variant of variants) {
    const name = variant.name.trim();

    if (!name || !variant.value.trim()) {
      continue;
    }

    const existing = groups.get(name.toLowerCase());

    if (existing) {
      existing.values.push(variant);
    } else {
      groups.set(name.toLowerCase(), { name, values: [variant] });
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    values: [...group.values].sort((a, b) => a.value.localeCompare(b.value)),
  }));
}

/*
 * ---------------------------------------------------------
 * QUERIES
 * ---------------------------------------------------------
 *
 * The featured strip, the related rail and the category grid
 * were each building the same select-map-filter pipeline by
 * hand. One reader with a filter object covers all three.
 */

export interface ProductQuery {
  featured?: boolean;
  categoryId?: string;
  /* Matches on the embedded category, which forces an inner join. */
  categorySlug?: string;
  /*
   * Any of several categories, for a department that has to
   * include its subcategories: products sit in "women-dresses",
   * never in "women", so filtering a department page by its own
   * slug alone matches nothing.
   */
  categorySlugs?: string[];
  /* Excludes the product currently on screen. */
  excludeId?: string;
  /* Discounted products only. */
  sale?: boolean;
  minPrice?: number;
  maxPrice?: number;
  pieceCount?: 2 | 3;
  /* Undefined leaves the ordering to PostgREST. */
  sort?: string;
  limit?: number;
  /* Rows to skip, for paging. Requires `limit`. */
  offset?: number;
  /* Fetch only the fields a card renders, not the full row. */
  cardsOnly?: boolean;
  /* Values a product must carry across its variants, e.g. ["M","black"]. */
  variantValues?: string[];
  /* Free text from the header search, matched on name and description. */
  search?: string;
  /*
   * Only products created within the last N months. Sorting by
   * "newest" orders the catalogue but narrows nothing, so
   * without this /new-arrivals was the whole catalogue in date
   * order - the oldest product in the shop was a "new arrival",
   * it was just last.
   */
  newWithinMonths?: number;
}

/* What the storefront treats as a new arrival. */
export const NEW_ARRIVAL_MONTHS = 3;

/*
 * PostgREST reads , . : ( ) as syntax inside an or() filter, and a bare %
 * would widen the pattern, so anything the shopper typed is stripped of them
 * rather than passed through.
 */
const escapeSearchTerm = (term: string): string =>
  term
    .replace(/[,.:()%\\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* A shopper typing five words should not be able to build a
   five-way join by accident. */
const MAX_SEARCH_TOKENS = 6;

/*
 * The search the header box runs.
 *
 * It used to be one `%whole query%` against name and
 * description, which only ever matched a contiguous substring:
 * "silk dress" found nothing at all against "Mahnoor Silk Slip
 * Dress", because those two words are not adjacent in it. Any
 * two-word search that was not a literal phrase returned an
 * empty page.
 *
 * The query is now split into words, and a product has to match
 * every one of them somewhere - so word order stops mattering
 * and "dress silk" finds the same thing "silk dress" does.
 *
 * Shape: or(name~w1, desc~w1) AND or(name~w2, desc~w2) ...
 * Each ILIKE is an infix match, which is what the pg_trgm GIN
 * indexes from migrations/001 exist to serve - without them
 * this is a sequential scan per token.
 */
function applySearch(query: ProductQueryBuilder, search: string): void {
  const tokens = escapeSearchTerm(search).split(" ").filter(Boolean).slice(0, MAX_SEARCH_TOKENS);

  if (tokens.length === 0) {
    return;
  }

  /*
   * One or() per token. Separate top-level filters are ANDed by
   * PostgREST, so this reads as "matches every word" without an
   * and() wrapper - which supabase-js does not expose anyway.
   */
  for (const token of tokens) {
    query.or(`name.ilike.*${token}*,description.ilike.*${token}*`);
  }
}

/*
 * `!inner` on categories matters here: without it PostgREST
 * filters the embedded row rather than the parent.
 */
const selectProducts = (
  categorySlug?: string,
  cardsOnly = false,
  count = false,
  client: Client = createClient()
) => {
  const columns = cardsOnly
    ? categorySlug
      ? PRODUCT_CARD_SELECT_INNER_CATEGORY
      : PRODUCT_CARD_SELECT
    : categorySlug
      ? PRODUCT_LIST_SELECT_INNER_CATEGORY
      : PRODUCT_LIST_SELECT;

  return client.from("products").select(columns, count ? { count: "exact" } : undefined);
};

type ProductQueryBuilder = ReturnType<typeof selectProducts>;

/*
 * The schema has no sales counters, so "best-selling" and
 * "trending" fall back to the `featured` flag rather than
 * pretending to rank by orders.
 */
const applySort = (query: ProductQueryBuilder, sort: string): void => {
  switch (sort) {
    case "price-asc":
      query.order("price", { ascending: true });
      break;
    case "price-desc":
      query.order("price", { ascending: false });
      break;
    case "newest":
      query.order("created_at", { ascending: false });
      break;
    case "discount-desc":
      /*
       * Ordering by discount is a computed percentage, which
       * PostgREST cannot sort on, so the ranking happens after
       * the rows come back. This case used to apply a
       * `sale_price is not null` filter and no ordering at all
       * - a sort that silently deleted every product without a
       * discount from whatever list you were looking at.
       */
      query.order("sale_price", { ascending: true, nullsFirst: false });
      break;
    default:
      query.order("featured", { ascending: false }).order("created_at", { ascending: false });
  }
};

/*
 * Product ids carrying every one of the wanted variant values.
 *
 * "Size M AND black" spans two product_variants rows, which a
 * single PostgREST filter cannot express, so this resolves the
 * ids first and the main query narrows to them. It used to be
 * done in JS *after* the row limit, which meant a filtered page
 * was "the M products among the first 24" rather than the first
 * 24 M products - a mostly empty page while matches sat
 * unfetched. Paging made that worse, so it moved server-side.
 */
/* What a size or colour may contain: letters, digits, spaces, hyphens. */
const VARIANT_VALUE = /^[a-z0-9 -]+$/i;

async function idsWithAllVariants(values: string[], client: Client): Promise<string[]> {
  /*
   * One query, not one per value. This used to fire a query per
   * selected value in parallel - correct, and one round trip's
   * latency, but N connections and N result sets for something
   * a single request answers. The grouping the intersection
   * needs is cheap to do here.
   *
   * `or` of ilike, not `in`: the URL carries whatever the
   * shopper's link had ("m", "M", "Black"), and the column
   * stores one particular casing. `in` is case-sensitive and
   * would silently match nothing.
   *
   * The values are sanitised first because, unlike a normal
   * filter, `or` is a single string PostgREST parses - a comma
   * or a bracket inside a value would break out of the
   * expression. Sizes and colours are letters, digits, spaces
   * and hyphens; anything else is not a value we store.
   */
  const safe = values.map((value) => value.trim()).filter(Boolean);

  /*
   * Validated, not sanitised.
   *
   * Stripping the offending characters looked safe and was not:
   * "bl,ack)" quietly became "black" and matched products the
   * shopper never asked for, because the array was still the
   * same length. A value that is not what we store is a bad
   * request, so the whole filter is refused rather than
   * silently rewritten into a different one.
   */
  if (safe.length === 0 || !safe.every((value) => VARIANT_VALUE.test(value))) {
    return [];
  }

  const { data, error } = await client
    .from("product_variants")
    .select("product_id, value")
    .or(safe.map((value) => `value.ilike.${value}`).join(","));

  if (error) {
    throw error;
  }

  /* Product id -> which of the wanted values it carries. */
  const carried = new Map<string, Set<string>>();

  /* Matched case-insensitively, as the ilike it replaces did. */
  const wanted = new Map(values.map((value) => [value.toLowerCase(), value]));

  for (const row of data ?? []) {
    const productId = row.product_id as string | null;
    const value = wanted.get(String(row.value ?? "").toLowerCase());

    if (!productId || !value) {
      continue;
    }

    const seen = carried.get(productId) ?? new Set<string>();

    seen.add(value);
    carried.set(productId, seen);
  }

  /* Every value must be present, so intersect rather than union. */
  return [...carried.entries()]
    .filter(([, seen]) => seen.size === values.length)
    .map(([productId]) => productId);
}

export async function fetchStorefrontProducts(
  options: ProductQuery = {},
  client: Client = createClient()
): Promise<StorefrontProduct[]> {
  return (await fetchStorefrontProductPage(options, false, client)).products;
}

/*
 * Rows per listing page.
 *
 * Shared deliberately: it is part of the React Query cache key,
 * so if the server preloads a different number than the grid
 * asks for, the seed lands on a key nobody reads and every
 * visitor quietly pays for the query again. One constant makes
 * that impossible rather than merely unlikely.
 */
export const LISTING_PAGE_SIZE = 24;

/*
 * Rows in a department landing page's preview rail. Shared for
 * the same reason as the constant above: it is part of the
 * cache key the preview's hook computes.
 */
export const DEPARTMENT_SECTION_SIZE = 8;

export interface ProductPage {
  products: StorefrontProduct[];
  /* Rows matching the filters, ignoring limit/offset. */
  total: number | null;
}

export async function fetchStorefrontProductPage(
  options: ProductQuery = {},
  withCount = false,
  /*
   * Injectable so a server component can hand in the anonymous
   * server client - the module default is the browser one.
   */
  client: Client = createClient()
): Promise<ProductPage> {
  /*
   * An empty list means "no categories", which can only match
   * nothing - returning early beats sending `in.()` to
   * PostgREST, which is a syntax error.
   */
  if (options.categorySlugs?.length === 0) {
    return { products: [], total: 0 };
  }

  const query = selectProducts(
    options.categorySlug ?? options.categorySlugs?.[0],
    options.cardsOnly,
    withCount,
    client
  );

  if (options.featured !== undefined) {
    query.eq("featured", options.featured);
  }

  if (options.categorySlug) {
    query.eq("categories.slug", options.categorySlug);
  }

  if (options.categorySlugs?.length) {
    query.in("categories.slug", options.categorySlugs);
  }

  if (options.categoryId) {
    query.eq("category_id", options.categoryId);
  }

  if (options.excludeId) {
    query.neq("id", options.excludeId);
  }

  const wantedVariants = (options.variantValues ?? []).map((value) => value.trim()).filter(Boolean);

  if (wantedVariants.length > 0) {
    const ids = await idsWithAllVariants(wantedVariants, client);

    if (ids.length === 0) {
      return { products: [], total: 0 };
    }

    query.in("id", ids);
  }

  /*
   * A row only counts as on sale when its sale_price actually
   * undercuts its price - which is what hasDiscount says, and
   * what the card renders a "% off" badge from. PostgREST
   * cannot compare two columns, so the query narrows on what
   * it can and the price comparison runs below.
   */
  if (options.sale) {
    query.not("sale_price", "is", null);
    query.gt("sale_price", 0);
  }

  if (options.search) {
    applySearch(query, options.search);
  }

  /*
   * Computed per query rather than passed in from a page: a
   * statically rendered page would otherwise bake the cutoff in
   * at build time and drift further out of date every day.
   */
  if (options.newWithinMonths !== undefined) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - options.newWithinMonths);
    query.gte("created_at", cutoff.toISOString());
  }

  if (options.minPrice !== undefined) {
    query.gte("price", options.minPrice);
  }

  if (options.maxPrice !== undefined) {
    query.lte("price", options.maxPrice);
  }

  if (options.pieceCount !== undefined) {
    query.eq("piece_count", options.pieceCount);
  }

  if (options.sort !== undefined) {
    applySort(query, options.sort);
  }

  /*
   * A stable tiebreaker. Without one, Postgres may return rows
   * in a different order for two queries with equal sort keys,
   * which for a paged list means a product appearing on two
   * pages or on none.
   */
  query.order("id", { ascending: true });

  /*
   * range() is inclusive at both ends, and is what makes paging
   * possible at all: limit() alone can only ever return the
   * first N rows, which is why nothing past the 24th product
   * was reachable.
   */
  if (options.limit !== undefined) {
    const from = options.offset ?? 0;
    query.range(from, from + options.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const products = ((data ?? []) as unknown as Row[]).map(mapProduct);

  /*
   * The remaining post-filter: a row whose sale_price is set but
   * no cheaper than its price is not a discount by any measure
   * the storefront uses, and comparing two columns is the one
   * thing the query above cannot do. It can only ever remove
   * rows the sale filter already matched, so the count is
   * adjusted rather than reported as-is.
   */
  const filtered = options.sale ? products.filter(hasDiscount) : products;

  /*
   * Discount ordering is a computed percentage, which PostgREST
   * cannot sort on. The query orders by sale_price so the page
   * is at least drawn from the deepest discounts; this ranks
   * what came back. Ordering it properly needs a stored
   * discount column - see migrations/001.
   */
  if (options.sort === "discount-desc") {
    filtered.sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a));
  }

  return {
    products: filtered,
    total:
      count === null || count === undefined ? null : count - (products.length - filtered.length),
  };
}

/*
 * Current primary image per product id.
 *
 * The cart stores a copy of the image URL at the moment the
 * item was added, which is a snapshot that rots: a line added
 * before the product had a photo keeps showing the placeholder
 * even after one is uploaded, and a line whose photo the admin
 * has since replaced points at a file that may be gone. The
 * cart and checkout resolve the live image through this and
 * keep the stored URL only as a fallback.
 */
export async function fetchProductImages(
  ids: string[],
  client: Client = createClient()
): Promise<Record<string, string>> {
  if (ids.length === 0) {
    return {};
  }

  const { data, error } = await client
    .from("products")
    .select("id, product_images (image_url, is_primary, display_order)")
    .in("id", ids);

  if (error) {
    throw error;
  }

  const images: Record<string, string> = {};

  for (const row of (data ?? []) as unknown as Row[]) {
    /* mapProduct already knows which image is the primary one. */
    const primary = getPrimaryImage(mapProduct(row));

    if (primary) {
      images[String(row.id)] = primary;
    }
  }

  return images;
}

/* One product with everything the detail page renders. */
export async function fetchProductBySlug(
  slug: string,
  client: Client = createClient()
): Promise<StorefrontProduct | null> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_LIST_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProduct(data as unknown as Row) : null;
}

export async function countProducts(): Promise<number> {
  const { count, error } = await createClient()
    .from("products")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

/*
 * The filter sidebar offers only option values that actually
 * exist, collapsed to one entry per name/value pair.
 */
export async function fetchVariantOptions(
  client: Client = createClient()
): Promise<VariantGroup[]> {
  /*
   * list_variant_options (migrations/012) returns one row per
   * distinct name/value. This used to select every row of
   * product_variants and reduce them here - roughly 1,100 rows
   * to produce 25 options once the catalogue has a hundred
   * products in it.
   */
  const { data, error } = await client.rpc("list_variant_options");

  if (error) {
    if (isMissingFunction(error)) {
      /*
       * The migration has not been run. A shop with no filter
       * options still sells; the rail hides itself.
       */
      return [];
    }

    throw error;
  }

  return groupVariants(
    (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      value: String(row.value ?? ""),
      price_adjustment: toNumber(row.price_adjustment),
      stock_quantity: toNumber(row.stock_quantity),
    }))
  );
}
