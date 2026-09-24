"use client";

/*
 * ---------------------------------------------------------
 * ADMIN / REVIEWS
 * ---------------------------------------------------------
 *
 * The moderation queue. Staff cannot edit what a shopper
 * wrote - only hide it, reply to it publicly, or delete it -
 * so a review on screen is always the shopper's own words.
 *
 * Everything here goes through the reviews_admin_manage
 * policy; the layout has already checked users.user_type, and
 * the database checks it again on every write.
 */

import {
  BadgeCheck,
  Eye,
  EyeOff,
  MessageSquare,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/app/components/ui/sheet";
import { StarRating } from "@/src/app/components/ui/star-rating";
import { Textarea } from "@/src/app/components/ui/textarea";
import {
  deleteReview,
  fetchAllReviews,
  formatReviewDate,
  reviewerLabel,
  saveAdminResponse,
  setReviewStatus,
  type AdminReview,
} from "@/src/app/lib/reviews";
import { useQuery } from "@tanstack/react-query";

/* One shared empty list, so the fallback is referentially stable. */
const NO_REVIEWS: AdminReview[] = [];

type StatusFilter = "all" | "published" | "hidden";

const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
];

const PANEL_CLASS = "rounded-xl border border-neutral-200 bg-white shadow-sm";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Please try again.";

