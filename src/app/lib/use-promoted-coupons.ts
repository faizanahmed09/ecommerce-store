"use client";

/*
 * ---------------------------------------------------------
 * usePromotedCoupons
 * ---------------------------------------------------------
 *
 * Two surfaces advertise the same codes - the panel on /sale
 * and the modal on the homepage - and a shopper who lands on
 * one and navigates to the other should not pay for a second
 * round trip. Cached by react-query so they share it.
 *
 * A shop with nothing promoted, or a shop whose 005 migration
 * has not been run, gets an empty list; both surfaces render
 * nothing rather than an empty frame.
 */

import { fetchPromotedCoupons, type PromotedCoupon } from "@/src/app/lib/coupons";
import { useQuery } from "@tanstack/react-query";

export const PROMOTED_COUPONS_KEY = ["promoted-coupons"] as const;

/*
 * Longer than the product cache: a discount code's terms are
 * fixed for the length of a campaign, so re-reading them on
 * every navigation buys nothing. Its own constant rather than
 * the provider default, because the reason differs.
 */
const STALE_TIME_MS = 5 * 60_000;

const NO_COUPONS: PromotedCoupon[] = [];

export function usePromotedCoupons(): { coupons: PromotedCoupon[]; loading: boolean } {
  const { data, isPending } = useQuery({
    queryKey: PROMOTED_COUPONS_KEY,
    queryFn: fetchPromotedCoupons,
    staleTime: STALE_TIME_MS,
    /*
     * A banner that failed to load is not worth retrying at a
     * shopper's expense - the shop below it works either way.
     */
    retry: false,
  });

  return { coupons: data ?? NO_COUPONS, loading: isPending };
}
