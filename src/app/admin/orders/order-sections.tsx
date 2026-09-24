"use client";

/*
 * ---------------------------------------------------------
 * ORDER DRAWER SECTIONS
 * ---------------------------------------------------------
 *
 * Read-only blocks of the order drawer: who bought it, what
 * they bought, and anything they wrote down. All presentation,
 * no state.
 */

import { FileText, MapPin, User } from "lucide-react";
import { formatCurrency } from "../components/admin-ui";
import type { Order, OrderItem } from "./types";

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon?: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-neutral-400">
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </h3>
  );
}

export function CustomerSection({ order }: { order: Order }) {
  return (
    <div className="space-y-3">
      <SectionHeading>Customer Details</SectionHeading>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-xs sm:grid-cols-2">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-neutral-600">
            <User className="h-4 w-4 shrink-0 text-neutral-400" />
            <span className="font-semibold text-neutral-800">{order.customer_name}</span>
          </p>

          <p className="pl-6 leading-none text-neutral-500">
            {order.customer_email ?? "No email on file"}
          </p>

          <p className="pl-6 leading-none text-neutral-500">Phone: {order.customer_phone ?? "—"}</p>
        </div>

        <div className="space-y-1.5 border-t border-neutral-100 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <p className="flex items-start gap-2 text-neutral-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
            <span className="font-semibold text-neutral-800">Shipping Address</span>
          </p>

          <p className="whitespace-pre-line pl-6 leading-relaxed text-neutral-500">
            {order.shipping_address || "—"}
          </p>

          {order.billing_address && (
            <>
              <p className="pl-6 pt-2 font-semibold text-neutral-800">Billing Address</p>

              <p className="whitespace-pre-line pl-6 leading-relaxed text-neutral-500">
                {order.billing_address}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface OrderItemsSectionProps {
  items: OrderItem[];
  loading: boolean;
  /* orders.total_amount, not a sum of the lines. */
  totalAmount: number;
}

export function OrderItemsSection({ items, loading, totalAmount }: OrderItemsSectionProps) {
  return (
    <div className="space-y-3">
      <SectionHeading>Order Items</SectionHeading>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {loading ? (
          <div className="space-y-2 p-4">
            <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
          </div>
        ) : items.length === 0 ? (
          <p className="p-4 text-xs italic text-neutral-400">
            No products registered in this order.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 text-xs">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 hover:bg-neutral-50/50"
              >
                <div>
                  <p className="font-bold text-neutral-800">{item.product_name}</p>

                  {item.variant_label && (
                    <p className="mt-0.5 text-[10px] font-semibold text-neutral-500">
                      {item.variant_label}
                    </p>
                  )}

                  <p className="mt-0.5 text-[10px] text-neutral-400">
                    Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>

                <span className="font-bold text-neutral-800">
                  {formatCurrency(item.total_price)}
                </span>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/70 p-3 text-sm font-bold">
              <span className="text-neutral-600">Total Purchase Amount</span>

              <span className="text-brand-strong">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotesSection({ notes }: { notes: string }) {
  return (
    <div className="space-y-1.5">
      <SectionHeading icon={FileText}>Customer Notes</SectionHeading>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs font-medium leading-relaxed text-neutral-600">
        {notes}
      </div>
    </div>
  );
}
