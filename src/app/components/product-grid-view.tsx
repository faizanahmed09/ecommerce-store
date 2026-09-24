/*
 * ---------------------------------------------------------
 * PRODUCT GRID - THE MARKUP
 * ---------------------------------------------------------
 *
 * The grid, given products. No data fetching, no URL reading,
 * no hooks that force a client render.
 *
 * That last part is the whole reason this file exists. The grid
 * used to read the filters out of the URL itself, and a
 * component calling useSearchParams() cannot be prerendered -
 * so the products were left out of the static HTML entirely and
 * only appeared once the browser had downloaded and hydrated
 * the bundle. The page looked fast and showed nothing.
 *
 * Split out, this renders on the server as the Suspense
 * fallback for the interactive grid - which means the real
 * unfiltered products are in the document, from the edge, with
 * no JavaScript required to see them. ProductGrid then takes
 * over on hydration and applies whatever the URL asks for.
 *
 * ProductCard is itself a client component, but it uses no
 * request-time API, so it renders to HTML here perfectly well.
 */

import { ProductCard } from "@/src/app/components/product-card";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import type { StorefrontProduct } from "@/src/app/lib/products";
import { statsFor, type ReviewStatsMap } from "@/src/app/lib/reviews";
import { PackageOpen } from "lucide-react";
import type { ReactNode } from "react";

/*
 * One card per row on a phone, two from 640px up. A listing
 * card carries an image, name, price and an add button, and two
 * of those side by side under 640px leaves each about 150px
 * wide - the price and the button wrap, and the photograph is
 * what a shopper is actually scanning.
 */
export const GRID_CLASS =
  "grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 xl:grid-cols-4";

export function ProductGridSkeletons({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3">
          <Skeleton className="aspect-[3/4] w-full rounded-xl" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

interface ProductGridViewProps {
  products: StorefrontProduct[];
  stats?: ReviewStatsMap;
  /* Rendered above the grid: the count and the sort control. */
  toolbar?: ReactNode;
  /* Cards that preload their image rather than lazy-loading it. */
  priorityCount?: number;
  /* Shown in the empty state, to say what matched nothing. */
  search?: string;
  /* Paging sentinel, only the interactive grid has one. */
  footer?: ReactNode;
}

export function ProductGridView({
  products,
  stats,
  toolbar,
  priorityCount = 0,
  search,
  footer,
}: ProductGridViewProps) {
  if (products.length === 0) {
    return (
      <div className="space-y-6">
        {toolbar}

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <PackageOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />

          <p className="text-sm font-medium">
            {search ? `Nothing matched "${search}".` : "No products found."}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {search
              ? "Try a different word, or browse the full catalogue."
              : "Try widening your filters, or check back soon."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toolbar}

      <div className={GRID_CLASS}>
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            stats={statsFor(stats, product.id)}
            priority={index < priorityCount}
          />
        ))}
      </div>

      {footer}
    </div>
  );
}
