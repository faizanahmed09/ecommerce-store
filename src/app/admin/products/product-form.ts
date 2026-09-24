/*
 * ---------------------------------------------------------
 * PRODUCT FORM VALUES + VALIDATION
 * ---------------------------------------------------------
 *
 * Pure form logic: no React, no network. The sheet holds the
 * values in state and calls validateProductForm on submit; the
 * picked file is checked against the same bucket rules the
 * uploader enforces.
 */

import { generateSlug } from "@/src/app/lib/utils";
import { validateImageFile } from "../lib/storage";
import type { Product, ProductImage, ProductPayload, ProductVariant } from "./types";

/*
 * A gallery row being edited. `url` is empty while `file` is still pending -
 * the upload happens on submit, so an abandoned sheet leaves nothing behind.
 */
export interface ProductFormImage {
  /* Stable React key: a new row has no id to identify it by. */
  key: string;
  /* The product_images row id, or null for one added in this sheet. */
  id: string | null;
  url: string;
  file: File | null;
  isPrimary: boolean;
}

/* A product_variants row being edited. Numbers stay strings until validated. */
export interface ProductFormVariant {
  key: string;
  id: string | null;
  name: string;
  value: string;
  priceAdjustment: string;
  stock: string;
}

export interface ProductFormValues {
  name: string;
  slug: string;
  description: string;
  price: string;
  salePrice: string;
  stock: string;
  categoryId: string;
  featured: boolean;
  /* Ordered: position in this list becomes display_order. */
  images: ProductFormImage[];
  variants: ProductFormVariant[];
}

let localKey = 0;

/* Rows added in the sheet have no id yet, so the list needs its own React key. */
export const nextLocalKey = (): string => `local-${(localKey += 1)}`;

export const emptyFormImage = (): ProductFormImage => ({
  key: nextLocalKey(),
  id: null,
  url: "",
  file: null,
  isPrimary: false,
});

export const emptyFormVariant = (): ProductFormVariant => ({
  key: nextLocalKey(),
  id: null,
  name: "",
  value: "",
  priceAdjustment: "0",
  stock: "0",
});

export const emptyProductForm = (categoryId = ""): ProductFormValues => ({
  name: "",
  slug: "",
  description: "",
  price: "",
  salePrice: "",
  stock: "",
  categoryId,
  featured: false,
  images: [],
  variants: [],
});

export const productFormValues = (product: Product): ProductFormValues => ({
  name: product.name,
  slug: product.slug,
  description: product.description ?? "",
  price: String(product.price),
  salePrice: product.sale_price !== null ? String(product.sale_price) : "",
  stock: String(product.stock_quantity),
  categoryId: product.category_id ?? "",
  featured: product.featured,
  images: product.product_images.map((image) => ({
    key: image.id ?? nextLocalKey(),
    id: image.id ?? null,
    url: image.image_url,
    file: null,
    isPrimary: image.is_primary,
  })),
  variants: product.product_variants.map((variant) => ({
    key: variant.id ?? nextLocalKey(),
    id: variant.id ?? null,
    name: variant.name,
    value: variant.value,
    priceAdjustment: String(variant.price_adjustment),
    stock: String(variant.stock_quantity),
  })),
});

export interface ValidationError {
  title: string;
  description: string;
}

/*
 * What the sheet needs in order to save: the products row, plus the child
 * rows for product_images and product_variants. Image urls are still blank
 * for entries whose file has yet to be uploaded; the sheet fills them in.
 */
export interface ValidatedProduct {
  payload: ProductPayload;
  images: (Omit<ProductImage, "image_url"> & { image_url: string; file: File | null })[];
  variants: ProductVariant[];
}

type ValidationResult =
  | (ValidatedProduct & { error?: never })
  | { payload?: never; images?: never; variants?: never; error: ValidationError };

const invalid = (title: string, description: string): ValidationResult => ({
  error: { title, description },
});