export default function AdminReviewsPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<AdminReview | null>(null);
  const [replyText, setReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  /*
   * Fetched through the query cache rather than into state from
   * an effect: the effect version set state on mount, which
   * cost a render before the first request had even been sent,
   * and left `load` to be threaded through every mutation by
   * hand.
   */
  const {
    data: reviews = NO_REVIEWS,
    isPending: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: fetchAllReviews,
  });

  const failed = Boolean(error);

  const load = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return reviews.filter((review) => {
      if (statusFilter !== "all" && review.status !== statusFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [review.product?.name, review.reviewer_name, review.title, review.body]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });
  }, [reviews, search, statusFilter]);

  /* Counts come off the full list, so they do not move as you filter. */
  const hiddenCount = reviews.filter((review) => review.status === "hidden").length;

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
      : 0;

  const handleToggleStatus = async (review: AdminReview) => {
    const next = review.status === "hidden" ? "published" : "hidden";

    setBusyId(review.id);

    try {
      await setReviewStatus(review.id, next);

      toast({
        title: next === "hidden" ? "Review hidden" : "Review published",
        description:
          next === "hidden"
            ? "Shoppers no longer see it, and it no longer counts towards the average."
            : "It is back on the product page.",
      });

      await load();
    } catch (error: unknown) {
      console.error("Could not change review status:", error);

      toast({
        title: "Couldn't update that review",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (review: AdminReview) => {
    setBusyId(review.id);

    try {
      await deleteReview(review.id);

      toast({
        title: "Review deleted",
        description: `${reviewerLabel(review)}'s review has been removed.`,
      });

      await load();
    } catch (error: unknown) {
      console.error("Could not delete review:", error);

      toast({
        title: "Couldn't delete that review",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const openReply = (review: AdminReview) => {
    setReplyingTo(review);
    setReplyText(review.admin_response ?? "");
  };

  const handleSaveReply = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!replyingTo) {
      return;
    }

    setSavingReply(true);

    try {
      await saveAdminResponse(replyingTo.id, replyText);

      toast({
        title: replyText.trim() ? "Reply posted" : "Reply removed",
        description: replyText.trim()
          ? "It appears under the review on the product page."
          : "The review no longer carries a response.",
      });

      setReplyingTo(null);
      await load();
    } catch (error: unknown) {
      console.error("Could not save the reply:", error);

      toast({
        title: "Couldn't save your reply",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSavingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Reviews</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Hide reviews that break the rules and reply to the ones that need an answer.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={load}
          disabled={loading}
          className="border-neutral-300 text-neutral-600 hover:bg-neutral-50"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`${PANEL_CLASS} p-5`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Total reviews
          </p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{reviews.length}</p>
        </div>

        <div className={`${PANEL_CLASS} p-5`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Average rating
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-bold text-neutral-900">
              {averageRating > 0 ? averageRating.toFixed(1) : "—"}
            </p>
            <StarRating value={averageRating} size="sm" />
          </div>
        </div>

        <div className={`${PANEL_CLASS} p-5`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Hidden</p>
          <p className="mt-2 text-2xl font-bold text-neutral-900">{hiddenCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product, reviewer or wording..."
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={
                statusFilter === option.value
                  ? "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground"
                  : "rounded-md px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-50"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* The queue */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className={`${PANEL_CLASS} h-28 animate-pulse bg-neutral-100`} />
          ))}
        </div>
      ) : failed ? (
        <div className={`${PANEL_CLASS} flex flex-col items-center gap-3 py-16`}>
          <MessageSquare className="h-7 w-7 text-neutral-300" />
          <p className="text-sm font-medium text-neutral-900">Couldn&apos;t load reviews</p>
          <Button
            variant="outline"
            onClick={load}
            className="border-neutral-300 text-neutral-600 hover:bg-neutral-50"
          >
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${PANEL_CLASS} flex flex-col items-center gap-2 py-16`}>
          <Star className="h-7 w-7 text-neutral-300" />
          <p className="text-sm font-medium text-neutral-900">
            {reviews.length === 0 ? "No reviews yet." : "No reviews match your filters."}
          </p>
          <p className="text-sm text-neutral-500">
            {reviews.length === 0
              ? "Reviews written on product pages appear here automatically."
              : "Try a different status or clear your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => (
            <article key={review.id} className={`${PANEL_CLASS} p-5`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {review.product ? (
                      <Link
                        href={`/products/${review.product.slug}`}
                        className="text-sm font-semibold text-neutral-900 hover:text-brand-strong"
                      >
                        {review.product.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-neutral-400">
                        Deleted product
                      </span>
                    )}

                    <span
                      className={
                        review.status === "hidden"
                          ? "rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600"
                          : "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
                      }
                    >
                      {review.status}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StarRating value={review.rating} size="sm" />

                    <span className="text-xs font-medium text-neutral-700">
                      {reviewerLabel(review)}
                    </span>

                    {review.is_verified_purchase && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                        <BadgeCheck className="h-3 w-3" />
                        Verified purchase
                      </span>
                    )}

                    <span className="text-xs text-neutral-400">
                      {formatReviewDate(review.created_at)}
                    </span>
                  </div>

                  {review.title && (
                    <h2 className="mt-3 text-sm font-semibold text-neutral-900">{review.title}</h2>
                  )}

                  {review.body && (
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-neutral-600">
                      {review.body}
                    </p>
                  )}

                  {review.admin_response && (
                    <div className="mt-3 rounded-lg border-l-2 border-brand bg-neutral-50 p-3">
                      <p className="text-xs font-semibold text-neutral-900">
                        Your reply
                        {review.admin_response_at && (
                          <span className="ml-2 font-normal text-neutral-400">
                            {formatReviewDate(review.admin_response_at)}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-neutral-600">
                        {review.admin_response}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReply(review)}
                    className="border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {review.admin_response ? "Edit reply" : "Reply"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === review.id}
                    onClick={() => handleToggleStatus(review)}
                    className="border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  >
                    {review.status === "hidden" ? (
                      <>
                        <Eye className="h-4 w-4" />
                        Publish
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Hide
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === review.id}
                    onClick={() => handleDelete(review)}
                    className="border-neutral-300 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Reply drawer */}
      <Sheet open={Boolean(replyingTo)} onOpenChange={(open) => !open && setReplyingTo(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Reply to this review</SheetTitle>
            <SheetDescription>
              Your answer is published under the review, signed as the store. Clear the box to take
              it down again.
            </SheetDescription>
          </SheetHeader>

          {replyingTo && (
            <form onSubmit={handleSaveReply} className="mt-6 space-y-4">
              <div className="rounded-lg bg-neutral-50 p-3">
                <div className="flex items-center gap-2">
                  <StarRating value={replyingTo.rating} size="sm" />
                  <span className="text-xs font-medium text-neutral-700">
                    {reviewerLabel(replyingTo)}
                  </span>
                </div>

                {replyingTo.title && (
                  <p className="mt-2 text-sm font-semibold text-neutral-900">{replyingTo.title}</p>
                )}

                {replyingTo.body && (
                  <p className="mt-1 whitespace-pre-line text-sm text-neutral-600">
                    {replyingTo.body}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-reply">Your reply</Label>
                <Textarea
                  id="admin-reply"
                  rows={6}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Thanks for letting us know…"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReplyingTo(null)}
                  className="border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingReply}
                  className="bg-brand text-brand-foreground hover:bg-brand-strong"
                >
                  {savingReply ? "Saving…" : "Save reply"}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
