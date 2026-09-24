"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  RotateCcw,
  Share2,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/src/app/components/cart-provider";
import { ProductReviews } from "@/src/app/components/product-reviews";
import { SizeGuide } from "@/src/app/components/size-guide";
import { useWishlist } from "@/src/app/lib/use-wishlist";
import { StarRating } from "@/src/app/components/ui/star-rating";
import {
  EMPTY_REVIEW_STATS,
  fetchReviewStats,
  formatAverageRating,
  formatReviewCount,
  type ReviewStats,
} from "@/src/app/lib/reviews";
import { Button } from "@/src/app/components/ui/button";
import { Label } from "@/src/app/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/src/app/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/app/components/ui/tabs";
import {
  getDiscountPercent,
  getEffectivePrice,
  groupVariants,
  hasDiscount,
  type ProductVariant,
  type StorefrontProduct,
} from "@/src/app/lib/products";
import { formatCurrency, safeImageSrc } from "@/src/app/lib/utils";
import { FREE_SHIPPING_COPY, FREE_SHIPPING_LABEL } from "@/src/app/lib/order-totals";

interface ProductDetailsProps {
  product: StorefrontProduct;
}

const FALLBACK_IMAGE = "/placeholder.svg";

/*
 * Colour swatches are only drawn when the variant value names
 * a colour CSS understands; anything else renders as a plain
 * option chip.
 */
const CSS_COLORS = new Set([
  "black",
  "white",
  "red",
  "blue",
  "green",
  "yellow",
  "navy",
  "grey",
  "gray",
  "brown",
  "beige",
  "pink",
  "purple",
  "orange",
  "maroon",
  "teal",
]);

