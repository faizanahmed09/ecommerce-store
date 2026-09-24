"use client";

/*
 * ---------------------------------------------------------
 * ORDER TRACKING
 * ---------------------------------------------------------
 *
 * The header has linked to /track-order since before the page
 * existed, so "Order Tracking" in the top bar was a 404.
 *
 * Two ways in, because the shop takes guest checkout:
 *
 *   - Signed in, the shopper's own orders are listed straight
 *     away. RLS already lets them read those.
 *   - Otherwise, an order id plus the email it was placed with
 *     goes through the track_order function, which is the only
 *     route to a guest order - it belongs to no account, so the
 *     table itself will not hand it over.
 */

import { Button } from "@/src/app/components/ui/button";
import { Container } from "@/src/app/components/ui/container";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import { useAuth } from "@/src/app/context/auth-context";
import {
  parseOrderReference,
  toOrderNumber,
  trackOrder,
  TrackingUnavailableError,
  type TrackedOrder,
} from "@/src/app/lib/track-order";
import { formatCurrency } from "@/src/app/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2, PackageSearch, Truck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

/*
 * The fulfilment path, in order. `cancelled` is deliberately
 * not on it - it is an end, not a step, so it is shown on its
 * own rather than as a stalled progress bar.
 */
const STAGES = [
  { value: "pending", label: "Order placed" },
  { value: "processing", label: "Being prepared" },
  { value: "shipped", label: "On its way" },
  { value: "delivered", label: "Delivered" },
] as const;

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  refunded: "Refunded",
  failed: "Payment failed",
};

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function TrackOrderPage() {
  return (
    /* useSearchParams needs a boundary to prerender behind. */
    <Suspense fallback={null}>
      <TrackOrderForm />
    </Suspense>
  );
}

function TrackOrderForm() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  /* Arrives prefilled from the confirmation page's Track Order button. */
  const [reference, setReference] = useState(searchParams.get("ref") ?? "");
  const [email, setEmail] = useState("");
  const [notFound, setNotFound] = useState(false);

  const {
    mutate,
    data: order,
    isPending,
    error,
    reset,
  } = useMutation({
    mutationFn: async () => {
      const orderId = parseOrderReference(reference);

      if (!orderId) {
        throw new Error(
          "That does not look like an order number. It is the long code on your confirmation email."
        );
      }

      return trackOrder(orderId, email);
    },
    onSuccess: (result) => setNotFound(result === null),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    reset();
    setNotFound(false);
    mutate();
  };

  const errorMessage = error
    ? error instanceof TrackingUnavailableError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Something went wrong. Please try again."
    : null;

  return (
    <Container className="py-12 lg:py-16">
      <header className="mb-10 max-w-2xl">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground">Order Tracking</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Track your order</h1>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Enter your order number and the email you ordered with. Both are on your confirmation
          email.
        </p>
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reference">Order number</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="LM-C3F9A1C0"
              className="font-mono"
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email used at checkout</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full rounded-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Looking it up
              </>
            ) : (
              "Track order"
            )}
          </Button>

          {user && (
            <p className="pt-2 text-xs leading-5 text-muted-foreground">
              Signed in — every order on your account is listed under{" "}
              <Link href="/account" className="underline underline-offset-4 hover:text-foreground">
                Orders
              </Link>
              , with no order number needed.
            </p>
          )}
        </form>

        <div className="min-w-0">
          {errorMessage && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
              <p className="text-sm font-medium text-destructive">{errorMessage}</p>
            </div>
          )}

          {notFound && !errorMessage && (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <PackageSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />

              <p className="text-sm font-medium">We could not find that order</p>

              {/*
                One message for "no such order" and for "wrong
                email" on purpose - saying which would confirm to
                a stranger that an order number is real.
              */}
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Check the order number and that the email matches the one you ordered with. If it
                still does not work,{" "}
                <Link
                  href="/contact"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  get in touch
                </Link>{" "}
                and we will look it up.
              </p>
            </div>
          )}

          {order && !errorMessage && <OrderStatus order={order} />}

          {!order && !notFound && !errorMessage && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <Truck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              Your order status will appear here.
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}

function OrderStatus({ order }: { order: TrackedOrder }) {
  const cancelled = order.status === "cancelled";
  const currentIndex = STAGES.findIndex((stage) => stage.value === order.status);

  return (
    <div className="rounded-2xl border p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Order</p>

          <p className="mt-1 font-mono text-sm">{toOrderNumber(order.id)}</p>

          <p className="mt-1 text-xs text-muted-foreground">Placed {formatDate(order.placedAt)}</p>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold tracking-tight">
            {formatCurrency(order.totalAmount)}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </p>
        </div>
      </div>

      {cancelled ? (
        <p className="pt-6 text-sm leading-6 text-muted-foreground">
          This order was cancelled. If that is unexpected,{" "}
          <Link href="/contact" className="underline underline-offset-4 hover:text-foreground">
            let us know
          </Link>
          .
        </p>
      ) : (
        <ol className="space-y-5 pt-6">
          {STAGES.map((stage, index) => {
            const done = index <= currentIndex;

            return (
              <li key={stage.value} className="flex items-start gap-3">
                {done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/30" />
                )}

                <div>
                  <p className={done ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                    {stage.label}
                  </p>

                  {index === currentIndex && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Updated {formatDate(order.updatedAt)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {order.trackingNumber && (
        <div className="mt-6 rounded-xl bg-muted/40 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Courier tracking
          </p>

          <p className="mt-1 font-mono text-sm">{order.trackingNumber}</p>
        </div>
      )}
    </div>
  );
}
