"use client";

/*
 * ---------------------------------------------------------
 * useCartImages
 * ---------------------------------------------------------
 *
 * Resolves the current photo for each line in the cart.
 *
 * A cart line carries the image URL that was on the product
 * when it was added, saved into localStorage. That copy never
 * updates: a line added while the product had no photo keeps
 * rendering the placeholder after one is uploaded, and a line
 * added before the admin swapped the photo points at a file
 * that may no longer exist. Either way the shopper sees a
 * stand-in next to something they are about to pay for.
 *
 * The stored URL stays as the fallback, so the cart still
 * renders while this is in flight, or if the lookup fails.
 */

import { fetchProductImages } from "@/src/app/lib/products";
import { useAsyncData } from "@/src/app/lib/use-async-data";
import { useCallback, useMemo } from "react";

const NO_IMAGES: Record<string, string> = {};

interface CartLine {
  productId: string;
  image: string;
}

export function useCartImages(items: CartLine[]) {
  /*
   * Serialised so the fetcher is stable across renders that
   * rebuild an equal array - quantity changes must not refetch.
   */
  const idsKey = useMemo(
    () =>
      JSON.stringify(
        Array.from(new Set(items.map((item) => item.productId).filter(Boolean))).sort()
      ),
    [items]
  );

  const fetcher = useCallback(() => fetchProductImages(JSON.parse(idsKey) as string[]), [idsKey]);

  const onError = useCallback((error: unknown) => {
    /* The stored URLs still render; they are just not refreshed. */
    console.error("Could not refresh cart images:", error);
  }, []);

  const { data } = useAsyncData(fetcher, {
    fallback: NO_IMAGES,
    onError,
  });

  /* Live image if we have one, else whatever the cart saved. */
  return useCallback((item: CartLine): string => data[item.productId] ?? item.image, [data]);
}
