/*
 * Cache tags for the catalogue, in their own module so the
 * server action that invalidates them and the cached reads that
 * declare them can share the strings without either pulling the
 * other's imports along.
 *
 * Two tags, because the two change on very different clocks: an
 * admin editing a price should not throw away the category tree
 * as well, and the category tree is what almost every page
 * needs before it can render anything at all.
 */

export const PRODUCTS_TAG = "products";
export const CATEGORIES_TAG = "categories";
