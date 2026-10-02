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

/* Lead with the seasonal edits while keeping other departments discoverable. */
const SHOWCASE_LIMIT = 6;
const SEASONAL_SLUGS = ["summer-unstitched", "winter-unstitched"];
const COLLECTION_IMAGES: Record<string, string> = {
  "summer-unstitched": "/collection-summer-unstitched.webp",
  "winter-unstitched": "/collection-winter-unstitched.webp",
  men: "/collection-men.webp",
  women: "/collection-women.webp",
};

const cardWidth = "w-[calc(50%_-_0.375rem)] sm:w-[calc(50%_-_0.5rem)] md:w-[calc(33.333%_-_0.667rem)] lg:w-[calc(25%_-_0.75rem)]";

export function CategoryShowcase() {
  const { categories: allCategories, loading } = useRootCategories();

  const categories = [
    ...SEASONAL_SLUGS.flatMap((slug) => allCategories.filter((category) => category.slug === slug)),
    ...allCategories.filter((category) => !SEASONAL_SLUGS.includes(category.slug)),
  ].slice(0, SHOWCASE_LIMIT);

  if (loading) {
    return (
      <Section>
        <Container>
          <SectionHeading
            align="center"
            eyebrow="The collections"
            title="Find your season"
            description="Unstitched fabrics to make entirely your own."
          />

          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className={`aspect-[3/4] ${cardWidth}`} />
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
          eyebrow="The collections"
          title="Find your season"
          description="Unstitched fabrics to make entirely your own."
        />

        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {categories.map((category) => {
            const imageUrl = category.image_url || COLLECTION_IMAGES[category.slug];

            return (
              <Link
                key={category.id}
                href={sectionHref(category.slug)}
                className={`group relative aspect-[3/4] overflow-hidden bg-muted ${cardWidth}`}
              >
                {imageUrl ? (
                  <>
                    <Image
                      src={safeImageSrc(imageUrl)}
                      alt={category.name}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />

                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent transition-opacity duration-300 group-hover:from-black/85"
                    />
                  </>
                ) : (
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
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
