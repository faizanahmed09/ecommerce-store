"use client";

/*
 * ---------------------------------------------------------
 * COUPON CODE CHIP
 * ---------------------------------------------------------
 *
 * A promoted code, shown so it can be copied rather than
 * squinted at and retyped - the sale panel and the homepage
 * modal both need exactly this, so it lives once.
 *
 * The whole chip is the button. A code in a box next to a
 * separate "copy" control invites a click on the box that does
 * nothing, and on a phone the box is the bigger target.
 */

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/src/app/lib/utils";

/* Long enough to read the tick, short enough not to linger. */
const CONFIRM_MS = 2000;

export function CouponCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  /* Cleared on a timer, and cancelled if the chip unmounts first. */
  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setCopied(false), CONFIRM_MS);

    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /*
       * Clipboard access is refused on insecure origins and in
       * some mobile browsers. The code is on screen either way,
       * so there is nothing to tell the shopper - the tick just
       * does not appear.
       */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={`Copy discount code ${code}`}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg border border-dashed border-brand/50",
        "bg-brand/5 px-4 py-2.5 font-mono text-base font-semibold tracking-[0.2em] text-brand",
        "transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-brand focus-visible:ring-offset-2",
        className
      )}
    >
      {code}

      {copied ? (
        <Check className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Copy className="h-4 w-4 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />
      )}

      {/* The tick is colour and shape only; this is what a screen reader gets. */}
      <span className="sr-only" role="status">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
