"use client";

/*
 * ---------------------------------------------------------
 * useWishlist
 * ---------------------------------------------------------
 *
 * One shared answer to "is this saved?", and one way to change
 * it.
 *
 * The heart on the product page read the wishlist itself while
 * the heart on every card was local state that wrote nothing -
 * so a grid of twenty products showed twenty decorative
 * hearts, none of which knew what was actually saved.
 *
 * Both now read through here. The saved product ids are one
 * query keyed on the shopper, so a grid of twenty cards costs
 * one request rather than twenty, and toggling anywhere
 * updates every heart on the page at once.
 */

import { useAuth } from "@/src/app/context/auth-context";
import { addToWishlist, fetchWishlistProductIds, removeFromWishlist } from "@/src/app/lib/wishlist";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export const WISHLIST_KEY = "wishlist";

const NO_IDS: ReadonlySet<string> = new Set<string>();

export function useWishlist() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userId = user?.id ?? null;
  const queryKey = [WISHLIST_KEY, userId];

  const { data: savedIds = NO_IDS } = useQuery({
    queryKey,
    queryFn: () => fetchWishlistProductIds(userId as string),
    /* Signed out there is no wishlist to read. */
    enabled: Boolean(userId),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: ({ productId, save }: { productId: string; save: boolean }) =>
      save
        ? addToWishlist(userId as string, productId)
        : removeFromWishlist(userId as string, productId),

    /*
     * Optimistic: the heart fills the instant it is clicked,
     * everywhere it appears, and the previous set is kept so a
     * failed write can put it back.
     */
    onMutate: async ({ productId, save }) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ReadonlySet<string>>(queryKey);

      queryClient.setQueryData<ReadonlySet<string>>(queryKey, (current) => {
        const next = new Set(current ?? []);

        if (save) {
          next.add(productId);
        } else {
          next.delete(productId);
        }

        return next;
      });

      return { previous };
    },

    onError: (error, _variables, context) => {
      console.error("Could not update wishlist:", error);

      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }

      toast({
        title: "Couldn't update your wishlist",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },

    onSuccess: (_data, { save }) => {
      toast({
        title: save ? "Saved to wishlist" : "Removed from wishlist",
        description: save
          ? "It is waiting for you in your account."
          : "It is no longer in your wishlist.",
      });
    },

    /*
     * The account tab reads full product rows under its own
     * key, so it has to be refetched too - otherwise a heart
     * emptied on a grid leaves the item sitting in the list.
     */
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: [WISHLIST_KEY, userId, "items"] });
    },
  });

  const isSaved = useCallback((productId: string) => savedIds.has(productId), [savedIds]);

  const toggle = useCallback(
    (productId: string) => {
      if (!userId) {
        toast({
          title: "Sign in to save items",
          description: "Your wishlist is kept with your account.",
        });
        return;
      }

      if (isPending) {
        return;
      }

      mutate({ productId, save: !savedIds.has(productId) });
    },
    [userId, isPending, mutate, savedIds, toast]
  );

  return { isSaved, toggle, saving: isPending, signedIn: Boolean(userId) };
}
