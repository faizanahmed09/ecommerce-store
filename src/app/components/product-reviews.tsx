"use client";

import { AlertCircle, BadgeCheck, EyeOff, MessageSquare, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/app/components/ui/select";
import { StarRating, StarRatingInput } from "@/src/app/components/ui/star-rating";
import { Textarea } from "@/src/app/components/ui/textarea";
import { useAuth } from "@/src/app/context/auth-context";
import {
  deleteReview,
  fetchOwnReview,
  fetchProductReviews,
  formatAverageRating,
  formatReviewCount,
  formatReviewDate,
  REVIEW_SORTS,
  reviewerInitial,
  reviewerLabel,
  saveReview,
  STAR_VALUES,
  type ProductReview,
  type ReviewDraft,
  type ReviewSort,
  type ReviewStats,
} from "@/src/app/lib/reviews";
import { useQuery } from "@tanstack/react-query";

/* One shared empty result, so the fallback is stable. */
const EMPTY_REVIEWS: {
  reviews: ProductReview[];
  ownReview: ProductReview | null;
} = { reviews: [], ownReview: null };

interface ProductReviewsProps {
  productId: string;
  productName: string;
  stats: ReviewStats;
  /* Asks the product page to re-read the average and histogram. */
  onReviewsChanged: () => void;
}

const EMPTY_DRAFT: ReviewDraft = { rating: 0, title: "", body: "" };

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Please try again.";

export function ProductReviews({
  productId,
  productName,
  stats,
  onReviewsChanged,
}: ProductReviewsProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [sort, setSort] = useState<ReviewSort>("recent");

  const [isWriting, setIsWriting] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  /*
   * Through the query cache rather than into state from an
   * effect. Keyed on the shopper too: their own review is
   * fetched alongside the list rather than picked out of it,
   * because staff can hide a review and its author still has to
   * be able to edit it.
   */
  const userId = user?.id ?? null;

  const {
    data = EMPTY_REVIEWS,
    isPending: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["product-reviews", productId, sort, userId],
    queryFn: async () => {
      const [list, own] = await Promise.all([
        fetchProductReviews(productId, sort),
        userId ? fetchOwnReview(productId, userId) : Promise.resolve(null),
      ]);

      return { reviews: list, ownReview: own };
    },
  });

  const { reviews, ownReview } = data;

  const failed = Boolean(error);

  const load = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const openForm = () => {
    setDraft(
      ownReview
        ? {
            rating: ownReview.rating,
            title: ownReview.title ?? "",
            body: ownReview.body ?? "",
          }
        : EMPTY_DRAFT
    );
    setIsWriting(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (draft.rating < 1) {
      toast({
        title: "Choose a rating",
        description: "Pick between one and five stars before posting.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      await saveReview(productId, user.id, draft);

      toast({
        title: ownReview ? "Review updated" : "Thanks for your review",
        description: `Your rating of ${productName} is now live.`,
      });

      setIsWriting(false);
      await load();
      onReviewsChanged();
    } catch (error: unknown) {
      console.error("Could not save review:", error);

      toast({
        title: "Couldn't post your review",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!ownReview) {
      return;
    }

    setRemoving(true);

    try {
      await deleteReview(ownReview.id);

      toast({
        title: "Review removed",
        description: `Your review of ${productName} has been deleted.`,
      });

      setIsWriting(false);
      await load();
      onReviewsChanged();
    } catch (error: unknown) {
      console.error("Could not delete review:", error);

      toast({
        title: "Couldn't remove your review",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  const setField = (field: keyof ReviewDraft, value: string | number) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  return (
    <section className="mt-5" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="sr-only">
        Reviews of {productName}
      </h2>

      {/* Summary: the average, then how the ratings are spread */}
      <div className="grid gap-6 rounded-2xl border bg-muted/20 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
        <div className="flex flex-col items-center justify-center gap-1.5 sm:min-w-32">
          <span className="text-4xl font-bold tracking-tight">
            {formatAverageRating(stats.averageRating)}
          </span>

          <StarRating value={stats.averageRating} size="md" />

          <span className="text-xs text-muted-foreground">
            {formatReviewCount(stats.reviewCount)}
          </span>
        </div>

        <div className="space-y-1.5">
          {STAR_VALUES.map((star) => {
            const count = stats.distribution[star];

            /* Guard the divide so an unrated product renders flat bars. */
            const percent = stats.reviewCount > 0 ? (count / stats.reviewCount) * 100 : 0;

            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="flex w-10 shrink-0 items-center gap-1 text-muted-foreground">
                  {star}
                  <Star className="h-3 w-3 fill-current" />
                </span>

                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-[#FFB33E]"
                    style={{ width: `${percent}%` }}
                  />
                </span>

                <span className="w-6 shrink-0 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Write / edit */}
      <div className="mt-5">
        {!user ? (
          <p className="text-sm text-muted-foreground">
            <Link
              href="/login?redirect=/products"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>{" "}
            to review this product.
          </p>
        ) : isWriting ? (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-background p-5">
            <div className="space-y-2">
              <Label>Your rating</Label>
              <StarRatingInput
                value={draft.rating}
                onChange={(rating) => setField("rating", rating)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-title">Headline (optional)</Label>
              <Input
                id="review-title"
                maxLength={150}
                placeholder="Sums up what you thought"
                value={draft.title}
                onChange={(event) => setField("title", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-body">Your review (optional)</Label>
              <Textarea
                id="review-body"
                rows={5}
                placeholder="How is the fit, the fabric, the colour?"
                value={draft.body}
                onChange={(event) => setField("body", event.target.value)}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {ownReview && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={removing || saving}
                  onClick={handleDelete}
                  className="mr-auto text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {removing ? "Removing…" : "Delete review"}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setIsWriting(false)}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? "Posting…" : ownReview ? "Save changes" : "Post review"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={openForm}>
              {ownReview ? "Edit your review" : "Write a review"}
            </Button>

            {ownReview?.status === "hidden" && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5" />
                Your review is hidden from other shoppers.
              </span>
            )}
          </div>
        )}
      </div>

      {/* The reviews themselves */}
      <div className="mt-8">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="animate-pulse space-y-2 rounded-2xl border p-5">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : failed ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-12 text-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Couldn&apos;t load reviews</p>
              <p className="text-xs text-muted-foreground">
                Nothing has been lost — try again in a moment.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-12 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No reviews yet</p>
              <p className="text-xs text-muted-foreground">
                Be the first to tell other shoppers what you think.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{formatReviewCount(reviews.length)}</p>

              <Select value={sort} onValueChange={(value) => setSort(value as ReviewSort)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REVIEW_SORTS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ul className="space-y-4">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-2xl border p-5">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold"
                    >
                      {reviewerInitial(review)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold">{reviewerLabel(review)}</span>

                        {review.is_verified_purchase && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <BadgeCheck className="h-3 w-3" />
                            Verified purchase
                          </span>
                        )}

                        {/* Only ever their own, per the read policy. */}
                        {review.status === "hidden" && (
                          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            <EyeOff className="h-3 w-3" />
                            Hidden
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StarRating value={review.rating} size="sm" />
                        <span className="text-xs text-muted-foreground">
                          {formatReviewDate(review.created_at)}
                        </span>
                      </div>

                      {review.title && (
                        <h3 className="mt-3 text-sm font-semibold">{review.title}</h3>
                      )}

                      {review.body && (
                        <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                          {review.body}
                        </p>
                      )}

                      {review.admin_response && (
                        <div className="mt-4 rounded-xl border-l-2 border-brand bg-muted/40 p-3">
                          <p className="text-xs font-semibold">
                            Response from Lamees
                            {review.admin_response_at && (
                              <span className="ml-2 font-normal text-muted-foreground">
                                {formatReviewDate(review.admin_response_at)}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                            {review.admin_response}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
