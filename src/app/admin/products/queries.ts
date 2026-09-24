/*
 * ---------------------------------------------------------
 * PRODUCT DATA ACCESS
 * ---------------------------------------------------------
 *
 * Every Supabase call the Products screen makes lives here.
 * The functions throw on failure and return plain data, so
 * the React layer only deals with state and toasts.
 */

import { createClient } from "@/src/app/lib/supabase/client";
import { removeImage } from "../lib/storage";
import type { Product, ProductImage, ProductPayload, ProductVariant } from "./types";
import { revalidateProducts } from "@/src/app/lib/revalidate";

const PRODUCT_SELECT = `
  id,
  name,
  slug,
  description,
  price,
  sale_price,
  stock_quantity,
  category_id,
  featured,
  categories:category_id (
    name,
    slug
  ),
  product_images (
    id,
    image_url,
    is_primary,
    display_order
  ),
  product_variants (
    id,
    name,
    value,
    price_adjustment,
    stock_quantity
  )
`;

/*
 * Supabase returns numeric columns as strings for some driver
 * configurations, so every number goes through Number().
 */
type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  sale_price: number | string | null;
  stock_quantity: number | string;
  category_id: string | null;
  featured: boolean | null;
  categories: { name?: string; slug?: string } | { name?: string; slug?: string }[] | null;
  product_images:
    | {
        id?: string;
        image_url: string;
        is_primary: boolean | null;
        display_order: number | string | null;
      }[]
    | null;
  product_variants:
    | {
        id?: string;
        name: string;
        value: string;
        price_adjustment: number | string | null;
        stock_quantity: number | string | null;
      }[]
    | null;
};

const normaliseProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description ?? null,
  price: Number(row.price),
  sale_price:
    row.sale_price === null || row.sale_price === undefined ? null : Number(row.sale_price),
  stock_quantity: Number(row.stock_quantity),
  category_id: row.category_id,
  featured: Boolean(row.featured),

  categories:
    row.categories && !Array.isArray(row.categories)
      ? {
          name: row.categories.name ?? "",
          slug: row.categories.slug ?? "",
        }
      : null,

  /*
   * Sorted the way the storefront reads them (lib/products.ts): the primary
   * first, then display_order. The admin gallery is that same list, so the
   * order shown while editing is the order shoppers see.
   */
  product_images: Array.isArray(row.product_images)
    ? row.product_images
        .map((image) => ({
          id: image.id,
          image_url: image.image_url,
          is_primary: Boolean(image.is_primary),
          display_order: Number(image.display_order ?? 0),
        }))
        .sort((a, b) => {
          if (a.is_primary !== b.is_primary) {
            return a.is_primary ? -1 : 1;
          }

          return a.display_order - b.display_order;
        })
    : [],

  product_variants: Array.isArray(row.product_variants)
    ? row.product_variants
        .map((variant) => ({
          id: variant.id,
          name: variant.name ?? "",
          value: variant.value ?? "",
          price_adjustment: Number(variant.price_adjustment ?? 0),
          stock_quantity: Number(variant.stock_quantity ?? 0),
        }))
        /* Grouped by option name so the sheet lists Size rows together. */
        .sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value))
    : [],
});

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await createClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as ProductRow[]).map(normaliseProduct);
}

/* What the sheet hands over once uploads have resolved to urls. */
export type ImageInput = Omit<ProductImage, "id"> & { id?: string };
export type VariantInput = Omit<ProductVariant, "id"> & { id?: string };

/*
 * Replaces a product's gallery with `images`, in the order given.
 *
 * Rows the admin removed are deleted, rows that survived are updated in place
 * (so display_order and the primary flag follow the list), and new entries are
 * inserted. Returns the urls whose rows are gone, for bucket cleanup.
 */
async function saveProductImages(productId: string, images: ImageInput[]): Promise<string[]> {
  const supabase = createClient();

  const { data: existing, error: selectError } = await supabase
    .from("product_images")
    .select("id, image_url")
    .eq("product_id", productId);

  if (selectError) {
    throw selectError;
  }

  const keptIds = new Set(images.map((image) => image.id).filter(Boolean));

  const removed = (existing ?? []).filter((row) => !keptIds.has(row.id));

  if (removed.length > 0) {
    const { error } = await supabase
      .from("product_images")
      .delete()
      .in(
        "id",
        removed.map((row) => row.id)
      );

    if (error) {
      throw error;
    }
  }

  /*
   * Two writes, whatever the gallery holds.
   *
   * This used to be a loop issuing one update or insert per
   * image - a product with five photographs meant five
   * sequential round trips to Singapore, on the admin's own
   * save button, for rows that have nothing to do with each
   * other. Split by whether the row already exists and sent as
   * two arrays, the count no longer matters.
   *
   * They stay separate rather than becoming one upsert because
   * PostgREST requires every object in a batch to carry the
   * same keys, and a new row has no id to carry.
   */
  const existingRows = images
    .filter((image) => image.id)
    .map((image) => ({
      id: image.id as string,
      product_id: productId,
      image_url: image.image_url,
      is_primary: image.is_primary,
      display_order: image.display_order,
    }));

  const newRows = images
    .filter((image) => !image.id)
    .map((image) => ({
      product_id: productId,
      image_url: image.image_url,
      is_primary: image.is_primary,
      display_order: image.display_order,
    }));

  if (existingRows.length > 0) {
    const { error } = await supabase.from("product_images").upsert(existingRows);

    if (error) {
      throw error;
    }
  }

  if (newRows.length > 0) {
    const { error } = await supabase.from("product_images").insert(newRows);

    if (error) {
      throw error;
    }
  }

  return removed.map((row) => row.image_url);
}

