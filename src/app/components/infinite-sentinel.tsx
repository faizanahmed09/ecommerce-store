"use client";

/*
 * ---------------------------------------------------------
 * INFINITE SENTINEL
 * ---------------------------------------------------------
 *
 * An empty element below the last row. When it comes into
 * view, the next page is asked for.
 *
 * An IntersectionObserver rather than a scroll handler: the
 * browser does the work off the main thread, and it keeps
 * firing correctly when the page grows under it. `rootMargin`
 * starts the fetch before the sentinel is actually on screen,
 * so the rows are usually there by the time the shopper
 * reaches the bottom.
 */

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface InfiniteSentinelProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  /* Rendered when everything has been loaded. */
  endLabel?: string;
}

export function InfiniteSentinel({
  hasMore,
  loading,
  onLoadMore,
  endLabel,
}: InfiniteSentinelProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  /*
   * Held in a ref so a fresh callback each render cannot tear
   * the observer down and rebuild it. Assigned in an effect,
   * never during render.
   */
  const loadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const element = ref.current;

    if (!element || !hasMore || loading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreRef.current();
        }
      },
      { rootMargin: "400px 0px" }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [hasMore, loading]);

  if (!hasMore) {
    return endLabel ? (
      <p className="py-10 text-center text-xs text-muted-foreground">{endLabel}</p>
    ) : null;
  }

  return (
    <div ref={ref} className="flex justify-center py-10">
      {/*
        Always rendered while there is more, so the observer has
        something to watch; the spinner only shows once a page
        is actually in flight.
      */}
      {loading ? (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading more
        </span>
      ) : (
        <span className="sr-only">Loading more products</span>
      )}
    </div>
  );
}
