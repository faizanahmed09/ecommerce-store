import { gradientFor } from "@/src/app/lib/navigation";
import { cn } from "@/src/app/lib/utils";

/*
 * ---------------------------------------------------------
 * CATEGORY ARTWORK
 * ---------------------------------------------------------
 *
 * What a category tile shows when the row has no banner.
 *
 * Every grid used to fall back to a big faded initial on flat
 * neutral-900, which read as a placeholder. This is the card
 * the mega menu already draws for the same department - the
 * same gradient, keyed off the same slug - so an uploaded
 * banner and a missing one both look deliberate, and the two
 * places a department appears agree on its colour.
 *
 * Background only: the tile keeps its own name overlay on top,
 * which is what carries the category's name.
 */

export function CategoryArtwork({
  slug,
  className,
}: {
  /* The palette is keyed off the slug, not the name. */
  slug: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 overflow-hidden bg-gradient-to-br",
        gradientFor(slug),
        className
      )}
    >
      {/*
        Sized in percentages rather than pixels so one component
        serves the six-across showcase and a full-width tile
        alike, with the arcs falling in the same place on both.
      */}
      <span className="absolute -right-[15%] -top-[15%] aspect-square w-[70%] rounded-full bg-white/10 transition-transform duration-500 ease-out group-hover:scale-110" />

      <span className="absolute -bottom-[22%] -left-[18%] aspect-square w-[60%] rounded-full bg-black/10" />

      {/* Keeps the name legible wherever the gradient runs light. */}
      <span className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
    </div>
  );
}
