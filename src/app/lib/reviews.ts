import { createClient } from "@/src/app/lib/supabase/client";

/*
 * Product reviews.
 *
 * Everything a shopper is not allowed to decide for themselves
 * - the byline, the "Verified purchase" badge, the moderation
 * status, the store's reply - is set by the database trigger in
 * schema.sql, not here. This module only ever sends the rating
 * and the words.
 */

export type ReviewStatus = "published" | "hidden";

export type StarValue = 1 | 2 | 3 | 4 | 5;

export const STAR_VALUES: readonly StarValue[] = [5, 4, 3, 2, 1];

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewer_name: string;
  status: ReviewStatus;
  is_verified_purchase: boolean;
  admin_response: string | null;
  admin_response_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/* A review as the admin moderation screen lists it. */
export interface AdminReview extends ProductReview {
  product: { name: string; slug: string } | null;
}

export interface ReviewStats {
  reviewCount: number;
  averageRating: number;
  /* How many reviews gave each star, 5 down to 1. */
  distribution: Record<StarValue, number>;
}

export const EMPTY_REVIEW_STATS: ReviewStats = {
  reviewCount: 0,
  averageRating: 0,
  distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

export type ReviewSort = "recent" | "highest" | "lowest";

export const REVIEW_SORTS: ReadonlyArray<{
  value: ReviewSort;
  label: string;
}> = [
  { value: "recent", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export interface ReviewDraft {
  rating: number;
  title: string;
  body: string;
}

const REVIEW_COLUMNS =
  "id, product_id, user_id, rating, title, body, reviewer_name, status, " +
  "is_verified_purchase, admin_response, admin_response_at, created_at, updated_at";

/*
 * The row shape Postgres hands back. `status` is a VARCHAR with
 * a CHECK constraint rather than an enum, so it arrives as a
 * plain string and is narrowed on the way through.
 */
type ReviewRow = Omit<ProductReview, "status"> & { status: string };

const toReview = (row: ReviewRow): ProductReview => ({
  ...row,
  status: row.status === "hidden" ? "hidden" : "published",
});

/* Trims the form and stores a blank optional field as NULL. */
const optionalText = (value: string | null | undefined): string | null => value?.trim() || null;

/*
 * "Most recent" is the default because a product page is read
 * top down; the other two orderings exist so a shopper can go
 * looking for the complaints without paging through the praise.
 */
export async function fetchProductReviews(
  productId: string,
  sort: ReviewSort = "recent"
): Promise<ProductReview[]> {
  const supabase = createClient();

  let query = supabase.from("reviews").select(REVIEW_COLUMNS).eq("product_id", productId);

  if (sort === "highest") {
    query = query.order("rating", { ascending: false });
  } else if (sort === "lowest") {
    query = query.order("rating", { ascending: true });
  }

  /* Always the final tie-break, so equal ratings stay stable. */
  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toReview(row as unknown as ReviewRow));
}

/*
 * The average, the total and the histogram in one round trip.
 *
 * product_review_stats counts published reviews only, so the
 * summary a visitor sees matches the list underneath it even
 * when staff have hidden something.
 */
export async function fetchReviewStats(productId: string): Promise<ReviewStats> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_review_stats")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    /* No rows in the view means no reviews yet, not a failure. */
    return EMPTY_REVIEW_STATS;
  }

  return {
    reviewCount: Number(data.review_count ?? 0),
    averageRating: Number(data.average_rating ?? 0),
    distribution: {
      5: Number(data.five_star ?? 0),
      4: Number(data.four_star ?? 0),
      3: Number(data.three_star ?? 0),
      2: Number(data.two_star ?? 0),
      1: Number(data.one_star ?? 0),
    },
  };
}

/*
 * Stats for a whole grid of products in one query, keyed by
 * product id. Products with no reviews are simply absent from
 * the map - read it with EMPTY_REVIEW_STATS as the fallback.
 */
/*
 * Stars resolved on the server for a known set of products.
 *
 * The ids travel with them so the client hook can tell whether
 * the seed still describes what is on screen: the moment the
 * grid pages or filters, it does not, and the hook goes to the
 * network as it always did.
 */
