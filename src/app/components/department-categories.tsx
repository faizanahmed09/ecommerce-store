"use client";

import Image from "next/image";
import Link from "next/link";
import { CategoryArtwork } from "@/src/app/components/category-artwork";
import { useCategoryChildren } from "@/src/app/components/category-provider";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { childSegment, sectionHref } from "@/src/app/lib/navigation";
import { safeImageSrc } from "@/src/app/lib/utils";

/*
 * ---------------------------------------------------------
 * DEPARTMENT CATEGORY GRID
 * ---------------------------------------------------------
 *
 * Each department used to ship its own hard-coded list of six
 * subcategories - all with an empty image, so every tile
 * rendered the placeholder, and most linking to categories the
 * table has never held. The grid now comes from the same
 * `categories` rows the mega menu reads, so it can only ever
 * offer what the store actually stocks, and an admin adding a
 * subcategory gets a tile for free.
 *
 * The rows come from the shared category store, which the
 * header has already loaded, so a department page runs no
 * category query of its own.
 */

const TILE_COUNT = 6;

export function DepartmentCategories({ parentSlug }: { parentSlug: string }) {
  const { categories: children, loading } = useCategoryChildren(parentSlug);

  if (loading) {
    return (
      <div className="py-12">
        <h2 className="mb-8 text-center text-3xl font-bold">Shop by Category</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {Array.from({ length: TILE_COUNT }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  /* A department with no children shows nothing, not six holes. */
  if (children.length === 0) {
    return null;
  }

  return (
    <div className="py-12">
      <h2 className="mb-8 text-center text-3xl font-bold">Shop by Category</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {children.map((category) => (
          <Link
            key={category.id}
            href={`${sectionHref(parentSlug)}/${childSegment(category.slug, parentSlug)}`}
            className="group overflow-hidden rounded-lg"
          >
            <div className="relative aspect-square overflow-hidden rounded-lg bg-neutral-900">
              {category.image_url ? (
                <>
                  <Image
                    src={safeImageSrc(category.image_url)}
                    alt={category.name}
                    fill
                    sizes="(min-width: 768px) 17vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Only a photo needs darkening under the name. */}
                  <div className="absolute inset-0 bg-black/30 transition-opacity group-hover:bg-black/20" />
                </>
              ) : (
                /* No banner yet - the subcategory's own colours. */
                <CategoryArtwork slug={category.slug} />
              )}

              <div className="absolute inset-0 flex items-center justify-center p-2">
                <h3 className="text-center text-lg font-bold text-white">{category.name}</h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
