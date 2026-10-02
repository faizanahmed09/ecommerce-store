"use client";

/*
 * ---------------------------------------------------------
 * useProductList
 * ---------------------------------------------------------
 *
 * The featured strip, the picks band, the related rail and
 * every product grid describe the slice of the catalogue they
 * want; this runs it.
 *
 * It is backed by TanStack Query, so identical slices asked
 * for by two components cost one request, and returning to a
 * page renders from cache rather than querying again. The
 * signature is unchanged from the hand-rolled version it
 * replaced, so the call sites did not have to move.
 */

import {
  fetchStorefrontProductPage,
  fetchStorefrontProducts,
  LISTING_PAGE_SIZE,
  type ProductPage,
  type ProductQuery,
  type StorefrontProduct,
} from "@/src/app/lib/products";
import { createPublicClient } from "@/src/app/lib/supabase/client";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

const NO_PRODUCTS: StorefrontProduct[] = [];

/* Every product query hangs off this, so one call drops them all. */
export const PRODUCTS_KEY = "products";

interface UseProductListOptions extends ProductQuery {
  /* False keeps the hook idle, e.g. a rail with no category. */
  enabled?: boolean;
  /* Message prefix for the console when the query fails. */
  label?: string;
}

/*
 * Two callers describing the same slice must produce the same
 * key, or they get two cache entries and two requests. Object
 * literals do not guarantee key order, so the filters are
 * sorted before they become part of the key, and undefined
 * values are dropped - `{ sale: undefined }` is the same query
 * as `{}`.
 */
function normaliseQuery(query: ProductQuery): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

export function useProductList({
  enabled = true,
  label = "products",
  ...query
}: UseProductListOptions = {}) {
  const queryClient = useQueryClient();

  /*
   * Serialised once and parsed back, so a fresh-but-equal
   * options object each render still yields one stable value
   * to key the cache and the callback off.
   */
  const filterKey = JSON.stringify(normaliseQuery(query));

  const filters = useMemo(() => JSON.parse(filterKey) as ProductQuery, [filterKey]);

  const {
    data = NO_PRODUCTS,
    isPending,
    isFetching,
    error,
  } = useQuery({
    queryKey: [PRODUCTS_KEY, filters],
    queryFn: () => fetchStorefrontProducts(filters, createPublicClient()),
    enabled,
  });

  /*
   * A disabled query never resolves, so `isPending` stays true
   * for it forever; the call sites read `loading` as "a request
   * is out", which for an idle hook is false.
   */
  const loading = enabled && (isPending || (isFetching && data === NO_PRODUCTS));

  if (error) {
    console.error(`Error fetching ${label}:`, error);
  }

  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY, filters] });
  }, [queryClient, filters]);

  return { products: data, loading, error, reload };
}

/*
 * Called after an admin create, edit or delete: every cached
 * product slice is dropped, so the storefront and the admin
 * table both refill from the table rather than showing a row
 * that no longer exists.
 */
export function useInvalidateProducts() {
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] }),
    [queryClient]
  );
}

/*
 * ---------------------------------------------------------
 * useProductPages
 * ---------------------------------------------------------
 *
 * The listing pages used to ask for 24 products and stop: no
 * offset, no page links, no "load more". Anything past the
 * 24th row simply could not be reached, and changing the sort
 * only changed which 24 you were stuck with.
 *
 * This pages through the same query. Each page is a range
 * request, so the database does the skipping; the pages are
 * flattened into one list for the grid to render.
 */
const PAGE_SIZE = LISTING_PAGE_SIZE;

export function useProductPages({
  enabled = true,
  label = "products",
  pageSize = PAGE_SIZE,
  /*
   * Page one, already fetched on the server from a cached scope
   * (lib/catalogue.ts). Seeding it here is what stops every
   * visitor paying for the same first query: the grid renders
   * from it, and React Query only goes to the network when
   * someone scrolls past it or changes a filter.
   *
   * The key is computed below from the same filters the server
   * used, so the seed lands on the entry it belongs to rather
   * than one that merely looks similar.
   */
  initialPage,
  ...query
}: UseProductListOptions & { pageSize?: number; initialPage?: ProductPage } = {}) {
  const filterKey = JSON.stringify(normaliseQuery(query));

  const filters = useMemo(() => JSON.parse(filterKey) as ProductQuery, [filterKey]);

  const result = useInfiniteQuery({
    queryKey: [PRODUCTS_KEY, "paged", pageSize, filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchStorefrontProductPage(
        { ...filters, cardsOnly: true, limit: pageSize, offset: pageParam },
        /* The total is the same for every page; ask once. */
        pageParam === 0,
        createPublicClient()
      ),
    /*
     * A short page means the end of the list. Counting rows
     * rather than trusting the total keeps this right even when
     * the sale filter drops a row after the query ran.
     */
    initialData: initialPage ? { pages: [initialPage], pageParams: [0] } : undefined,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.products.length < pageSize) {
        return undefined;
      }

      return allPages.reduce((sum, page) => sum + page.products.length, 0);
    },
    enabled,
  });

  const products = useMemo(
    () => result.data?.pages.flatMap((page) => page.products) ?? NO_PRODUCTS,
    [result.data]
  );

  if (result.error) {
    console.error(`Error fetching ${label}:`, result.error);
  }

  return {
    products,
    /* Matching rows in the database, not rows loaded so far. */
    total: result.data?.pages[0]?.total ?? null,
    loading: enabled && result.isPending,
    loadingMore: result.isFetchingNextPage,
    hasMore: result.hasNextPage,
    loadMore: result.fetchNextPage,
    error: result.error,
    /* Void-returning, to match the single-page hook's reload. */
    reload: () => {
      void result.refetch();
    },
  };
}