/*
 * Ratings by product id. Lives here rather than in the hook so
 * a server component can read it too - the hook module is
 * "use client", and a server render cannot call into it.
 */
export type ReviewStatsMap = ReadonlyMap<string, ReviewStats>;

/* Products with no reviews are absent from the map. */
export const statsFor = (stats: ReviewStatsMap | undefined, productId: string): ReviewStats =>
  stats?.get(productId) ?? EMPTY_REVIEW_STATS;

export interface SeededReviewStats {
  ids: string[];
  stats: Record<string, ReviewStats>;
}

export async function fetchReviewStatsByProduct(
  productIds: string[]
): Promise<Map<string, ReviewStats>> {
  const stats = new Map<string, ReviewStats>();

  if (productIds.length === 0) {
    return stats;
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_review_stats")
    .select("*")
    .in("product_id", productIds);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    if (!row.product_id) {
      continue;
    }

    stats.set(row.product_id, {
      reviewCount: Number(row.review_count ?? 0),
      averageRating: Number(row.average_rating ?? 0),
      distribution: {
        5: Number(row.five_star ?? 0),
        4: Number(row.four_star ?? 0),
        3: Number(row.three_star ?? 0),
        2: Number(row.two_star ?? 0),
        1: Number(row.one_star ?? 0),
      },
    });
  }

  return stats;
}

/*
 * The signed-in shopper's own review of this product, if there
 * is one. It comes back even when staff have hidden it, so the
 * form edits the review that exists rather than silently
 * colliding with the one-per-product constraint.
 */
export async function fetchOwnReview(
  productId: string,
  userId: string
): Promise<ProductReview | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toReview(data as unknown as ReviewRow) : null;
}

/*
 * Write the shopper's review. One review per product per
 * person, so this upserts on that constraint: writing again
 * edits what is already there instead of failing.
 */
export async function saveReview(
  productId: string,
  userId: string,
  draft: ReviewDraft
): Promise<ProductReview> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("reviews")
    .upsert(
      {
        product_id: productId,
        user_id: userId,
        rating: draft.rating,
        title: optionalText(draft.title),
        body: optionalText(draft.body),
      },
      { onConflict: "product_id,user_id" }
    )
    .select(REVIEW_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return toReview(data as unknown as ReviewRow);
}

export async function deleteReview(reviewId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);

  if (error) {
    throw error;
  }
}

/* ---------------------------------------------------------
 * ADMIN
 * ---------------------------------------------------------
 *
 * These reach past the public read policy on the strength of
 * is_admin(); a shopper calling them gets their own rows back
 * and nothing else.
 */

export async function fetchAllReviews(): Promise<AdminReview[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("reviews")
    .select(`${REVIEW_COLUMNS}, products (name, slug)`)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const { products, ...review } = row as unknown as ReviewRow & {
      products: { name: string; slug: string } | null;
    };

    return { ...toReview(review), product: products };
  });
}

export async function setReviewStatus(reviewId: string, status: ReviewStatus): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("reviews").update({ status }).eq("id", reviewId);

  if (error) {
    throw error;
  }
}

/*
 * The store's public reply. Passing an empty string removes it;
 * admin_response_at follows the text in the database, so it is
 * deliberately not sent from here.
 */
export async function saveAdminResponse(reviewId: string, response: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("reviews")
    .update({ admin_response: optionalText(response) })
    .eq("id", reviewId);

  if (error) {
    throw error;
  }
}

/* ---------------------------------------------------------
 * PRESENTATION HELPERS
 * --------------------------------------------------------- */

/* "4.3" - one decimal, and no "0.0" before anyone has rated. */
export const formatAverageRating = (average: number): string =>
  average > 0 ? average.toFixed(1) : "—";

export const formatReviewCount = (count: number): string =>
  count === 1 ? "1 review" : `${count} reviews`;

/*
 * A byline for a reviewer with no name on their profile. The
 * column is NOT NULL with a '' default, so this is about empty
 * rather than missing.
 */
export const reviewerLabel = (review: ProductReview): string =>
  review.reviewer_name.trim() || "Verified shopper";

export const reviewerInitial = (review: ProductReview): string =>
  reviewerLabel(review).charAt(0).toUpperCase();

export const formatReviewDate = (timestamp: string | null): string => {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};
