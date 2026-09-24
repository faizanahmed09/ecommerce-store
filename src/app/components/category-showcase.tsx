"use client";

/*
 * Reads the shared category store rather than querying on the
 * server: the header has already paid for these rows by the
 * time the homepage renders, so the showcase costs nothing.
 */

import { CategoryArtwork } from "@/src/app/components/category-artwork";
import { useRootCategories } from "@/src/app/components/category-provider";
import { Container, Section, SectionHeading } from "@/src/app/components/ui/container";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { sectionHref } from "@/src/app/lib/navigation";
import Image from "next/image";
import Link from "next/link";
import { safeImageSrc } from "@/src/app/lib/utils";

/* The showcase shows the first six departments, not all of them. */
const SHOWCASE_LIMIT = 6;

export function CategoryShowcase() {
  const { categories: allCategories, loading } = useRootCategories();

  const categories = allCategories.slice(0, SHOWCASE_LIMIT);

  if (loading) {
    return (
      <Section>
        <Container>
          <SectionHeading
            align="center"
            eyebrow="Browse"
            title="Shop by category"
            description="Find what you're looking for across our departments."
          />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: SHOWCASE_LIMIT }).map((_, index) => (
              <Skeleton key={index} className="aspect-[3/4] w-full rounded-xl" />
            ))}
          </div>
        </Container>
      </Section>
    );
  }

  /* Nothing to show is better than an empty grid of holes. */
  if (categories.length === 0) {
    return null;
  }

  return (
    <Section>
      <Container>
        <SectionHeading
          align="center"
          eyebrow="Browse"
          title="Shop by category"
          description="Find what you're looking for across our departments."
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={sectionHref(category.slug)}
              className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-muted"
            >
              {category.image_url ? (
                <>
                  <Image
                    src={safeImageSrc(category.image_url)}
                    alt={category.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />

                  {/* Only a photo needs darkening under the name. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent transition-opacity duration-300 group-hover:from-black/85"
                  />
                </>
              ) : (
                /* No banner yet - the department's own colours. */
                <CategoryArtwork slug={category.slug} />
              )}

              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <h3 className="text-sm font-semibold leading-tight text-white sm:text-base">
                  {category.name}
                </h3>

                <span className="mt-0.5 block text-[11px] text-white/0 transition-colors duration-300 group-hover:text-white/70">
                  Shop now
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </Section>
  );
}
