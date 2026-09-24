"use server";

/*
 * ---------------------------------------------------------
 * INVALIDATING THE CATALOGUE CACHE
 * ---------------------------------------------------------
 *
 * The cached reads in lib/catalogue.ts have a lifetime, but an
 * admin should not have to wait it out. These are the server
 * actions the admin screens call after a write, so an edited
 * price or a new department is visible on the storefront on the
 * next request rather than minutes later.
 *
 * `updateTag` rather than `revalidateTag`: it expires the entry
 * immediately and makes the next request wait for fresh data,
 * which is what you want when the person who just made the
 * change is about to go and look at it. It is only callable
 * from a Server Action, which is what this file is.
 */

import { updateTag } from "next/cache";

import { CATEGORIES_TAG, PRODUCTS_TAG } from "@/src/app/lib/cache-tags";

/* Products, their prices, stock, variants and review stats. */
export async function revalidateProducts(): Promise<void> {
  updateTag(PRODUCTS_TAG);
}

/* The category tree: departments, their children, names and art. */
export async function revalidateCategories(): Promise<void> {
  updateTag(CATEGORIES_TAG);
}
