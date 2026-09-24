"use client";

/*
 * ---------------------------------------------------------
 * HOMEPAGE - DISCOUNT CODE POPUP
 * ---------------------------------------------------------
 *
 * The offer a first-time visitor is most likely to act on is
 * the one they are told about before they start browsing, so
 * the best promoted code gets a modal on the homepage.
 *
 * Two things keep it from being a nuisance:
 *
 *  - It is dismissed once per code, remembered in
 *    localStorage. Someone who has closed it and gone on to
 *    shop does not meet it again on their way back to the
 *    homepage, but a new campaign is a new code and so a new
 *    prompt.
 *  - It waits a moment before opening, so it lands after the
 *    page has drawn rather than on top of a half-painted hero.
 */

import { CouponCode } from "@/src/app/components/coupon-code";
import { Button } from "@/src/app/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/app/components/ui/dialog";
import { couponHeadline, couponTerms } from "@/src/app/lib/coupons";
import { usePromotedCoupons } from "@/src/app/lib/use-promoted-coupons";
import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "lamees.promo-dismissed";
const OPEN_DELAY_MS = 1200;

/*
 * localStorage throws in private-mode Safari and wherever site
 * data is blocked. A shopper whose browser will not remember
 * the dismissal is better served by a modal that still opens
 * than by a homepage that fails to render, so both sides of
 * this are guarded and neither one rethrows.
 */
function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(code: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, code);
  } catch {
    /* Shown again next visit. Not worth telling anyone about. */
  }
}

export function CouponModal() {
  const { coupons } = usePromotedCoupons();

  /*
   * One code, not a list: a modal asking a visitor to choose
   * between offers is asking them to do work before they have
   * seen anything. list_promoted_coupons already orders by
   * what runs out first, so the head of it is the one with a
   * reason to be urgent - the rest are on /sale.
   */
  const coupon = coupons[0] ?? null;

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!coupon || readDismissed() === coupon.code) {
      return;
    }

    const timer = setTimeout(() => setOpen(true), OPEN_DELAY_MS);

    /*
     * Also cancels if the code changes underneath us, which is
     * what stops a refetch from queueing a second open.
     */
    return () => clearTimeout(timer);
  }, [coupon]);

  if (!coupon) {
    return null;
  }

  /* Closing by any route - the X, Escape, the overlay - counts. */
  const handleOpenChange = (next: boolean) => {
    setOpen(next);

    if (!next) {
      writeDismissed(coupon.code);
    }
  };

  const terms = couponTerms(coupon);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="border-b-0 pb-0 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">
            Welcome offer
          </p>

          <DialogTitle className="mt-3 text-3xl font-bold tracking-tight">
            {couponHeadline(coupon)}
          </DialogTitle>

          <DialogDescription>
            {terms.length > 0 ? terms.join(" · ") : "No minimum spend."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 px-6 pb-8 pt-6 text-center">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">Use this code at checkout</p>

            <CouponCode code={coupon.code} className="text-lg" />
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row">
            {/* Closing on the way out records the dismissal too. */}
            <DialogClose asChild>
              <Button asChild variant="brand" className="flex-1">
                <Link href="/sale">Shop the sale</Link>
              </Button>
            </DialogClose>

            <DialogClose asChild>
              <Button variant="ghost" className="flex-1">
                Maybe later
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
