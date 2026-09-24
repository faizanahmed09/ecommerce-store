"use client";

/*
 * ---------------------------------------------------------
 * useReviewStats
 * ---------------------------------------------------------
 *
 * The rating summary for a grid of products, fetched once for
 * the whole grid rather than once per card - a listing page
 * showing 24 products would otherwise open 24 connections to
 * say "no reviews yet" 24 times.
 *
 * Products with no reviews are absent from the map, so read it
 * through statsFor() below.
 */

import { useCallback, useMemo } from "react";

import {
  fetchReviewStatsByProduct,
  type ReviewStats,
  type ReviewStatsMap,
  type SeededReviewStats,
} from "@/src/app/lib/reviews";
import { useAsyncData } from "@/src/app/lib/use-async-data";

/* Re-exported so existing client call sites keep their import. */
export { statsFor, type ReviewStatsMap } from "@/src/app/lib/reviews";

/* One shared empty map, so the fallback never retriggers a render. */
const NO_STATS: ReviewStatsMap = new Map<string, ReviewStats>();

export function useReviewStats(
  productIds: string[],
  /*
   * Stars read on the server alongside the products, from a
   * cached scope. Honoured only while the ids being asked for
   * are exactly the ids it was built from - the moment the grid
   * pages or filters, that stops being true and the hook goes
   * to the network as it always did.
   */
  seed?: SeededReviewStats
): ReviewStatsMap {
  /*
   * The array is rebuilt on every render by its caller, so the
   * fetcher keys off the ids themselves rather than the array
   * identity - otherwise the effect would loop.
   */
  const key = useMemo(() => productIds.join(","), [productIds]);

  /*
   * null once the seed no longer describes what is on screen,
   * which is also what re-enables the fetch below. One value
   * decides both, so they cannot disagree.
   */
  const seeded = useMemo(
    () => (seed && seed.ids.join(",") === key ? new Map(Object.entries(seed.stats)) : null),
    [seed, key]
  );

  const fetcher = useCallback(() => fetchReviewStatsByProduct(key ? key.split(",") : []), [key]);

  const { data } = useAsyncData<ReviewStatsMap>(fetcher, {
    fallback: NO_STATS,
    enabled: key.length > 0 && seeded === null,
    /* A missing star row is not worth breaking a product grid over. */
    onError: (error) => console.error("Could not read review stats:", error),
  });

  return seeded ?? data;
}