export function ProductDetails({ product }: ProductDetailsProps) {
  /* One selected variant id per group name, e.g. { Size: "uuid" }. */
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [brokenImages, setBrokenImages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("description");

  /*
   * The average lives here rather than inside the reviews tab:
   * the headline rating has to be on screen before anyone opens
   * that tab, and Radix unmounts the panels it is not showing.
   */
  const [reviewStats, setReviewStats] = useState<ReviewStats>(EMPTY_REVIEW_STATS);

  const { addItem } = useCart();
  const { toast } = useToast();

  /*
   * The same hook the product cards use, so the heart here and
   * the heart on any grid are one piece of state: saving from
   * either fills both, and a page of cards costs one wishlist
   * query rather than one per card.
   */
  const { isSaved, toggle: toggleFavorite, saving: savingFavorite } = useWishlist();

  const isFavorite = isSaved(product.id);

  const loadReviewStats = useCallback(async () => {
    try {
      setReviewStats(await fetchReviewStats(product.id));
    } catch (error: unknown) {
      /* A missing average is not worth breaking the page over. */
      console.error("Could not read review stats:", error);
    }
  }, [product.id]);

  useEffect(() => {
    /*
     * Fetching from the server is exactly the external-system sync an effect
     * is for; the rule cannot see that the setState happens in the awaited
     * continuation rather than during this render.
     */
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    loadReviewStats();
  }, [loadReviewStats]);

  const productImages = useMemo(() => {
    const images = product.product_images
      .map((image) => image.image_url?.trim())
      .filter((image): image is string => Boolean(image));

    return images.length > 0 ? images : [FALLBACK_IMAGE];
  }, [product.product_images]);

  /*
   * Pickers come from product_variants, so a product only
   * shows the options it actually has.
   */
  const variantGroups = useMemo(
    () => groupVariants(product.product_variants),
    [product.product_variants]
  );

  const chosenVariants = useMemo<ProductVariant[]>(
    () =>
      variantGroups
        .map((group) => group.values.find((variant) => variant.id === selectedVariants[group.name]))
        .filter((variant): variant is ProductVariant => Boolean(variant)),
    [variantGroups, selectedVariants]
  );

  const basePrice = product.price;

  /* Each selected variant can nudge the price. */
  const priceAdjustment = chosenVariants.reduce(
    (total, variant) => total + variant.price_adjustment,
    0
  );

  const currentPrice = getEffectivePrice(product) + priceAdjustment;
  const listPrice = basePrice + priceAdjustment;
  const discountPercentage = getDiscountPercent(product);

  /*
   * Stock is the tightest of the selected variants, falling
   * back to the product-level quantity.
   */
  const availableStock =
    chosenVariants.length > 0
      ? Math.min(...chosenVariants.map((variant) => variant.stock_quantity))
      : product.stock_quantity;

  const allGroupsChosen = variantGroups.every((group) => Boolean(selectedVariants[group.name]));

  const categoryName = product.categories?.name;
  const categorySlug = product.categories?.slug;

  /*
   * Derived rather than corrected in an effect: if the gallery shrinks under
   * the selected index, the clamp has to apply on the very render that shows
   * the shorter list, not one render later.
   */
  const activeImage = Math.min(selectedImage, Math.max(productImages.length - 1, 0));

  const showToast = (title: string, description: string, variant?: "default" | "destructive") => {
    toast({ title, description, variant });
  };

  const handleAddToCart = () => {
    if (!allGroupsChosen) {
      const missing = variantGroups
        .filter((group) => !selectedVariants[group.name])
        .map((group) => group.name.toLowerCase());

      showToast(
        "Select your options",
        `Choose a ${missing.join(" and ")} before adding this product to your cart.`,
        "destructive"
      );
      return;
    }

    if (availableStock <= 0) {
      showToast("Out of stock", "This combination is not available right now.", "destructive");
      return;
    }

    /*
     * The cart keys on id, so the chosen variants are part of
     * it - otherwise two sizes would collapse into one line.
     */
    const variantSuffix = chosenVariants.map((variant) => variant.id).join("-");

    const variantLabel = chosenVariants
      .map((variant) => `${variant.name}: ${variant.value}`)
      .join(", ");

    const { added, capped } = addItem({
      id: variantSuffix ? `${product.id}-${variantSuffix}` : product.id,
      productId: product.id,
      variantIds: chosenVariants.map((variant) => variant.id),
      name: variantLabel ? `${product.name} (${variantLabel})` : product.name,
      price: currentPrice,
      image: productImages[0] || FALLBACK_IMAGE,
      quantity,
      maxQuantity: availableStock,
    });

    /*
     * The cart may already hold some of this line, so a request within the
     * stock figure shown on the page can still exceed what is left.
     */
    if (added === 0) {
      showToast(
        "Already in your cart",
        `Only ${availableStock} of this item ${availableStock === 1 ? "is" : "are"} available, and your cart holds them all.`,
        "destructive"
      );
      return;
    }

    if (capped) {
      showToast(
        "Limited stock",
        `Only ${added} more could be added — ${availableStock} available in total.`,
        "destructive"
      );
      return;
    }

    showToast("Added to cart", `${product.name} has been added to your cart.`);
  };

  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: product.name,
          text: product.description || "Check out this product.",
          url: window.location.href,
        });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        showToast("Link copied", "Product link copied to your clipboard.");
        return;
      }

      showToast("Sharing unavailable", "Copy the page URL from your browser.");
    } catch (error) {
      // navigator.share throws when the user closes the share sheet.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      showToast(
        "Couldn't share",
        "Please try copying the product URL from your browser.",
        "destructive"
      );
    }
  };

  /*
   * next/image rewrites src through the optimizer and re-renders on state
   * changes, so a broken shot is remembered here rather than patched onto
   * the DOM node.
   */
  /*
   * Which picker the size guide belongs beside. Matched loosely
   * because the group name is whatever an admin typed into
   * product_variants.name - "Size", "size", "Sizes".
   */
  const sizeGroupName = variantGroups.find((group) =>
    group.name.trim().toLowerCase().startsWith("size")
  )?.name;

  const resolveImage = (src: string) =>
    brokenImages.includes(src) ? FALLBACK_IMAGE : safeImageSrc(src, FALLBACK_IMAGE);

  const handleImageError = (src: string) => {
    setBrokenImages((current) => (current.includes(src) ? current : [...current, src]));
  };

  /* Stepping from the clamped index, so a shrunken gallery cannot strand it. */
  const goToPreviousImage = () => {
    setSelectedImage(activeImage === 0 ? productImages.length - 1 : activeImage - 1);
  };

  const goToNextImage = () => {
    setSelectedImage((activeImage + 1) % productImages.length);
  };

  return (
    <section className="w-full">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start">
        {/* Gallery */}
        <div className="lg:sticky lg:top-6">
          <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl border bg-muted/30 shadow-sm">
            <Image
              src={resolveImage(productImages[activeImage] || FALLBACK_IMAGE)}
              alt={product.name}
              fill
              preload
              sizes="(min-width: 1024px) 440px, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
              onError={() => handleImageError(productImages[activeImage] || FALLBACK_IMAGE)}
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />

            {discountPercentage > 0 && (
              <span className="absolute left-5 top-5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold tracking-wide text-background shadow-lg">
                Save {discountPercentage}%
              </span>
            )}

            {productImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPreviousImage}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 shadow-md backdrop-blur transition hover:scale-105 hover:bg-background"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToNextImage}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 shadow-md backdrop-blur transition hover:scale-105 hover:bg-background"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            <div className="absolute bottom-4 right-4 rounded-full bg-background/90 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur">
              {activeImage + 1} / {productImages.length}
            </div>
          </div>

          {productImages.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {productImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  aria-label={`View product image ${index + 1}`}
                  aria-current={activeImage === index}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-muted/30 transition-all duration-200 ${
                    activeImage === index
                      ? "border-foreground shadow-md"
                      : "border-transparent opacity-70 hover:border-border hover:opacity-100"
                  }`}
                >
                  <Image
                    src={resolveImage(image || FALLBACK_IMAGE)}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                    onError={() => handleImageError(image || FALLBACK_IMAGE)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product information */}
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {categoryName && categorySlug ? (
              <Link
                href={`/categories/${categorySlug}`}
                className="font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {categoryName}
              </Link>
            ) : categoryName ? (
              <span>{categoryName}</span>
            ) : null}

            {categoryName && <span aria-hidden="true">•</span>}
            <span>Premium quality</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>

          {/* Jumps to the reviews rather than repeating them here. */}
          {reviewStats.reviewCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className="mt-2 flex items-center gap-2 text-sm transition-colors hover:text-foreground/70"
            >
              <StarRating value={reviewStats.averageRating} size="sm" />
              <span className="font-semibold">
                {formatAverageRating(reviewStats.averageRating)}
              </span>
              <span className="text-muted-foreground underline underline-offset-4">
                {formatReviewCount(reviewStats.reviewCount)}
              </span>
            </button>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="text-2xl font-bold tracking-tight">
              {formatCurrency(currentPrice)}
            </span>

            {hasDiscount(product) && (
              <>
                <span className="mb-0.5 text-base text-muted-foreground line-through">
                  {formatCurrency(listPrice)}
                </span>
                <span className="mb-0.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {discountPercentage}% off
                </span>
              </>
            )}
          </div>

          {product.description && (
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              {product.description}
            </p>
          )}

          {!sizeGroupName && (
            <div className="mt-4">
              <SizeGuide productName={product.name} />
            </div>
          )}

          <div className="my-6 h-px bg-border" />

          {/* Variant pickers, one per product_variants group */}
          {variantGroups.map((group) => {
            const selectedId = selectedVariants[group.name];
            const selected = group.values.find((variant) => variant.id === selectedId);

            return (
              <div key={group.name} className="mb-6">
                {/*
                  The guide sits opposite the label, on the row
                  that introduces the size chips - where a
                  shopper looks the moment they have to commit
                  to one. The selection moves in beside the
                  label to make room for it.
                */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h2 className="text-sm font-semibold">{group.name}</h2>

                    <span className="text-xs text-muted-foreground">
                      {selected ? `· ${selected.value}` : `· choose a ${group.name.toLowerCase()}`}
                    </span>
                  </div>

                  {group.name === sizeGroupName && <SizeGuide productName={product.name} />}
                </div>

                <RadioGroup
                  value={selectedId ?? ""}
                  onValueChange={(value) =>
                    setSelectedVariants((current) => ({
                      ...current,
                      [group.name]: value,
                    }))
                  }
                  className="flex flex-wrap gap-2"
                  aria-label={`Select ${group.name.toLowerCase()}`}
                >
                  {group.values.map((variant) => {
                    const soldOut = variant.stock_quantity <= 0;
                    const swatch = CSS_COLORS.has(variant.value.toLowerCase())
                      ? variant.value.toLowerCase()
                      : null;

                    return (
                      <div key={variant.id}>
                        <RadioGroupItem
                          value={variant.id}
                          id={`variant-${variant.id}`}
                          disabled={soldOut}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={`variant-${variant.id}`}
                          title={soldOut ? "Out of stock" : undefined}
                          className={`flex h-11 min-w-12 items-center justify-center gap-2.5 rounded-xl border px-4 text-sm font-medium transition-all peer-data-[state=checked]:border-foreground peer-data-[state=checked]:bg-foreground peer-data-[state=checked]:text-background ${
                            soldOut
                              ? "cursor-not-allowed text-muted-foreground line-through opacity-50"
                              : "cursor-pointer hover:border-foreground/50"
                          }`}
                        >
                          {swatch && (
                            <span
                              aria-hidden="true"
                              className="h-5 w-5 rounded-full border border-black/10 shadow-sm"
                              style={{ backgroundColor: swatch }}
                            />
                          )}
                          {variant.value}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>
            );
          })}

          {/* Quantity + actions */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="flex h-11 w-full items-center rounded-xl border bg-background sm:w-auto">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="flex h-full w-12 items-center justify-center rounded-l-xl text-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <span
                aria-live="polite"
                className="flex h-full w-10 items-center justify-center border-x text-sm font-semibold"
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setQuantity((current) => Math.min(Math.max(availableStock, 1), current + 1))
                }
                disabled={quantity >= Math.max(availableStock, 1)}
                aria-label="Increase quantity"
                className="flex h-full w-12 items-center justify-center rounded-r-xl text-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>

            <Button
              onClick={handleAddToCart}
              disabled={availableStock <= 0}
              className="h-11 flex-1 rounded-xl text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5 disabled:translate-y-0"
            >
              {availableStock <= 0 ? "Out of stock" : "Add to cart"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => toggleFavorite(product.id)}
              disabled={savingFavorite}
              aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={isFavorite}
              className="h-11 w-11 shrink-0 rounded-xl"
            >
              <Heart className={`h-5 w-5 transition ${isFavorite ? "fill-current" : ""}`} />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleShare}
              aria-label="Share product"
              className="h-11 w-11 shrink-0 rounded-xl"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>

          <p className="mb-6 text-xs text-muted-foreground">
            {availableStock <= 0
              ? "This product is currently unavailable."
              : variantGroups.length > 0 && !allGroupsChosen
                ? `Select a ${variantGroups
                    .map((group) => group.name.toLowerCase())
                    .join(" and ")} to add this product to your cart.`
                : availableStock <= 5
                  ? `Only ${availableStock} left in stock.`
                  : "In stock and ready to ship."}
          </p>

          {/* Service highlights */}
          <div className="grid overflow-hidden rounded-2xl border bg-muted/20 sm:grid-cols-3">
            <div className="flex items-center gap-3 border-b p-3 sm:border-b-0 sm:border-r">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold">Free shipping</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Orders over {FREE_SHIPPING_LABEL}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-b p-3 sm:border-b-0 sm:border-r">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold">Easy returns</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">30-day returns</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background shadow-sm">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold">Authentic</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">100% genuine products</p>
              </div>
            </div>
          </div>

          {/* Product tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid h-10 w-full grid-cols-4 rounded-xl bg-muted p-1">
              <TabsTrigger value="description" className="rounded-lg text-xs sm:text-sm">
                Description
              </TabsTrigger>
              <TabsTrigger value="details" className="rounded-lg text-xs sm:text-sm">
                Details
              </TabsTrigger>
              <TabsTrigger value="shipping" className="rounded-lg text-xs sm:text-sm">
                Shipping
              </TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-lg text-xs sm:text-sm">
                Reviews
                {reviewStats.reviewCount > 0 && ` (${reviewStats.reviewCount})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="description"
              className="mt-4 text-sm leading-6 text-muted-foreground"
            >
              <p>{product.description || "No description available."}</p>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  categoryName ? `Category: ${categoryName}` : null,
                  `SKU: ${product.slug}`,
                  ...variantGroups.map(
                    (group) =>
                      `${group.name}: ${group.values.map((variant) => variant.value).join(", ")}`
                  ),
                  availableStock > 0
                    ? `Availability: ${availableStock} in stock`
                    : "Availability: Out of stock",
                ]
                  .filter((detail): detail is string => Boolean(detail))
                  .map((detail) => (
                    <li key={detail} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {detail}
                    </li>
                  ))}
              </ul>
            </TabsContent>

            <TabsContent value="shipping" className="mt-4 text-sm leading-6 text-muted-foreground">
              <p>
                Standard delivery: 3–5 business days
                <br />
                Express delivery: 1–2 business days
                <br />
                {FREE_SHIPPING_COPY}
              </p>
            </TabsContent>

            <TabsContent value="reviews">
              <ProductReviews
                productId={product.id}
                productName={product.name}
                stats={reviewStats}
                onReviewsChanged={loadReviewStats}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