export function validateProductForm(
  values: ProductFormValues,
  /* Used to reject a slug another product already owns. */
  existingProducts: Pick<Product, "id" | "slug">[],
  editingProductId: string | null
): ValidationResult {
  const name = values.name.trim();
  const slug = values.slug.trim().toLowerCase();

  if (!name) {
    return invalid("Product name required", "Please enter a product name.");
  }

  if (!slug) {
    return invalid("Product slug required", "Please enter a product slug.");
  }

  if (!values.categoryId) {
    return invalid("Category required", "Please select a category.");
  }

  const price = Number.parseFloat(values.price);

  if (!Number.isFinite(price) || price < 0) {
    return invalid("Invalid price", "Price must be a valid number greater than or equal to 0.");
  }

  const stock = Number.parseInt(values.stock, 10);

  if (!Number.isInteger(stock) || stock < 0) {
    return invalid(
      "Invalid stock",
      "Stock quantity must be a whole number greater than or equal to 0."
    );
  }

  let salePrice: number | null = null;

  if (values.salePrice.trim() !== "") {
    salePrice = Number.parseFloat(values.salePrice);

    if (!Number.isFinite(salePrice) || salePrice < 0) {
      return invalid("Invalid sale price", "Sale price must be a valid number.");
    }

    if (salePrice > price) {
      return invalid("Invalid sale price", "Sale price cannot be greater than the regular price.");
    }
  }

  /*
   * Rows with neither a saved url nor a pending file are blank placeholders
   * the admin never filled in; they are dropped rather than rejected.
   */
  const imageRows = values.images.filter((image) => image.url.trim() || image.file);

  for (const image of imageRows) {
    if (!image.file) {
      continue;
    }

    const imageError = validateImageFile(image.file);

    if (imageError) {
      return invalid("Invalid image", imageError);
    }
  }

  /*
   * The storefront falls back to the first image when nothing is flagged, but
   * writing the flag keeps the gallery order stable across reloads.
   */
  const primaryIndex = imageRows.findIndex((image) => image.isPrimary);
  const effectivePrimary = primaryIndex === -1 ? 0 : primaryIndex;

  const images = imageRows.map((image, index) => ({
    id: image.id ?? undefined,
    image_url: image.url.trim(),
    file: image.file,
    is_primary: index === effectivePrimary,
    display_order: index,
  }));

  const variantRows = values.variants.filter(
    (variant) => variant.name.trim() || variant.value.trim()
  );

  const variants: ProductVariant[] = [];
  const seen = new Set<string>();

  for (const variant of variantRows) {
    const variantName = variant.name.trim();
    const variantValue = variant.value.trim();

    if (!variantName || !variantValue) {
      return invalid(
        "Incomplete variant",
        "Every variant needs both an option name (e.g. Size) and a value (e.g. Medium)."
      );
    }

    /*
     * The storefront groups pickers by name, so two rows sharing a name and
     * value would render as one duplicated choice.
     */
    const key = `${variantName.toLowerCase()}\u0000${variantValue.toLowerCase()}`;

    if (seen.has(key)) {
      return invalid(
        "Duplicate variant",
        `"${variantName}: ${variantValue}" is listed more than once.`
      );
    }

    seen.add(key);

    const priceAdjustment =
      variant.priceAdjustment.trim() === "" ? 0 : Number.parseFloat(variant.priceAdjustment);

    if (!Number.isFinite(priceAdjustment)) {
      return invalid(
        "Invalid variant price",
        `The price adjustment for "${variantName}: ${variantValue}" must be a number.`
      );
    }

    const variantStock = variant.stock.trim() === "" ? 0 : Number.parseInt(variant.stock, 10);

    if (!Number.isInteger(variantStock) || variantStock < 0) {
      return invalid(
        "Invalid variant stock",
        `The stock for "${variantName}: ${variantValue}" must be a whole number of 0 or more.`
      );
    }

    variants.push({
      id: variant.id ?? undefined,
      name: variantName,
      value: variantValue,
      price_adjustment: priceAdjustment,
      stock_quantity: variantStock,
    });
  }

  const duplicateSlug = existingProducts.some(
    (product) => product.slug.toLowerCase() === slug && product.id !== editingProductId
  );

  if (duplicateSlug) {
    return invalid("Slug already exists", "Please choose a different product slug.");
  }

  return {
    payload: {
      name,
      slug,
      description: values.description.trim() || null,
      price,
      sale_price: salePrice,
      stock_quantity: stock,
      category_id: values.categoryId,
      featured: values.featured,
    },
    images,
    variants,
  };
}

export { generateSlug };
