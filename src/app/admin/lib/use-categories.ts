"use client";

/*
 * ---------------------------------------------------------
 * useCategories (admin)
 * ---------------------------------------------------------
 *
 * The categories list feeds the Categories screen, the product
 * form's picker and the bulk importer.
 *
 * It no longer runs a query of its own: all three read the same
 * store the storefront does, so opening the admin costs nothing
 * extra and a save here is seen by every open tab.
 */

import { useToast } from "@/hooks/use-toast";
import {
  invalidateCategories,
  useCategoryStore,
  type CategoryRecord,
} from "@/src/app/components/category-provider";
import { useEffect, useRef } from "react";
import { getErrorMessage } from "../components/admin-ui";

export function useCategories() {
  const { toast } = useToast();
  const { categories, loading, error, refresh } = useCategoryStore();

  /*
   * The store logs and swallows its own failures so the header
   * survives them. The admin, which cannot work without this
   * list, surfaces the same failure once per occurrence.
   */
  const reported = useRef<unknown>(null);

  useEffect(() => {
    if (!error || reported.current === error) {
      return;
    }

    reported.current = error;

    toast({
      title: "Failed to load categories",
      description: getErrorMessage(error),
      variant: "destructive",
    });
  }, [error, toast]);

  return { categories, loading, reload: refresh };
}

export { invalidateCategories };
export type { CategoryRecord };
