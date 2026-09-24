"use client";

/*
 * ---------------------------------------------------------
 * SEARCH RESULT HEADING
 * ---------------------------------------------------------
 *
 * "Results for polo", and the way back to the full catalogue.
 *
 * Read in the browser rather than on the server, because the
 * page's title was the last thing on /products still needing
 * searchParams - and a route that awaits searchParams cannot be
 * prerendered, so the whole grid sat behind a function call to
 * put one word in a heading.
 *
 * The heading is now client-rendered and the route is static.
 * Search results are not content anyone wants indexed, so
 * nothing is lost by them not being server-rendered.
 */

import { Button } from "@/src/app/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function SearchHeading() {
  const query = useSearchParams().get("q")?.trim();

  if (!query) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">
        Showing results for <span className="font-medium text-foreground">{query}</span>
      </p>

      <Button asChild variant="outline" size="sm">
        <Link href="/products">Clear search</Link>
      </Button>
    </div>
  );
}
