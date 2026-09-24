"use client";

/*
 * ---------------------------------------------------------
 * SALE PAGE - DISCOUNT CODES
 * ---------------------------------------------------------
 *
 * The sale page reduced prices and said nothing about the
 * codes that reduce them further, so the only shoppers using
 * one were the ones who already knew it existed.
 *
 * Everything here comes from list_promoted_coupons: the terms
 * shown are the same fields redeem_coupon checks at the cart,
 * so a shopper reading "on orders over Rs. 5,000" is reading
 * the rule that will actually be applied, not marketing copy
 * written beside it.
 */

import { CouponCode } from "@/src/app/components/coupon-code";
import { Container, Section } from "@/src/app/components/ui/container";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { couponHeadline, couponTerms, type PromotedCoupon } from "@/src/app/lib/coupons";
import { usePromotedCoupons } from "@/src/app/lib/use-promoted-coupons";
import { Tag } from "lucide-react";

function CouponCard({ coupon }: { coupon: PromotedCoupon }) {
  const terms = couponTerms(coupon);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-background p-5 shadow-sm">
      <div>
        <p className="text-2xl font-bold tracking-tight text-brand">{couponHeadline(coupon)}</p>

        {/*
          An unconditional code has no terms to list, and an
          empty line under the headline reads as a missing one.
        */}
        {terms.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {terms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No minimum spend.</p>
        )}
      </div>

      <CouponCode code={coupon.code} className="self-start" />
    </div>
  );
}

export function SaleCoupons() {
  const { coupons, loading } = usePromotedCoupons();

  if (loading) {
    return (
      <Section className="py-10 sm:py-12">
        <Container>
          <Skeleton className="mx-auto h-6 w-48" />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        </Container>
      </Section>
    );
  }

  /* Nothing promoted is not an empty state - it is no band at all. */
  if (coupons.length === 0) {
    return null;
  }

  return (
    <Section className="border-y bg-muted/30 py-10 sm:py-12">
      <Container>
        <div className="mb-6 flex items-center justify-center gap-2 text-center">
          <Tag className="h-5 w-5 text-brand" aria-hidden />

          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {coupons.length === 1 ? "Use this code at checkout" : "Codes to use at checkout"}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <CouponCard key={coupon.code} coupon={coupon} />
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Tap a code to copy it, then paste it into the discount box in your cart. The saving is
          worked out when the code is applied.
        </p>
      </Container>
    </Section>
  );
}
