"use client";

/*
 * ---------------------------------------------------------
 * DISCOUNT CODES
 * ---------------------------------------------------------
 *
 * The cart's coupon box used to be a setTimeout that answered
 * "Invalid coupon" to everything typed into it. This is the
 * client half of a box that can say yes.
 *
 * The verdict comes from redeem_coupon (migrations/004), never
 * from here: the coupons table has no public read policy, so a
 * shopper cannot list codes, and the discount is computed
 * server-side because a discount the browser calculates is a
 * discount the browser can choose.
 */

import { createClient } from "@/src/app/lib/supabase/client";
import { FeatureUnavailableError, isMissingFunction } from "@/src/app/lib/rpc";
import { formatCurrency } from "@/src/app/lib/utils";

export interface AppliedCoupon {
  code: string;
  discount: number;
}

export interface CouponResult {
  applied: AppliedCoupon | null;
  /* Why it was refused, for the shopper to read. */
  reason: string | null;
}

export class CouponsUnavailableError extends FeatureUnavailableError {
  constructor() {
    super("Discount codes are not set up yet.", "CouponsUnavailableError");
  }
}

export async function redeemCoupon(code: string, subtotal: number): Promise<CouponResult> {
  const trimmed = code.trim();

  if (!trimmed) {
    return { applied: null, reason: "Enter a code first." };
  }

  const { data, error } = await createClient().rpc("redeem_coupon", {
    p_code: trimmed,
    p_subtotal: subtotal,
  });

  if (error) {
    if (isMissingFunction(error)) {
      throw new CouponsUnavailableError();
    }

    throw error;
  }

  const row = (data as unknown as Record<string, unknown>[] | null)?.[0];

  if (!row || !row.valid) {
    return {
      applied: null,
      reason: (row?.reason as string | null) ?? "That code is not recognised.",
    };
  }

  return {
    applied: {
      code: String(row.code ?? trimmed).toUpperCase(),
      discount: Number(row.discount) || 0,
    },
    reason: null,
  };
}

/*
 * ---------------------------------------------------------
 * PROMOTED CODES
 * ---------------------------------------------------------
 *
 * A code nobody has been told about is a code nobody types.
 * list_promoted_coupons (migrations/005) returns the ones an
 * admin has ticked "promote", already filtered to the ones the
 * cart would accept - so the sale page never advertises a
 * discount that redeem_coupon then refuses.
 *
 * Still no read of the table itself: the function hands back
 * the terms a shopper needs and nothing else. The staff-only
 * `description` is not among them.
 */

export interface PromotedCoupon {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minSubtotal: number;
  maxDiscount: number | null;
  expiresAt: string | null;
}

export async function fetchPromotedCoupons(): Promise<PromotedCoupon[]> {
  const { data, error } = await createClient().rpc("list_promoted_coupons");

  if (error) {
    /*
     * An unadvertised shop is the honest fallback for a
     * migration that has not been run - there is nothing here
     * a shopper needs to be told about.
     */
    if (isMissingFunction(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? []).map((row) => ({
    code: String(row.code).toUpperCase(),
    discountType: row.discount_type === "fixed" ? "fixed" : "percent",
    discountValue: Number(row.discount_value) || 0,
    minSubtotal: Number(row.min_subtotal) || 0,
    maxDiscount: row.max_discount === null ? null : Number(row.max_discount),
    expiresAt: row.expires_at,
  }));
}

/** "25% off" / "Rs. 500 off" - the headline figure on its own. */
export function couponHeadline(coupon: PromotedCoupon): string {
  return coupon.discountType === "percent"
    ? /* numeric(10,2) arrives as 25 or 12.5, never as "25.00". */
      `${coupon.discountValue}% off`
    : `${formatCurrency(coupon.discountValue)} off`;
}

/* The end of the window, short enough to sit on one line. */
const formatEnds = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

/**
 * The strings under the headline: the conditions attached to
 * the code, each one omitted when it does not apply. Built
 * from the same fields redeem_coupon checks, so what a shopper
 * reads here is what the cart will enforce.
 */
export function couponTerms(coupon: PromotedCoupon): string[] {
  const terms: string[] = [];

  if (coupon.minSubtotal > 0) {
    terms.push(`On orders over ${formatCurrency(coupon.minSubtotal)}`);
  }

  if (coupon.discountType === "percent" && coupon.maxDiscount !== null) {
    terms.push(`Up to ${formatCurrency(coupon.maxDiscount)} off`);
  }

  if (coupon.expiresAt) {
    terms.push(`Ends ${formatEnds(coupon.expiresAt)}`);
  }

  return terms;
}
