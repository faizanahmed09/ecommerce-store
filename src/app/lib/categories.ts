/*
 * ---------------------------------------------------------
 * CATEGORY QUERIES
 * ---------------------------------------------------------
 *
 * The `categories` table was being queried from six places
 * with five slightly different projections. One select and a
 * handful of named readers keep the storefront and the admin
 * looking at the same shape.
 *
 * Mirrors schema.sql: categories (name, slug, description,
 * parent_id, image_url, is_enabled).
 */

import { createClient } from "@/src/app/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/app/lib/supabase/database.types";
import { revalidateCategories, revalidateProducts } from "@/src/app/lib/revalidate";

/*
 * Reads default to the browser client. Server components pass
 * their own (lib/supabase/server) so they do not reach for the
 * singleton meant for the browser.
 */
type Client = SupabaseClient<Database>;

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  is_enabled: boolean;
}

/* Select * also works before migration 016 is applied, when is_enabled is absent. */
export const CATEGORY_SELECT = "*";

type CategoryRow = Record<string, unknown>;

const mapCategory = (row: CategoryRow): CategoryRecord => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  slug: String(row.slug ?? ""),
  description: (row.description as string | null) ?? null,
  parent_id: (row.parent_id as string | null) ?? null,
  image_url: (row.image_url as string | null) ?? null,
  is_enabled: row.is_enabled !== false,
});

/* Every category, alphabetical - the admin list and pickers. */
export async function fetchCategories(client: Client = createClient()): Promise<CategoryRecord[]> {
  const { data, error } = await client
    .from("categories")
    .select(CATEGORY_SELECT)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCategory);
}

/* Top-level categories only - the storefront showcase. */
export async function fetchRootCategories(
  limit?: number,
  client: Client = createClient()
): Promise<CategoryRecord[]> {
  const query = client
    .from("categories")
    .select(CATEGORY_SELECT)
    .is("parent_id", null)
    .order("name", { ascending: true });

  const { data, error } = await (limit ? query.limit(limit) : query);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCategory);
}

/*
 * The children of one department, for its landing page grid.
 *
 * Returns [] when the department itself is not in the table -
 * a store that has no Footwear category should show no
 * Footwear tiles, rather than six links to nothing.
 */
export async function fetchCategoryChildren(
  parentSlug: string,
  client: Client = createClient()
): Promise<CategoryRecord[]> {
  const { data: parent, error: parentError } = await client
    .from("categories")
    .select("id")
    .eq("slug", parentSlug)
    .maybeSingle();

  if (parentError) {
    throw parentError;
  }

  if (!parent) {
    return [];
  }

  const { data, error } = await client
    .from("categories")
    .select(CATEGORY_SELECT)
    .eq("parent_id", parent.id)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCategory);
}

/* Single row by id - used to resolve a child's parent slug. */
export async function fetchCategoryById(
  id: string,
  client: Client = createClient()
): Promise<CategoryRecord | null> {
  const { data, error } = await client
    .from("categories")
    .select(CATEGORY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCategory(data) : null;
}

/* Slug lookup for the category landing pages. */
export async function fetchCategoriesBySlugs(
  slugs: string[],
  client: Client = createClient()
): Promise<CategoryRecord[]> {
  if (slugs.length === 0) {
    return [];
  }

  const { data, error } = await client.from("categories").select(CATEGORY_SELECT).in("slug", slugs);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCategory);
}

/*
 * Row count only. Doubles as the admin's database health probe:
 * an empty table is still a healthy connection, so only an
 * error means offline.
 */
export async function countCategories(): Promise<number> {
  const { count, error } = await createClient()
    .from("categories")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

/*
 * ---------------------------------------------------------
 * WRITES (admin)
 * ---------------------------------------------------------
 */

export interface CategoryPayload {
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
}

export async function createCategory(payload: CategoryPayload): Promise<void> {
  const { error } = await createClient().from("categories").insert(payload);

  if (error) {
    throw error;
  }

  /* Departments and their children are cached on the storefront. */
  await revalidateCategories();
}

export async function updateCategory(categoryId: string, payload: CategoryPayload): Promise<void> {
  const { error } = await createClient().from("categories").update(payload).eq("id", categoryId);

  if (error) {
    throw error;
  }

  /* Moving a category can also change which products are public. */
  await Promise.all([revalidateCategories(), revalidateProducts()]);
}

export async function setCategoryEnabled(categoryId: string, isEnabled: boolean): Promise<void> {
  const { error } = await createClient()
    .from("categories")
    .update({ is_enabled: isEnabled })
    .eq("id", categoryId);

  if (error) {
    throw error;
  }

  /* Product visibility changes with the category, so clear both caches. */
  await Promise.all([revalidateCategories(), revalidateProducts()]);
}
