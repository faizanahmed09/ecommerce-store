"use client";

import { useCart } from "@/src/app/components/cart-provider";
import { Button } from "@/src/app/components/ui/button";
import { StarRating } from "@/src/app/components/ui/star-rating";
import { useToast } from "@/hooks/use-toast";
import {
  getDiscountPercent,
  getEffectivePrice,
  getPrimaryImage,
  hasDiscount,
  isInStock,
  type StorefrontProduct,
} from "@/src/app/lib/products";
import { EMPTY_REVIEW_STATS, formatAverageRating, type ReviewStats } from "@/src/app/lib/reviews";
import { useWishlist } from "@/src/app/lib/use-wishlist";
import { cn, formatCurrency, safeImageSrc } from "@/src/app/lib/utils";
import { Heart, ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

interface ProductCardProps {
  product: StorefrontProduct;
  /*
   * Supplied by the grid, which reads every card's stats in one
   * query. Left out, the card simply shows no stars.
   */
  stats?: ReviewStats;
  /*
   * Preloads this card's image instead of lazy-loading it. Set
   * by the grid for the first row only - see the Image below.
   */
  priority?: boolean;
}

export function ProductCard({
  product,
  stats = EMPTY_REVIEW_STATS,
  priority = false,
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  /*
   * Shared across every card on the page and the product page,
   * so one query answers all of them and a heart filled here is
   * filled everywhere. This used to be useState(false): it lit
   * up on click, wrote nothing, and forgot itself on navigation.
   */
  const { isSaved, toggle, saving } = useWishlist();

  const isFavorite = isSaved(product.id);

  const { addItem } = useCart();
  const { toast } = useToast();

  const primaryImage = getPrimaryImage(product);
  const secondaryImage = product.product_images[1]?.image_url ?? null;

  /* Swap to the second shot on hover, when there is one. */
  const displayImage = (isHovered && secondaryImage) || primaryImage;

  const price = getEffectivePrice(product);
  const discountPercentage = getDiscountPercent(product);
  const inStock = isInStock(product);

  /*
   * A product with variants has to be configured on its own
   * page, so the card links through instead of adding an
   * unconfigured item to the cart.
   */
  /*
   * The card select fetches variant ids only, so this asks the
   * mapped flag rather than reading names off rows that are not
   * there.
   */
  const needsVariantSelection = product.hasVariants;

  const handleAddToCart = () => {
    const { added } = addItem({
      id: product.id,
      productId: product.id,
      variantIds: [],
      name: product.name,
      price,
      image: primaryImage ?? "",
      quantity: 1,
      maxQuantity: product.stock_quantity,
    });

    /*
     * The button stays enabled while stock lasts, so repeated clicks are what
     * run into the ceiling rather than the initial one.
     */
    if (added === 0) {
      toast({
        title: "No more available",
        description: `Your cart already holds all ${product.stock_quantity} in stock.`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  return (
    <div className="group flex flex-col">
      {/* Media */}
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/*
          `relative` matters: next/image with `fill` is absolutely
          positioned, so it anchors to its nearest positioned
          ancestor. Without this that is the wrapper div two
          levels up rather than this Link, which is what Next
          warns about ("parent element with invalid position").
        */}
        <Link href={`/products/${product.slug}`} className="relative block h-full w-full">
          {displayImage ? (
            <Image
              src={safeImageSrc(displayImage)}
              alt={product.name}
              fill
              /*
               * Matches the listing grid: 1 column on a phone,
               * 2 from 640, 3 from 1024, 4 from 1280. A `sizes`
               * that understates the width makes the browser
               * fetch a thumbnail and scale it up.
               */
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              /*
               * Set only for the first row of a listing. The
               * largest of these is usually the page's LCP, and
               * Next lazy-loads images by default, so it was
               * being discovered late. Opt-in rather than
               * automatic: the same card renders in the related
               * rail far below the fold, where preloading it
               * would compete with what is actually on screen.
               */
              preload={priority}
              className={cn(
                "object-cover transition-transform duration-500 ease-out",
                inStock ? "group-hover:scale-[1.04]" : "opacity-60"
              )}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2">
              <ImageOff className="h-7 w-7 text-muted-foreground/40" />
              <span className="text-[11px] text-muted-foreground/60">No image</span>
            </div>
          )}
        </Link>

        {/* Badges */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          {discountPercentage > 0 && (
            <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-foreground shadow-sm">
              {discountPercentage}% off
            </span>
          )}

          {product.featured && discountPercentage === 0 && (
            <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              Featured
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          type="button"
          disabled={saving}
          onClick={() => toggle(product.id)}
          aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={isFavorite}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-neutral-600 shadow-sm backdrop-blur transition-all hover:bg-white hover:text-brand-strong focus-visible:opacity-100 disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Heart className={cn("h-4 w-4", isFavorite && "fill-current text-brand-strong")} />
        </button>

        {!inStock && (
          <div className="absolute inset-x-0 bottom-0 bg-neutral-900/85 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            Out of stock
          </div>
        )}
      </div>

      {/* Details */}
      <div className="mt-3.5 flex flex-1 flex-col">
        {product.categories?.name && (
          <span className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {product.categories.name}
          </span>
        )}

        <Link href={`/products/${product.slug}`}>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-foreground/70">
            {product.name}
          </h3>
        </Link>

        {stats.reviewCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <StarRating value={stats.averageRating} size="sm" />
            <span className="text-[11px] text-muted-foreground">
              {formatAverageRating(stats.averageRating)} ({stats.reviewCount})
            </span>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-semibold tracking-tight">{formatCurrency(price)}</span>

          {hasDiscount(product) && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(product.price)}
            </span>
          )}
        </div>

        <div className="mt-3.5">
          {!inStock ? (
            <Button size="sm" className="w-full rounded-full" disabled>
              Out of stock
            </Button>
          ) : needsVariantSelection ? (
            <Button size="sm" variant="outline" className="w-full rounded-full" asChild>
              <Link href={`/products/${product.slug}`}>Select options</Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="brand"
              className="w-full rounded-full text-white"
              onClick={handleAddToCart}
            >
              Add to cart
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
