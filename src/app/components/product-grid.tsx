"use client";

import { ProductSorting } from "@/src/app/components/product-sorting";
import { ProductGridSkeletons, ProductGridView } from "@/src/app/components/product-grid-view";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { InfiniteSentinel } from "@/src/app/components/infinite-sentinel";
import { useProductList, useProductPages } from "@/src/app/lib/use-product-list";
import { useReviewStats } from "@/src/app/lib/use-review-stats";
import { LISTING_PAGE_SIZE, type ProductPage } from "@/src/app/lib/products";
import type { SeededReviewStats } from "@/src/app/lib/reviews";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

interface ProductGridProps {
  categorySlug?: string;
  /* A department plus its subcategories. */
  categorySlugs?: string[];
  categoryId?: string;
  sale?: boolean;
  limit?: number;
  /*
   * The sort to use when the URL names none. The route decides
   * it (the sale page ranks by discount); the URL overrides it.
   */
  defaultSort?: string;
  /* Free text from the header search. */
  search?: string;
  /* Only products created within the last N months. */
  newWithinMonths?: number;
  /* Renders the result count and the sort control above the grid. */
  showToolbar?: boolean;
  /*
   * How many cards preload their image instead of lazy-loading
   * it. Zero for a rail below the fold; a listing sets its first
   * row, which is where the page's LCP image lives.
   */
  priorityCount?: number;
  /*
   * Page one and its stars, fetched on the server from a cached
   * scope. Passed straight through to the hooks, which use them
   * instead of opening two connections per visitor for data
   * every visitor gets the same answer to.
   */
  initialPage?: ProductPage;
  initialStats?: SeededReviewStats;
  /*
   * Pages in more products as the shopper reaches the bottom.
   * Off for the fixed-size rails (a department preview wants
   * eight products, not the whole department).
   */
  infinite?: boolean;
}

/*
 * Anything in the URL that changes which products are returned.
 * Their presence is what makes the server's preload wrong.
 */
const FILTER_PARAMS = ["sort", "minPrice", "maxPrice", "variants", "pieces", "q"] as const;

export function ProductGrid({
  categorySlug,
  categorySlugs,
  categoryId,
  sale,
  defaultSort,
  limit = LISTING_PAGE_SIZE,
  search,
  newWithinMonths,
  showToolbar = false,
  priorityCount = 0,
  initialPage,
  initialStats,
  infinite = false,
}: ProductGridProps) {
  /*
   * Filters are read here, in the browser, rather than handed
   * down from the page.
   *
   * That one move is what lets the route be prerendered: a page
   * that awaits searchParams cannot be part of a static shell,
   * so the products sat behind a function call and every
   * visitor waited on it. Read on the client, the shell can
   * carry the unfiltered grid and be served from the edge -
   * and narrowing it is a client-side concern anyway, since the
   * filter rail and the sort control already write these values
   * into the URL themselves.
   */
  const searchParams = useSearchParams();

  const readNumber = (key: string): number | undefined => {
    const raw = searchParams.get(key);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;

    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const query = {
    categorySlug,
    categorySlugs,
    categoryId,
    sale,
    /* No sort in the URL means the route's own default. */
    sort: searchParams.get("sort") ?? defaultSort ?? "featured",
    minPrice: readNumber("minPrice"),
    maxPrice: readNumber("maxPrice"),
    pieceCount:
      searchParams.get("pieces") === "2"
        ? (2 as const)
        : searchParams.get("pieces") === "3"
          ? (3 as const)
          : undefined,
    variantValues: searchParams.get("variants")?.split(",").filter(Boolean),
    /* The route may fix it; otherwise the header's ?q= does. */
    search: search ?? searchParams.get("q") ?? undefined,
    newWithinMonths,
  };

  /*
   * Both hooks are called every render - a hook cannot be
   * conditional - and the one that is not in use is disabled,
   * so it neither fetches nor holds a cache entry.
   */
  const single = useProductList({ ...query, limit, enabled: !infinite });

  /*
   * The server preloaded the UNFILTERED first page. React Query
   * applies initialData to whichever key is active, so handing
   * it over on a filtered URL seeded the filtered key with
   * unfiltered rows - and, being treated as fresh, it never
   * refetched. The filters silently did nothing.
   *
   * So the seed is offered only when the URL asks for exactly
   * what was preloaded. The moment anything narrows the list,
   * the grid fetches for itself as it always did.
   */
  const seedApplies = !FILTER_PARAMS.some((param) => searchParams.has(param));

  const paged = useProductPages({
    ...query,
    pageSize: limit,
    enabled: infinite,
    initialPage: seedApplies ? initialPage : undefined,
  });

  const { products, loading, error, reload } = infinite ? paged : single;

  const total = infinite ? paged.total : null;

  /* One stats query for the whole grid, not one per card. */
  const stats = useReviewStats(
    useMemo(() => products.map((product) => product.id), [products]),
    seedApplies ? initialStats : undefined
  );

  const errorMessage =
    error === null
      ? null
      : error instanceof Error
        ? error.message
        : "Products could not be loaded.";

  if (loading) {
    return (
      <div className="space-y-6">
        {showToolbar && (
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-[220px]" />
          </div>
        )}

        <ProductGridSkeletons count={Math.min(limit, 8)} />
      </div>
    );
  }

  const toolbar = showToolbar ? (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      {/*
        With paging on, the count is the number of matching rows
        in the database rather than the number fetched so far -
        "Showing 24 products" used to be the length of the array,
        which said nothing about how many there were.
      */}
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{products.length}</span>
        {total !== null && total > products.length ? ` of ${total}` : ""}{" "}
        {(total ?? products.length) === 1 ? "product" : "products"}
      </p>

      <ProductSorting />
    </div>
  ) : null;

  if (errorMessage) {
    return (
      <div className="space-y-6">
        {toolbar}

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">
            We couldn&apos;t load products right now.
          </p>

          <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>

          <button
            type="button"
            onClick={reload}
            className="mt-4 text-sm font-medium underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProductGridView
      products={products}
      stats={stats}
      toolbar={toolbar}
      priorityCount={priorityCount}
      search={query.search}
      footer={
        infinite ? (
          <InfiniteSentinel
            hasMore={paged.hasMore}
            loading={paged.loadingMore}
            onLoadMore={paged.loadMore}
            endLabel={products.length > limit ? "That's everything." : undefined}
          />
        ) : null
      }
    />
  );
}
