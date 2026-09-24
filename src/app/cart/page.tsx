"use client";

import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/src/app/components/cart-provider";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import { Separator } from "@/src/app/components/ui/separator";
import { calculateOrderTotals } from "@/src/app/lib/order-totals";
import { formatCurrency, safeImageSrc } from "@/src/app/lib/utils";
import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Container } from "@/src/app/components/ui/container";
import { useCartImages } from "@/src/app/lib/use-cart-images";
import { CouponsUnavailableError, redeemCoupon } from "@/src/app/lib/coupons";

export default function CartPage() {
  const { items, cartTotal, updateItemQuantity, removeItem, coupon, applyCoupon } = useCart();

  /* The saved URL is a snapshot; this is the product's photo now. */
  const imageFor = useCartImages(items);
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  /* Same rules the checkout and the order row use. */
  const totals = useMemo(
    () => calculateOrderTotals(cartTotal, coupon?.discount ?? 0),
    [cartTotal, coupon]
  );

  const handleQuantityChange = (id: string, quantity: number) => {
    if (quantity < 1) return;

    const item = items.find((line) => line.id === id);

    /*
     * The provider caps this anyway; saying so here is what stops the click
     * looking like it did nothing.
     */
    if (item && item.maxQuantity !== null && quantity > item.maxQuantity) {
      toast({
        title: "Limited stock",
        description: `Only ${item.maxQuantity} of ${item.name} ${
          item.maxQuantity === 1 ? "is" : "are"
        } available.`,
        variant: "destructive",
      });
      return;
    }

    updateItemQuantity(id, quantity);
  };

  const handleRemoveItem = (id: string, name: string) => {
    removeItem(id);
    toast({
      title: "Item removed",
      description: `${name} has been removed from your cart.`,
    });
  };

  /*
   * This used to be a setTimeout that answered "Invalid coupon"
   * to everything, so every shopper who tried a code was told
   * theirs had expired. The verdict now comes from the database.
   */
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || isApplyingCoupon) {
      return;
    }

    setIsApplyingCoupon(true);

    try {
      const { applied, reason } = await redeemCoupon(couponCode, cartTotal);

      if (!applied) {
        toast({
          title: "Code not applied",
          description: reason ?? "That code is not recognised.",
          variant: "destructive",
        });

        return;
      }

      applyCoupon(applied);
      setCouponCode("");

      toast({
        title: `${applied.code} applied`,
        description: `${formatCurrency(applied.discount)} off your order.`,
      });
    } catch (error: unknown) {
      console.error("Could not apply the discount code:", error);

      toast({
        title: "Couldn't check that code",
        description:
          error instanceof CouponsUnavailableError
            ? "Discount codes aren't available right now."
            : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    const removed = coupon?.code;

    applyCoupon(null);

    toast({
      title: "Code removed",
      description: removed ? `${removed} is no longer applied.` : undefined,
    });
  };

  if (items.length === 0) {
    return (
      <Container className="py-16 text-center">
        <h1 className="mb-6 text-3xl font-bold">Your Cart</h1>
        <p className="mb-8 text-gray-600">Your cart is currently empty.</p>
        <Button asChild>
          <Link href="/products">Continue Shopping</Link>
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <h1 className="mb-8 text-3xl font-bold">Your Cart</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-card">
            <div className="p-6">
              <div className="hidden border-b pb-4 md:grid md:grid-cols-12">
                <div className="col-span-6 font-medium">Product</div>
                <div className="col-span-2 text-center font-medium">Price</div>
                <div className="col-span-2 text-center font-medium">Quantity</div>
                <div className="col-span-2 text-right font-medium">Total</div>
              </div>

              <div className="divide-y">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="py-4 md:grid md:grid-cols-12 md:items-center md:gap-4"
                  >
                    <div className="col-span-6 flex items-center gap-4">
                      <div className="relative h-20 w-20 overflow-hidden rounded-md bg-muted">
                        <Image
                          src={safeImageSrc(imageFor(item))}
                          /*
                           * Empty on purpose. The product's name is
                           * the text immediately beside this - an alt
                           * repeating it makes a screen reader read
                           * the name twice in a row, and puts it into
                           * the page twice when the region is copied.
                           * A thumbnail sitting next to its own label
                           * is decorative.
                           */
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <h3 className="font-medium">{item.name}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-auto p-0 text-sm text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveItem(item.id, item.name)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="col-span-2 mt-4 text-center md:mt-0">
                      <div className="text-sm font-medium text-muted-foreground md:hidden">
                        Price:
                      </div>
                      {formatCurrency(item.price)}
                    </div>

                    <div className="col-span-2 mt-4 flex items-center justify-center md:mt-0">
                      <div className="mr-2 text-sm font-medium text-muted-foreground md:hidden">
                        Quantity:
                      </div>
                      <div className="flex items-center">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-r-none"
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                          <span className="sr-only">Decrease quantity</span>
                        </Button>
                        <div className="flex h-8 w-10 items-center justify-center border-y border-input bg-background text-sm">
                          {item.quantity}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-l-none"
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          disabled={item.maxQuantity !== null && item.quantity >= item.maxQuantity}
                        >
                          <Plus className="h-3 w-3" />
                          <span className="sr-only">Increase quantity</span>
                        </Button>
                      </div>

                      {item.maxQuantity !== null && item.quantity >= item.maxQuantity ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Max {item.maxQuantity} available
                        </p>
                      ) : null}
                    </div>

                    <div className="col-span-2 mt-4 text-right md:mt-0">
                      <div className="text-sm font-medium text-muted-foreground md:hidden">
                        Total:
                      </div>
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-xl font-semibold">Order Summary</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>

              {/*
                Delivery is a flat charge, so the cart can show the
                real total rather than deferring it to checkout and
                surprising the shopper there.
              */}
              {totals.discount > 0 && coupon && (
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="flex items-center gap-1.5">
                    Discount
                    <span className="font-mono text-xs">({coupon.code})</span>
                  </span>
                  <span>-{formatCurrency(totals.discount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span>Delivery</span>
                <span>
                  {totals.freeShipping ? (
                    <span className="font-medium text-emerald-600">Free</span>
                  ) : (
                    formatCurrency(totals.shipping)
                  )}
                </span>
              </div>

              {/*
                The threshold is worth nothing to a shopper who
                cannot see how close they are to it.
              */}
              {!totals.freeShipping && totals.remainingForFreeShipping > 0 && (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Add{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(totals.remainingForFreeShipping)}
                  </span>{" "}
                  more for free delivery.
                </p>
              )}

              <Separator />

              <div className="flex items-center justify-between font-medium">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>

              <div className="space-y-2">
                {coupon ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <span className="font-mono text-sm font-medium text-emerald-700">
                      {coupon.code}
                    </span>

                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs text-emerald-700 underline underline-offset-2 hover:no-underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleApplyCoupon();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder="Discount code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                    />
                    <Button type="submit" variant="outline" disabled={isApplyingCoupon}>
                      {isApplyingCoupon ? "Applying..." : "Apply"}
                    </Button>
                  </form>
                )}
              </div>

              <Button asChild variant="brand" className="w-full">
                <Link href="/checkout">Proceed to Checkout</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
