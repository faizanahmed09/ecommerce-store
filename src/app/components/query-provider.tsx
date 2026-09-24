"use client";

/*
 * ---------------------------------------------------------
 * QUERY CLIENT
 * ---------------------------------------------------------
 *
 * Products are read from half a dozen places - the featured
 * strip, the picks band, the related rail, every grid - and
 * each surface wants a different slice of the catalogue. That
 * is query-shaped, not table-shaped, so it is cached per query
 * rather than held in a store the way `categories` is.
 *
 * What this buys: two components asking for the same slice
 * share one request, a client-side navigation back to a page
 * renders from cache instead of refetching, and an admin write
 * can drop every product query at once.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/*
 * Long enough that navigating between pages is instant, short
 * enough that a shopper is not shown stock and prices minutes
 * out of date. Products change under us in a way categories do
 * not, which is why none of this is written to localStorage:
 * a cached "in stock" surviving into tomorrow's session would
 * be worse than a refetch.
 */
const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;

export function QueryProvider({ children }: { children: ReactNode }) {
  /*
   * One client per browser session, created in state so React
   * cannot hand two renders two different caches - and never
   * at module scope, which on the server would share one cache
   * between requests, and so between users.
   */
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_MS,
            gcTime: GC_TIME_MS,
            /* The catalogue does not change because a tab regained focus. */
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
