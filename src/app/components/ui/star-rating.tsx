"use client";

import { Star } from "lucide-react";
import { useState } from "react";

import { cn } from "@/src/app/lib/utils";

const SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-7 w-7",
} as const;

type StarSize = keyof typeof SIZES;

interface StarRatingProps {
  /* Fractional values are fine: 4.3 half-fills the fifth star. */
  value: number;
  size?: StarSize;
  className?: string;
  /* Screen readers get the number; the stars themselves are decoration. */
  label?: string;
}

/*
 * Read-only stars.
 *
 * The partial fill is a second, clipped row of stars laid over
 * the empty ones, so an average of 4.3 looks like 4.3 rather
 * than rounding up to a flattering 5.
 */
export function StarRating({ value, size = "md", className, label }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const starClass = SIZES[size];

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      role="img"
      aria-label={label ?? `Rated ${clamped.toFixed(1)} out of 5`}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={index} className={cn(starClass, "text-neutral-300")} />
        ))}
      </span>

      <span
        className="pointer-events-none absolute inset-0 flex gap-0.5 overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={index} className={cn(starClass, "shrink-0 fill-[#FFB33E] text-[#FFB33E]")} />
        ))}
      </span>
    </span>
  );
}

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  size?: StarSize;
  disabled?: boolean;
  className?: string;
}

const RATING_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"] as const;

/*
 * The star picker in the review form.
 *
 * Five real radio inputs behind the icons: that is what makes
 * the control reachable by keyboard and announceable, which a
 * row of clickable <svg>s is not.
 */
export function StarRatingInput({
  value,
  onChange,
  size = "xl",
  disabled = false,
  className,
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0);

  /* Hovering previews a rating without committing to it. */
  const shown = hovered || value;
  const starClass = SIZES[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="flex gap-1"
        onMouseLeave={() => setHovered(0)}
        role="radiogroup"
        aria-label="Your rating"
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <label
            key={rating}
            onMouseEnter={() => !disabled && setHovered(rating)}
            className={cn(
              "rounded transition-transform focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:scale-110"
            )}
          >
            <input
              type="radio"
              name="review-rating"
              value={rating}
              checked={value === rating}
              disabled={disabled}
              onChange={() => onChange(rating)}
              className="sr-only"
            />
            <span className="sr-only">
              {rating} star{rating === 1 ? "" : "s"} — {RATING_LABELS[rating - 1]}
            </span>
            <Star
              aria-hidden="true"
              className={cn(
                starClass,
                "transition-colors",
                rating <= shown ? "fill-[#FFB33E] text-[#FFB33E]" : "text-neutral-300"
              )}
            />
          </label>
        ))}
      </div>

      <span className="text-sm font-medium text-muted-foreground" aria-live="polite">
        {shown > 0 ? RATING_LABELS[shown - 1] : "Tap a star"}
      </span>
    </div>
  );
}
