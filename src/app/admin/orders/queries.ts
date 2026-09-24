/*
 * ---------------------------------------------------------
 * ORDER DATA ACCESS
 * ---------------------------------------------------------
 *
 * Throws on failure, returns normalised rows. No React here.
 */

import { createClient } from "@/src/app/lib/supabase/client";
import { firstRelation } from "../components/admin-ui";
import {
  customerIdsOf,
  fetchCustomerProfiles,
  GUEST_CUSTOMER,
} from "../lib/customers";
import type { Order, OrderItem, OrderUpdate } from "./types";

const ORDER_SELECT = `
  id,
  user_id,
  status,
  total_amount,
  shipping_address,
  billing_address,
  payment_method,
  payment_status,
  tracking_number,
  notes,
  created_at
`;

const ORDER_ITEM_SELECT = `
  id,
  product_id,
  product_variant_id,
  quantity,
  unit_price,
  total_price,
  products:product_id (name, slug),
  product_variants:product_variant_id (name, value)
`;

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await createClient()
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  const profiles = await fetchCustomerProfiles(
    customerIdsOf(rows as { user_id: string | null }[]),
  );

  return rows.map((row) => {
    const profile = row.user_id
      ? profiles.get(row.user_id as string)
      : undefined;

    return {
      id: row.id as string,
      user_id: (row.user_id as string | null) ?? null,
      status: (row.status as string) ?? "pending",
      total_amount: Number(row.total_amount),
      shipping_address: (row.shipping_address as string) ?? "",
      billing_address: (row.billing_address as string | null) ?? null,
      payment_method: (row.payment_method as string | null) ?? null,
      payment_status: (row.payment_status as string | null) ?? "pending",
      tracking_number: (row.tracking_number as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      created_at: row.created_at as string,
      customer_name: profile?.name ?? GUEST_CUSTOMER,
      customer_email: profile?.email ?? null,
      customer_phone: profile?.phone ?? null,
    };
  });
}

export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await createClient()
    .from("order_items")
    .select(ORDER_ITEM_SELECT)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const product = firstRelation(
      row.products as { name?: string } | { name?: string }[] | null,
    );

    const variant = firstRelation(
      row.product_variants as
        | { name?: string; value?: string }
        | { name?: string; value?: string }[]
        | null,
    );

    return {
      id: row.id as string,
      product_id: (row.product_id as string | null) ?? null,
      product_variant_id: (row.product_variant_id as string | null) ?? null,
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      total_price: Number(row.total_price),
      product_name: product?.name ?? "Deleted Product",
      variant_label:
        variant?.name && variant?.value
          ? `${variant.name}: ${variant.value}`
          : null,
    };
  });
}

export async function updateOrder(
  orderId: string,
  update: OrderUpdate,
): Promise<void> {
  const { error } = await createClient()
    .from("orders")
    .update({
      status: update.status,
      payment_status: update.paymentStatus,
      payment_method: update.paymentMethod || null,
      tracking_number: update.trackingNumber.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    throw error;
  }
}
