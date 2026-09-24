"use client";

import { ProductCard } from "@/src/app/components/product-card";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { useProductList } from "@/src/app/lib/use-product-list";
import { statsFor, useReviewStats } from "@/src/app/lib/use-review-stats";
import { useMemo } from "react";

interface RelatedProductsProps {
  currentProductId: string;
  /* products.category_id is nullable, so this can be absent. */
  categoryId: string | null;
}

export function RelatedProducts({ currentProductId, categoryId }: RelatedProductsProps) {
  /* Nothing to relate to without a category. */
  const { products, loading } = useProductList({
    enabled: Boolean(categoryId),
    categoryId: categoryId ?? undefined,
    excludeId: currentProductId,
    limit: 4,
    label: "related products",
  });

  /* One stats query for the whole grid, not one per card. */
  const stats = useReviewStats(useMemo(() => products.map((product) => product.id), [products]));

  if (loading) {
    return (
      <section className="py-10">
        <h2 className="mb-6 text-2xl font-bold">Related Products</h2>

        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="aspect-[3/4] w-full rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  /* An empty related list is better hidden than shown empty. */
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-10">
      <h2 className="mb-6 text-2xl font-bold">Related Products</h2>

      <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-6 md:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} stats={statsFor(stats, product.id)} />
        ))}
      </div>
    </section>
  );
}
