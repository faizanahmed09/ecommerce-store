"use client";

import { useCallback } from "react";
import { AlertCircle, Package } from "lucide-react";
import { Button } from "@/src/app/components/ui/button";
import { Badge } from "@/src/app/components/ui/badge";
import { EmptyState } from "@/src/app/components/ui/empty-state";
import { createClient } from "@/src/app/lib/supabase/client";
import { useAuth } from "@/src/app/context/auth-context";
import { formatCurrency } from "@/src/app/lib/utils";
import { useAsyncData } from "@/src/app/lib/use-async-data";
import Link from "next/link";

/**
 * The subset of the `orders` row this list renders. The nullable columns match
 * the generated database types so a Supabase result assigns without a cast.
 */
interface Order {
  id: string;
  created_at: string | null;
  status: string;
  payment_status: string | null;
  total_amount: number;
  tracking_number: string | null;
}

const ORDER_SELECT =
  "id, created_at, status, payment_status, total_amount, tracking_number";

const NO_ORDERS: Order[] = [];

export function AccountOrders() {
  const { user } = useAuth();

  const fetchOrders = useCallback(async (): Promise<Order[]> => {
    if (!user) {
      return NO_ORDERS;
    }

    const { data, error } = await createClient()
      .from("orders")
      .select(ORDER_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []) as Order[];
  }, [user]);

  const onError = useCallback((error: unknown) => {
    console.error("Error fetching orders:", error);
  }, []);

  const {
    data: orders,
    loading,
    error,
    reload,
  } = useAsyncData(fetchOrders, {
    fallback: NO_ORDERS,
    enabled: Boolean(user),
    onError,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {Array(3)
          .fill(null)
          .map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border bg-card p-6"
            >
              <div className="mb-4 h-6 w-1/4 rounded bg-muted"></div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-muted"></div>
                <div className="h-4 w-3/4 rounded bg-muted"></div>
              </div>
            </div>
          ))}
      </div>
    );
  }

  /* A failed load is not an empty account, and must not read like one. */
  if (error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn't load your orders"
        description="Something went wrong reaching the store. Your orders are safe — try again in a moment."
        action={
          <Button variant="outline" onClick={reload}>
            Try again
          </Button>
        }
      />
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No orders yet"
        description="When you place an order it will appear here, with its status and tracking number."
        action={
          <Button asChild>
            <Link href="/products">Start shopping</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {orders.map((order) => (
        <div key={order.id} className="rounded-lg border bg-card">
          <div className="flex flex-col justify-between border-b p-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium">
                Order #{order.id.substring(0, 8).toUpperCase()}
              </p>
              <p className="text-sm text-muted-foreground">
                Placed on{" "}
                {order.created_at
                  ? new Date(order.created_at).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div className="mt-2 flex items-center sm:mt-0">
              <Badge
                variant={
                  order.status === "delivered"
                    ? "success"
                    : order.status === "processing"
                    ? "default"
                    : order.status === "cancelled"
                    ? "destructive"
                    : "outline"
                }
              >
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
            </div>
          </div>
          <div className="p-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="font-medium">
                {formatCurrency(order.total_amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Status:</span>
              <span className="font-medium">
                {order.payment_status ?? "pending"}
              </span>
            </div>
            {order.tracking_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tracking Number:</span>
                <span className="font-medium">{order.tracking_number}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
