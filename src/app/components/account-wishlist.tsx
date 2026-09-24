"use client";

import { useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/src/app/components/ui/button";
import { EmptyState } from "@/src/app/components/ui/empty-state";
import { useAsyncData } from "@/src/app/lib/use-async-data";
import {
  fetchWishlistItems,
  removeWishlistItem,
  type WishlistItem,
  type WishlistProduct,
} from "@/src/app/lib/wishlist";
import { useAuth } from "@/src/app/context/auth-context";
import { useCart } from "@/src/app/components/cart-provider";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, safeImageSrc } from "@/src/app/lib/utils";

const NO_ITEMS: WishlistItem[] = [];

export function AccountWishlist() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { toast } = useToast();

  const fetchItems = useCallback(async (): Promise<WishlistItem[]> => {
    if (!user) {
      return NO_ITEMS;
    }

    return fetchWishlistItems(user.id);
  }, [user]);

  const onError = useCallback((error: unknown) => {
    console.error("Error fetching wishlist:", error);
  }, []);

  const {
    data: wishlistItems,
    loading,
    error,
    reload,
    setData: setWishlistItems,
  } = useAsyncData(fetchItems, {
    fallback: NO_ITEMS,
    enabled: Boolean(user),
    onError,
  });

  const handleRemoveFromWishlist = async (itemId: string, productName: string) => {
    setWishlistItems((prev) => prev.filter((item) => item.id !== itemId));

    toast({
      title: "Item removed",
      description: `${productName} has been removed from your wishlist.`,
    });

    if (!user) {
      return;
    }

    try {
      await removeWishlistItem(itemId);
    } catch (error: unknown) {
      console.error("Error removing item from wishlist:", error);

      /* Put the row back, since the optimistic removal was wrong. */
      reload();

      toast({
        title: "Couldn't remove that item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddToCart = (product: WishlistProduct) => {
    const primaryImage =
      product.product_images.find((img) => img.is_primary)?.image_url ||
      product.product_images[0]?.image_url ||
      "/placeholder.svg";

    if (product.stock_quantity <= 0) {
      toast({
        title: "Out of stock",
        description: `${product.name} is not available right now.`,
        variant: "destructive",
      });
      return;
    }

    const { added } = addItem({
      id: product.id,
      productId: product.id,
      variantIds: [],
      name: product.name,
      price: product.sale_price || product.price,
      image: primaryImage,
      quantity: 1,
      maxQuantity: product.stock_quantity,
    });

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

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {Array(3)
          .fill(null)
          .map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
              <div className="mb-4 aspect-square rounded bg-muted"></div>
              <div className="mb-2 h-4 w-3/4 rounded bg-muted"></div>
              <div className="h-4 w-1/2 rounded bg-muted"></div>
            </div>
          ))}
      </div>
    );
  }

  /* A failed load is not an empty wishlist, and must not read like one. */
  if (error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn't load your wishlist"
        description="Something went wrong reaching the store. Nothing has been lost — try again in a moment."
        action={
          <Button variant="outline" onClick={reload}>
            Try again
          </Button>
        }
      />
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Save products you like and they'll be waiting for you here."
        action={
          <Button asChild>
            <Link href="/products">Browse products</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Your Wishlist</h3>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {wishlistItems.map((item) => {
          const product = item.products;
          const primaryImage =
            product.product_images.find((img) => img.is_primary)?.image_url ||
            product.product_images[0]?.image_url ||
            "/placeholder.svg";

          return (
            <div key={item.id} className="group relative overflow-hidden rounded-lg border bg-card">
              <div className="relative aspect-square overflow-hidden">
                <Link href={`/products/${product.slug}`}>
                  <Image
                    src={safeImageSrc(primaryImage)}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </Link>
                {product.sale_price && (
                  <div className="absolute left-2 top-2 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                    {Math.round(((product.price - product.sale_price) / product.price) * 100)}% OFF
                  </div>
                )}
              </div>
              <div className="p-4">
                <Link href={`/products/${product.slug}`}>
                  <h4 className="mb-1 font-medium">{product.name}</h4>
                </Link>
                <div className="mb-4 flex items-center">
                  {product.sale_price ? (
                    <>
                      <span className="font-semibold">{formatCurrency(product.sale_price)}</span>
                      <span className="ml-2 text-sm text-muted-foreground line-through">
                        {formatCurrency(product.price)}
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold">{formatCurrency(product.price)}</span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleAddToCart(product)}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add to Cart
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveFromWishlist(item.id, product.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
