"use client";

import { CategoryArtwork } from "@/src/app/components/category-artwork";
import { useCategoryChildren } from "@/src/app/components/category-provider";
import { DepartmentCategories } from "@/src/app/components/department-categories";
import { ProductGrid } from "@/src/app/components/product-grid";
import { Button } from "@/src/app/components/ui/button";
import { Container } from "@/src/app/components/ui/container";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import type { Department, DepartmentSection } from "@/src/app/lib/departments";
import { DEPARTMENT_SECTION_SIZE, type ProductPage } from "@/src/app/lib/products";
import type { SeededReviewStats } from "@/src/app/lib/reviews";
import { safeImageSrc } from "@/src/app/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useMemo } from "react";

/*
 * ---------------------------------------------------------
 * DEPARTMENT LANDING PAGE
 * ---------------------------------------------------------
 *
 * The page behind /men, /women, /kids, /footwear, /fragnance
 * and /winter-wear, which were six identical copies of it.
 * Everything that differs between them lives in lib/departments.
 *
 * The department itself is resolved by /[department], so this
 * component only receives content and never decides routing
 * beyond appending a child segment to the department's slug.
 */

function ProductSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array(4)
        .fill(null)
        .map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
    </div>
  );
}

/*
 * The rail has to be a client component so it can read the
 * department's subcategories out of the shared category store.
 * Products belong to the children ("women-dresses"), never to
 * the department itself, so a rail filtered on the department's
 * own slug matched nothing and every department page showed two
 * empty grids.
 */
function ProductSection({
  section,
  departmentSlug,
  serverSlugs,
  initialPage,
  initialStats,
}: {
  section: DepartmentSection;
  departmentSlug: string;
  /*
   * The department and its children, resolved on the server.
   * Present, the rail renders its products in the first paint
   * rather than showing skeletons while the browser fetches the
   * category tree and then the products off the back of it.
   */
  serverSlugs?: string[];
  initialPage?: ProductPage;
  initialStats?: SeededReviewStats;
}) {
  /*
   * Still called - hooks cannot be conditional - but idle when
   * the server already answered. It is the fallback for a
   * preload that failed, which is the only way to reach the
   * skeleton branch now.
   */
  const { categories: children, loading } = useCategoryChildren(departmentSlug);

  /* The department itself, in case products are filed directly on it. */
  const clientSlugs = useMemo(
    () => [departmentSlug, ...children.map((child) => child.slug)],
    [departmentSlug, children]
  );

  const slugs = serverSlugs ?? clientSlugs;

  return (
    /*
     * The id is what the hero button scrolls to. Every hero used
     * to point at "#new-arrivals" and no page defined it.
     */
    <div id={section.id} className="scroll-mt-24 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-bold">{section.title}</h2>

        {/*
         * "View all" goes to the catalogue with the same filter the
         * preview uses. It used to point at /men/new-arrivals and
         * friends, which are not categories, so every one of them
         * opened an empty listing.
         */}
        <Link
          href={`/${departmentSlug}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          View All
        </Link>
      </div>

      {loading && !serverSlugs ? (
        <ProductSkeletons />
      ) : (
        <ProductGrid
          categorySlugs={slugs}
          defaultSort={section.sort}
          limit={DEPARTMENT_SECTION_SIZE}
          initialPage={initialPage}
          initialStats={initialStats}
        />
      )}
    </div>
  );
}

export function DepartmentPage({
  department,
  serverSlugs,
  initialPage,
  initialStats,
}: {
  department: Department;
  serverSlugs?: string[];
  initialPage?: ProductPage;
  initialStats?: SeededReviewStats;
}) {
  const { slug, name, hero, section, imageUrl } = department;

  return (
    <div>
      {/*
        Full-bleed hero, then everything below it sits on the
        same max-w-7xl measure as the header, the footer and
        every other page. It used to run edge to edge.
      */}
      <div className="group relative h-[420px] overflow-hidden md:h-[500px]">
        {imageUrl ? (
          <Image
            src={safeImageSrc(imageUrl)}
            alt={name}
            fill
            preload
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          /* No banner uploaded - the department's own colours. */
          <CategoryArtwork slug={slug} />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent">
          <Container className="flex h-full items-center">
            <div className="max-w-lg text-white">
              <h1 className="mb-4 text-4xl font-bold md:text-5xl lg:text-6xl">{hero.title}</h1>

              <p className="mb-6 text-lg">{hero.description}</p>

              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="bg-white text-black hover:bg-gray-100">
                  <Link href={`#${section.id}`}>{hero.primaryCta}</Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white bg-transparent text-white hover:bg-transparent/10 hover:text-white"
                >
                  <Link href={`/sale/${slug}`}>Shop Sale</Link>
                </Button>
              </div>
            </div>
          </Container>
        </div>
      </div>

      <Container>
        {/*
          The subcategory grid is the dynamic version of the
          promo band that used to sit further down this page:
          two hand-written tiles per department, pointing at
          segments like /women/ethnic that are not rows in the
          categories table, every one of them rendering the
          same kids.webp. These come from the table, so they
          can only ever link somewhere real.
        */}
        <DepartmentCategories parentSlug={slug} />

        {/*
          Streamed, not prerendered.

          The cards read the wishlist, which reads the signed-in
          user, which is a cookie - request-time data that cannot
          be baked into a static shell. Before the rail was
          seeded it never rendered a card during the prerender,
          so the question never arose; now that it does, the
          hero and the category tiles still prerender and only
          this band waits for the request.
        */}
        <Suspense fallback={<ProductSkeletons />}>
          <ProductSection
            section={section}
            departmentSlug={slug}
            serverSlugs={serverSlugs}
            initialPage={initialPage}
            initialStats={initialStats}
          />
        </Suspense>
      </Container>
    </div>
  );
}
