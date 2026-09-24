"use client";

import { Button } from "@/src/app/components/ui/button";
import { Container, Section, SectionHeading } from "@/src/app/components/ui/container";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { formatCurrency, cn, safeImageSrc } from "@/src/app/lib/utils";
import { getEffectivePrice, getPrimaryImage, hasDiscount } from "@/src/app/lib/products";
import { useProductList } from "@/src/app/lib/use-product-list";
import { ArrowRight, ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/*
 * ---------------------------------------------------------
 * FEATURED PICKS
 * ---------------------------------------------------------
 *
 * Replaces the old hand-written promo tiles. Those named
 * departments that had to be kept in step with the catalogue
 * by hand; these three come straight from the featured flag,
 * and each one carries a button through to the category the
 * product actually belongs to.
 */

const PICK_COUNT = 3;

/* Any category page renders from a slug, nesting and all. */
const categoryHref = (slug: string) => `/categories/${slug}`;

export function FeaturedPicks() {
  const featured = useProductList({
    featured: true,
    sort: "newest",
    limit: PICK_COUNT,
    label: "featured picks",
  });

  /*
   * Nothing is flagged featured on a fresh catalogue, and a
   * homepage band that quietly disappears is worse than one
   * showing the newest arrivals. So the fallback only runs
   * once the featured query has come back empty.
   */
  const needsFallback = !featured.loading && featured.products.length === 0;

  const newest = useProductList({
    sort: "newest",
    limit: PICK_COUNT,
    enabled: needsFallback,
    label: "newest picks",
  });

  const products = needsFallback ? newest.products : featured.products;
  const loading = featured.loading || (needsFallback && newest.loading);

  if (loading) {
    return (
      <Section>
        <Container>
          <SectionHeading
            eyebrow="This week"
            title="Featured picks"
            description="Three pieces we'd put in the basket first."
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {Array.from({ length: PICK_COUNT }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/5] w-full rounded-2xl" />
            ))}
          </div>
        </Container>
      </Section>
    );
  }

  /* An empty catalogue leaves no band behind. */
  if (products.length === 0) {
    return null;
  }

  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow="This week"
          title="Featured picks"
          description="Three pieces we'd put in the basket first."
          actionHref="/products"
          actionLabel="Browse everything"
        />

        <div
          className={cn(
            "grid grid-cols-1 gap-5",
            products.length === 2 && "sm:grid-cols-2",
            products.length >= 3 && "sm:grid-cols-3"
          )}
        >
          {products.map((product) => {
            const image = getPrimaryImage(product);
            const category = product.categories;
            const price = getEffectivePrice(product);

            return (
              <article
                key={product.id}
                className="group relative flex min-h-[380px] overflow-hidden rounded-2xl bg-neutral-900 sm:min-h-[440px]"
              >
                {image ? (
                  <Image
                    src={safeImageSrc(image)}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="object-cover opacity-75 transition-all duration-500 ease-out group-hover:scale-105 group-hover:opacity-85"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center bg-neutral-800"
                  >
                    <ImageOff className="h-8 w-8 text-white/20" />
                  </div>
                )}

                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/40 to-transparent"
                />

                {/* The whole tile opens the product. */}
                <Link href={`/products/${product.slug}`} className="absolute inset-0 z-10">
                  <span className="sr-only">{product.name}</span>
                </Link>

                {/*
                  The copy paints over that link but lets clicks
                  fall through to it, so only the category button
                  below takes a click of its own.
                */}
                <div className="pointer-events-none relative z-20 mt-auto flex w-full flex-col p-6 sm:p-7">
                  {category?.name && (
                    <span className="mb-3 inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur">
                      {category.name}
                    </span>
                  )}

                  <h3 className="text-xl font-semibold leading-tight tracking-tight text-white sm:text-2xl">
                    {product.name}
                  </h3>

                  <p className="mt-2 flex items-baseline gap-2 text-sm text-white/70">
                    <span className="font-medium text-white">{formatCurrency(price)}</span>
                    {hasDiscount(product) && (
                      <span className="text-white/45 line-through">
                        {formatCurrency(product.price)}
                      </span>
                    )}
                  </p>

                  {category?.slug && category.name ? (
                    <Button
                      asChild
                      className="pointer-events-auto mt-6 h-10 w-fit rounded-full bg-white px-5 text-sm text-neutral-950 hover:bg-white/90"
                    >
                      <Link href={categoryHref(category.slug)}>
                        Shop {category.name}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    /*
                      An uncategorised product has nowhere to
                      send people, so the all-products page
                      stands in for its category.
                    */
                    <Button
                      asChild
                      className="pointer-events-auto mt-6 h-10 w-fit rounded-full bg-white px-5 text-sm text-neutral-950 hover:bg-white/90"
                    >
                      <Link href="/products">
                        Shop all
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
