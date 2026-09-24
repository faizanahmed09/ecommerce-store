"use client";

/*
 * ---------------------------------------------------------
 * SALE CATEGORY GRID
 * ---------------------------------------------------------
 *
 * This was four hand-written tiles - Men's, Kids' and Footwear
 * among them - each with an empty image and a made-up discount,
 * and none of them tied to a row in the table. The departments
 * now come from the shared category store, so the grid shows
 * what the shop actually sells and an admin adding a department
 * gets a tile without anyone editing this file.
 *
 * The old tiles advertised "Up to 50% Off" per department. The
 * categories table holds no such figure, so the badge is gone
 * rather than invented.
 */

import { CategoryArtwork } from "@/src/app/components/category-artwork";
import { useRootCategories } from "@/src/app/components/category-provider";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { safeImageSrc } from "@/src/app/lib/utils";
import Image from "next/image";
import Link from "next/link";

/* /sale/[subcategory] renders any department, sale-filtered. */
const saleHref = (slug: string) => `/sale/${slug}`;

export function SaleCategories() {
  const { categories, loading } = useRootCategories();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
    );
  }

  /* No departments in the table means no grid of holes. */
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={saleHref(category.slug)}
          className="group overflow-hidden rounded-lg"
        >
          <div className="relative aspect-square overflow-hidden rounded-lg bg-neutral-900">
            {category.image_url ? (
              <>
                <Image
                  src={safeImageSrc(category.image_url)}
                  alt={category.name}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Only a photo needs darkening under the name. */}
                <div className="absolute inset-0 bg-black/40 transition-colors group-hover:bg-black/30" />
              </>
            ) : (
              /* No banner yet - the department's own colours. */
              <CategoryArtwork slug={category.slug} />
            )}

            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-white">
              <h3 className="text-xl font-bold">{category.name}</h3>

              <span className="mt-2 rounded-full bg-red-600 px-3 py-1 text-sm font-medium">
                Shop sale
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
