"use client";

/*
 * ---------------------------------------------------------
 * DASHBOARD STATE
 * ---------------------------------------------------------
 */

import { useToast } from "@/hooks/use-toast";
import { useAsyncData } from "@/src/app/lib/use-async-data";
import { useCallback } from "react";
import { getErrorMessage } from "../components/admin-ui";
import { fetchDashboard, type DashboardData } from "./dashboard";

/*
 * Held while loading and after a failure. The screen tells the
 * difference by checking `error` - a dashboard that renders
 * these zeros as if they were figures would be reporting no
 * sales when it actually means it could not ask.
 */
const NO_DATA: DashboardData = {
  totalRevenue: 0,
  totalOrders: 0,
  productCount: 0,
  categoryCount: 0,
  revenueTrend: null,
  orderTrend: null,
  chart: [],
  recentOrders: [],
};

export function useDashboard() {
  const { toast } = useToast();

  const onError = useCallback(
    (error: unknown) => {
      console.error("Failed to load dashboard data:", error);

      toast({
        title: "Failed to load dashboard",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
    [toast],
  );

  const { data, loading, error, reload } = useAsyncData(fetchDashboard, {
    fallback: NO_DATA,
    onError,
  });

  return { data, loading, error, reload };
}
