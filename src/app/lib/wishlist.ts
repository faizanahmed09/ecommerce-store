/*
 * ---------------------------------------------------------
 * WISHLIST QUERIES
 * ---------------------------------------------------------
 *
 * The account Wishlist tab could read and empty a wishlist,
 * but nothing in the app could ever put something in one - the
 * heart on the product page was local component state that
 * forgot itself on navigation. These are the reads and writes
 * behind a wishlist that actually persists.
 *
 * Mirrors schema.sql: wishlists (user_id), wishlist_items
 * (wishlist_id, product_id).
 */

import { createClient } from "@/src/app/lib/supabase/client";

export interface WishlistProductImage {
  image_url: string;
  is_primary: boolean;
}

export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  /* Read so the wishlist can cap what it adds to the cart. */
  stock_quantity: number;
  product_images: WishlistProductImage[];
}

export interface WishlistItem {
  id: string;
  product_id: string;
  products: WishlistProduct;
}

const WISHLIST_ITEM_SELECT = `
  id,
  product_id,
  products:product_id (
    id,
    name,
    slug,
    price,
    sale_price,
    stock_quantity,
    product_images (
      image_url,
      is_primary
    )
  )
`;

/* PostgREST's code for "no rows", which is not an error here. */
const NO_ROWS = "PGRST116";

/** The shopper's wishlist id, or null if they have never saved anything. */
export async function fetchWishlistId(userId: string): Promise<string | null> {
  const { data, error } = await createClient()
    .from("wishlists")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== NO_ROWS) {
    throw error;
  }

  return (data?.id as string | undefined) ?? null;
}

/*
 * A wishlist row is created the first time something is saved,
 * so most shoppers never have one. Adding is the only caller
 * that needs it to exist.
 */
async function ensureWishlist(userId: string): Promise<string> {
  const existing = await fetchWishlistId(userId);

  if (existing) {
    return existing;
  }

  const { data, error } = await createClient()
    .from("wishlists")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function fetchWishlistItems(userId: string): Promise<WishlistItem[]> {
  const wishlistId = await fetchWishlistId(userId);

  if (!wishlistId) {
    return [];
  }

  const { data, error } = await createClient()
    .from("wishlist_items")
    .select(WISHLIST_ITEM_SELECT)
    .eq("wishlist_id", wishlistId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as WishlistItem[];
}

/*
 * Just the product ids, for deciding whether a heart is filled.
 * The product page needs the answer for one product, but asking
 * for the set costs the same round trip and lets a listing ask
 * about many.
 */
export async function fetchWishlistProductIds(userId: string): Promise<Set<string>> {
  const wishlistId = await fetchWishlistId(userId);

  if (!wishlistId) {
    return new Set();
  }

  const { data, error } = await createClient()
    .from("wishlist_items")
    .select("product_id")
    .eq("wishlist_id", wishlistId);

  if (error) {
    throw error;
  }

  return new Set(
    (data ?? [])
      .map((row) => row.product_id as string | null)
      .filter((id): id is string => Boolean(id))
  );
}

/*
 * Saving something already saved is a no-op rather than an
 * error: the heart is a toggle, and clicking it twice must not
 * read as a failure.
 *
 * The database is what actually guarantees one row per product
 * - schema.sql creates a unique index on (wishlist_id,
 * product_id), which is what settles two clicks racing each
 * other. This check only turns the second one into a quiet
 * no-op instead of a constraint violation surfacing as an
 * error toast. Do not read it as the uniqueness guarantee.
 */
export async function addToWishlist(userId: string, productId: string): Promise<void> {
  const wishlistId = await ensureWishlist(userId);

  const { data: existing, error: existingError } = await createClient()
    .from("wishlist_items")
    .select("id")
    .eq("wishlist_id", wishlistId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existingError && existingError.code !== NO_ROWS) {
    throw existingError;
  }

  if (existing) {
    return;
  }

  const { error } = await createClient()
    .from("wishlist_items")
    .insert({ wishlist_id: wishlistId, product_id: productId });

  if (error) {
    throw error;
  }
}

/** Removes by product, for the toggle on the product page. */
export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  const wishlistId = await fetchWishlistId(userId);

  if (!wishlistId) {
    return;
  }

  const { error } = await createClient()
    .from("wishlist_items")
    .delete()
    .eq("wishlist_id", wishlistId)
    .eq("product_id", productId);

  if (error) {
    throw error;
  }
}

/** Removes by row id, for the delete button on the account tab. */
export async function removeWishlistItem(itemId: string): Promise<void> {
  const { error } = await createClient().from("wishlist_items").delete().eq("id", itemId);

  if (error) {
    throw error;
  }
}