/*
 * Same diff for product_variants.
 *
 * A variant that an order line points at cannot be deleted - order_items
 * .product_variant_id has no ON DELETE rule - so that failure is translated
 * into something an admin can act on instead of a raw FK error.
 */
async function saveProductVariants(productId: string, variants: VariantInput[]): Promise<void> {
  const supabase = createClient();

  const { data: existing, error: selectError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);

  if (selectError) {
    throw selectError;
  }

  const keptIds = new Set(variants.map((variant) => variant.id).filter(Boolean));

  const removedIds = (existing ?? []).map((row) => row.id).filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase.from("product_variants").delete().in("id", removedIds);

    if (error) {
      /* 23503: an order line still references one of these variants. */
      if ((error as { code?: string }).code === "23503") {
        throw new Error(
          "That variant cannot be removed because it appears on an existing order. " +
            "Set its stock to 0 instead so it stops being offered."
        );
      }

      throw error;
    }
  }

  /* Two writes, however many options the product has. */
  const existingRows = variants
    .filter((variant) => variant.id)
    .map((variant) => ({
      id: variant.id as string,
      product_id: productId,
      name: variant.name,
      value: variant.value,
      price_adjustment: variant.price_adjustment,
      stock_quantity: variant.stock_quantity,
    }));

  const newRows = variants
    .filter((variant) => !variant.id)
    .map((variant) => ({
      product_id: productId,
      name: variant.name,
      value: variant.value,
      price_adjustment: variant.price_adjustment,
      stock_quantity: variant.stock_quantity,
    }));

  if (existingRows.length > 0) {
    const { error } = await supabase.from("product_variants").upsert(existingRows);

    if (error) {
      throw error;
    }
  }

  if (newRows.length > 0) {
    const { error } = await supabase.from("product_variants").insert(newRows);

    if (error) {
      throw error;
    }
  }
}

export async function updateProduct(
  productId: string,
  payload: ProductPayload,
  images: ImageInput[],
  variants: VariantInput[]
): Promise<string[]> {
  const { error } = await createClient().from("products").update(payload).eq("id", productId);

  if (error) {
    throw error;
  }

  const orphanedUrls = await saveProductImages(productId, images);

  await saveProductVariants(productId, variants);

  /* The storefront's cached catalogue is now out of date. */
  await revalidateProducts();

  return orphanedUrls;
}

export async function createProduct(
  payload: ProductPayload,
  images: ImageInput[],
  variants: VariantInput[]
): Promise<void> {
  const supabase = createClient();

  const { data: newProduct, error } = await supabase
    .from("products")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  if (!newProduct) {
    throw new Error("Product was created but no product ID was returned.");
  }

  /*
   * The product row already exists at this point; throwing makes a failed
   * child write visible instead of silent.
   */
  await saveProductImages(newProduct.id, images);
  await saveProductVariants(newProduct.id, variants);

  /* The storefront's cached catalogue is now out of date. */
  await revalidateProducts();
}

export async function deleteProduct(productId: string): Promise<void> {
  const supabase = createClient();

  /* Read the URLs before the rows that hold them are gone. */
  const { data: images, error: selectError } = await supabase
    .from("product_images")
    .select("image_url")
    .eq("product_id", productId);

  if (selectError) {
    throw selectError;
  }

  /* Images first, in case the FK has no ON DELETE CASCADE. */
  const { error: imageError } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", productId);

  if (imageError) {
    throw imageError;
  }

  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    throw error;
  }

  /*
   * Only once the product is really gone: the uploads it owned
   * would otherwise sit in the bucket forever. Best-effort, and
   * a no-op for images hosted anywhere but our bucket.
   */
  for (const image of images ?? []) {
    await removeImage(image.image_url);
  }

  /* The storefront's cached catalogue is now out of date. */
  await revalidateProducts();
}
