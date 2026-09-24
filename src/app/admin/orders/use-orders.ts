"use client";

/*
 * ---------------------------------------------------------
 * ORDERS LIST STATE
 * ---------------------------------------------------------
 */

import { useToast } from "@/hooks/use-toast";
import { useAsyncData } from "@/src/app/lib/use-async-data";
import { useCallback, useMemo, useState } from "react";
import { getErrorMessage } from "../components/admin-ui";
import { fetchOrderItems, fetchOrders } from "./queries";
import type { Order, OrderItem } from "./types";

const NO_ORDERS: Order[] = [];
const NO_ITEMS: OrderItem[] = [];

export function useOrders() {
  const { toast } = useToast();

  const onError = useCallback(
    (error: unknown) => {
      console.error("Failed to load orders:", error);

      toast({
        title: "Failed to load orders",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
    [toast],
  );

  const {
    data: orders,
    loading,
    reload: loadOrders,
  } = useAsyncData(fetchOrders, { fallback: NO_ORDERS, onError });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const filteredOrders = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return orders.filter(
      (order) =>
        (statusFilter === "all" || order.status === statusFilter) &&
        (paymentFilter === "all" ||
          (order.payment_status ?? "pending") === paymentFilter) &&
        (search === "" ||
          order.id.toLowerCase().includes(search) ||
          order.customer_name.toLowerCase().includes(search) ||
          (order.customer_email ?? "").toLowerCase().includes(search) ||
          (order.tracking_number ?? "").toLowerCase().includes(search)),
    );
  }, [orders, searchQuery, statusFilter, paymentFilter]);

  return {
    orders,
    filteredOrders,
    loading,
    loadOrders,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
  };
}

/*
 * ---------------------------------------------------------
 * ORDER ITEMS
 * ---------------------------------------------------------
 *
 * The drawer loads line items lazily, one order at a time.
 * useAsyncData's cancellation is what stops a fast
 * click-through landing the previous order's items.
 */

export function useOrderItems(orderId: string | null) {
  const { toast } = useToast();

  const onError = useCallback(
    (error: unknown) => {
      console.error("Error fetching order items:", error);

      toast({
        title: "Could not load order items",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
    [toast],
  );

  const fetcher = useCallback(
    () => fetchOrderItems(orderId as string),
    [orderId],
  );

  const { data: items, loading } = useAsyncData(fetcher, {
    fallback: NO_ITEMS,
    enabled: orderId !== null,
    onError,
  });

  return { items, loading };
}
