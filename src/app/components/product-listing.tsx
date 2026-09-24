import { ProductFilters } from "@/src/app/components/product-filters";
import { ProductGrid } from "@/src/app/components/product-grid";
import { Container } from "@/src/app/components/ui/container";
import Link from "next/link";
import type { ReactNode } from "react";
import { getVariantOptions, preloadListing } from "@/src/app/lib/catalogue";
import { LISTING_PAGE_SIZE } from "@/src/app/lib/products";
import { ProductGridView } from "@/src/app/components/product-grid-view";
import { Suspense } from "react";

/*
 * ---------------------------------------------------------
 * PRODUCT LISTING
 * ---------------------------------------------------------
 *
 * Every page that shows a list of products - /products, the
 * department and category pages, and the sale - is the same
 * thing: a breadcrumb, a heading, a filter rail and a grid,
 * differing only in what narrows the query and what the
 * heading says.
 *
 * /products and CategoryListing had each written that shell
 * out in full, down to a duplicated pair of search-param
 * readers. The sale page had written a third, shorter version
 * that dropped the filters and the toolbar entirely, so the
 * one page where "narrow this down" matters most was the one
 * page that could not.
 *
 * They now all render this.
 */

export type ListingSearchParams = Record<string, string | string[] | undefined>;

export interface Crumb {
  name: string;
  /* The last crumb is the current page, so it has no href. */
  href?: string;
}

interface ProductListingProps {
  title: string;
  description?: string;
  /* "Home" is prepended; the current page is appended last. */
  crumbs?: Crumb[];
  /*
   * Label for that last crumb. Defaults to the heading, which
   * is right for a category but not for a heading that is a
   * sentence, e.g. `Results for "polo"`.
   */
  crumbLabel?: string;
  /*
   * Anchor for links that jump straight to the grid, e.g. the
   * sale banner's "Shop now" pointing at #sale-products.
   */
  id?: string;
  /* Rendered under the description, e.g. a "Clear search" link. */
  headerExtra?: ReactNode;
  /*
   * "h2" where the page already has an h1 above the listing -
   * the sale page's banner, for one. A page gets one h1.
   */
  headingAs?: "h1" | "h2";
  /*
   * Off where the listing is a section of a larger page rather
   * than the page itself, so a trail does not appear halfway
   * down it.
   */
  showBreadcrumb?: boolean;

  /* --- What the route fixes, as opposed to the URL --- */
  categorySlug?: string;
  /*
   * A department and its children, for a route whose slug names
   * a parent. Products belong to the children ("women-dresses"),
   * never to the department, so filtering a department on its
   * own slug matches nothing at all.
   */
  categorySlugs?: string[];
  /* Restrict to genuinely discounted products. */
  sale?: boolean;
  search?: string;
  /* Used when the URL names no sort of its own. */
  defaultSort?: string;
  /* Restrict to products created within the last N months. */
  newWithinMonths?: number;
  /* Scopes the filter rail's options. */
  filterCategoryId?: string;
}

export const readString = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" && value ? value : undefined;

export const readNumber = (value: string | string[] | undefined): number | undefined => {
  const raw = readString(value);

  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export async function ProductListing({
  title,
  description,
  crumbs = [],
  crumbLabel,
  id,
  headerExtra,
  headingAs: Heading = "h1",
  showBreadcrumb = true,
  categorySlug,
  categorySlugs,
  sale,
  search,
  defaultSort,
  newWithinMonths,
  filterCategoryId,
}: ProductListingProps) {
  /*
   * Started, not awaited. The filter options and the product
   * page are independent reads, so awaiting the first before
   * beginning the second put two round trips in series in front
   * of the first byte for no reason. They are collected below.
   */
  const variantOptionsPromise = getVariantOptions();

  /*
   * Page one and its stars, read here rather than by every
   * visitor's browser. The grid seeds React Query with them, so
   * a shopper who lands, looks and leaves - most of them - costs
   * no Supabase query at all.
   *
   * These are the same filters handed to ProductGrid below, so
   * the seed lands on the key the hook computes. Both come from
   * the URL, so they cannot drift from what is rendered.
   */
  const [variantOptions, preloaded] = await Promise.all([
    variantOptionsPromise,
    preloadListing(
      {
        categorySlug,
        categorySlugs,
        sale,
        /* The unfiltered view - what the static shell carries. */
        sort: defaultSort ?? "featured",
        search,
        newWithinMonths,
        cardsOnly: true,
        limit: LISTING_PAGE_SIZE,
        offset: 0,
      },
      /* The grid's "showing N of M" needs the total. */
      true
    ),
  ]);

  return (
    <Container className="py-10 lg:py-14">
      <header className="mb-10 border-b pb-8">
        {showBreadcrumb && (
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <li>
                <Link href="/" className="transition-colors hover:text-foreground">
                  Home
                </Link>
              </li>

              {crumbs.map((crumb) => (
                <span key={crumb.name} className="contents">
                  <li aria-hidden="true">/</li>
                  <li>
                    {crumb.href ? (
                      <Link href={crumb.href} className="transition-colors hover:text-foreground">
                        {crumb.name}
                      </Link>
                    ) : (
                      crumb.name
                    )}
                  </li>
                </span>
              ))}

              <li aria-hidden="true">/</li>
              <li className="font-medium text-foreground">{crumbLabel ?? title}</li>
            </ol>
          </nav>
        )}

        <Heading className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</Heading>

        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        )}

        {headerExtra}
      </header>

      <div
        id={id}
        className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-12"
      >
        {/* Filters travel with the shopper on long lists. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ProductFilters categoryId={filterCategoryId} options={variantOptions} />
        </aside>

        <div className="min-w-0">
          {/*
            The grid owns the toolbar because only it knows how
            many products the query actually returned.
          */}
          {/*
            The fallback is the real grid, not a skeleton.

            ProductGrid reads the URL, so it cannot be
            prerendered - but a Suspense fallback IS rendered on
            the server and goes into the static HTML. So the
            document that leaves the edge already contains the
            unfiltered products, readable with no JavaScript at
            all, and ProductGrid replaces it on hydration with
            whatever the URL actually asks for.

            Both render through the same ProductGridView, so the
            two cannot drift apart visually.
          */}
          <Suspense
            fallback={
              <ProductGridView
                products={preloaded.page?.products ?? []}
                stats={preloaded.stats ? new Map(Object.entries(preloaded.stats.stats)) : undefined}
                priorityCount={1}
              />
            }
          >
            <ProductGrid
              showToolbar
              infinite
              /*
               * Exactly one image preloaded: the LCP.
               *
               * This was 0 while the route rendered dynamically.
               * Back then the products arrived behind a function
               * call in Singapore, TTFB dominated the measurement,
               * and a preload only competed with the CSS needed to
               * show text that had not arrived yet.
               *
               * The route is static now. All four products are in
               * the document, so "data first" is settled by the
               * HTML itself rather than by starving the images -
               * and with TTFB down to the edge, the LCP element IS
               * the photograph. Preloading it no longer delays
               * anything, because there is nothing left to delay.
               *
               * One, not two: the grid is a single column on a
               * phone, so exactly one card is above the fold. The
               * rest stay lazy.
               */
              priorityCount={1}
              initialPage={preloaded.page}
              initialStats={preloaded.stats}
              categorySlug={categorySlug}
              categorySlugs={categorySlugs}
              sale={sale}
              defaultSort={defaultSort}
              search={search}
              newWithinMonths={newWithinMonths}
            />
          </Suspense>
        </div>
      </div>
    </Container>
  );
}
