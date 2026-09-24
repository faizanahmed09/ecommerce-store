"use client";

/*
 * ---------------------------------------------------------
 * ADMIN / COUPON QUERIES
 * ---------------------------------------------------------
 *
 * The coupons table has no public read policy - shoppers
 * present a code and redeem_coupon() answers yes or no, so
 * nobody can list what has not been released. These reads and
 * writes run as staff, and coupons_admin_manage is what lets
 * them through.
 */

import { createClient } from "@/src/app/lib/supabase/client";

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_subtotal: number;
  max_discount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  times_used: number;
  active: boolean;
  promoted: boolean;
  created_at: string | null;
}

export type CouponPayload = Omit<Coupon, "id" | "times_used" | "created_at">;

const SELECT =
  "id, code, description, discount_type, discount_value, min_subtotal, max_discount, starts_at, expires_at, max_uses, times_used, active, promoted, created_at";

export async function fetchCoupons(): Promise<Coupon[]> {
  const { data, error } = await createClient()
    .from("coupons")
    .select(SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as Coupon[];
}

export async function createCoupon(payload: CouponPayload): Promise<void> {
  const { error } = await createClient().from("coupons").insert(payload);

  if (error) {
    throw error;
  }
}

export async function updateCoupon(id: string, payload: CouponPayload): Promise<void> {
  const { error } = await createClient()
    .from("coupons")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await createClient().from("coupons").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

/*
 * Switching a code off is the safe counterpart to deleting it:
 * a deleted coupon takes its usage history with it, which
 * matters when you are trying to work out what a campaign did.
 */
export async function setCouponActive(id: string, active: boolean): Promise<void> {
  const { error } = await createClient()
    .from("coupons")
    .update({
      active,
      /*
       * Switching a code off takes it out of the sale page and
       * the homepage with it. list_promoted_coupons filters on
       * active anyway, but leaving the flag set would mean
       * switching the code back on silently re-advertises it.
       */
      ...(active ? {} : { promoted: false }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}
