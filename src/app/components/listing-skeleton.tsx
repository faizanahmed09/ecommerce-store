/*
 * ---------------------------------------------------------
 * LISTING SKELETON
 * ---------------------------------------------------------
 *
 * What a listing route shows the instant it is clicked, while
 * the server renders the real thing.
 *
 * The app had no loading.tsx anywhere, which meant a click on
 * /products or /sale left the previous page on screen, doing
 * nothing visible, until the server answered - and those routes
 * render dynamically, so that answer is a full round trip. On a
 * connection where that takes half a second the click felt
 * ignored, and the usual response to a click that feels ignored
 * is to click again.
 *
 * This changes no timing at all. It changes whether the wait is
 * visible, which is most of what "slow" means to somebody using
 * the shop.
 *
 * A server component with no hooks, so it costs nothing and is
 * never sent to the browser.
 */

import { Container } from "@/src/app/components/ui/container";
import { Skeleton } from "@/src/app/components/ui/skeleton";

export function ListingSkeleton() {
  return (
    <Container className="py-10 lg:py-14">
      <header className="mb-10 border-b pb-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-9 w-72 sm:h-10" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-12">
        {/* The filter rail, which only exists from 1024px up. */}
        <aside className="hidden lg:block">
          <Skeleton className="h-6 w-24" />

          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-[220px]" />
          </div>

          {/*
            The same column ladder as the real grid, so the
            cards do not jump when they replace this.
          */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-9 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}
