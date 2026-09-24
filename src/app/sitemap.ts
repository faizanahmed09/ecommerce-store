import type { MetadataRoute } from "next";

import { getAllCategories, getSitemapProducts } from "@/src/app/lib/catalogue";
import { RESERVED_SLUGS } from "@/src/app/lib/departments";
import { childSegment } from "@/src/app/lib/navigation";
import { absoluteUrl } from "@/src/app/lib/seo";

/*
 * ---------------------------------------------------------
 * SITEMAP
 * ---------------------------------------------------------
 *
 * /sitemap.xml - every page worth indexing: the fixed routes,
 * each department and its subcategories, and every product
 * with its photographs (so they can show in Google Images).
 *
 * Built from the same cached reads the storefront uses, so an
 * admin write that clears the catalogue cache refreshes this
 * too. Cart, checkout, account and admin are left out on
 * purpose - robots.ts keeps crawlers off them as well.
 */

const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly";
}[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/new-arrivals", priority: 0.9, changeFrequency: "daily" },
  { path: "/products", priority: 0.9, changeFrequency: "daily" },
  { path: "/sale", priority: 0.8, changeFrequency: "daily" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/faqs", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/shipping", priority: 0.3, changeFrequency: "monthly" },
  { path: "/returns", priority: 0.3, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.2, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  /* A database outage should shrink the sitemap, not fail it. */
  const [categories, products] = await Promise.all([
    getAllCategories().catch((error: unknown) => {
      console.error("Sitemap: could not load categories:", error);
      return [];
    }),
    getSitemapProducts().catch((error: unknown) => {
      console.error("Sitemap: could not load products:", error);
      return [];
    }),
  ]);

  const departments = new Map(
    categories
      .filter((category) => !category.parent_id && !RESERVED_SLUGS.has(category.slug))
      .map((category) => [category.id, category])
  );

  for (const category of categories) {
    if (!category.parent_id) {
      if (departments.has(category.id)) {
        entries.push({
          url: absoluteUrl(`/${category.slug}`),
          changeFrequency: "daily",
          priority: 0.9,
          ...(category.image_url ? { images: [category.image_url] } : {}),
        });
      }
      continue;
    }

    /* Only /department/subcategory has a route; deeper rows have no URL of their own. */
    const parent = departments.get(category.parent_id);

    if (parent) {
      entries.push({
        url: absoluteUrl(`/${parent.slug}/${childSegment(category.slug, parent.slug)}`),
        changeFrequency: "daily",
        priority: 0.8,
        ...(category.image_url ? { images: [category.image_url] } : {}),
      });
    }
  }

  for (const product of products) {
    entries.push({
      url: absoluteUrl(`/products/${product.slug}`),
      ...(product.updated_at ? { lastModified: product.updated_at } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
      ...(product.images.length ? { images: product.images.map((url) => absoluteUrl(url)) } : {}),
    });
  }

  return entries;
}
