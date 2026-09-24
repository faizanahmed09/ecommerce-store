"use client";

/*
 * ---------------------------------------------------------
 * ORDERS TABLE ROW
 * ---------------------------------------------------------
 */

import { cn } from "@/src/app/lib/utils";
import { Eye } from "lucide-react";
import {
  formatCurrency,
  formatDateTime,
  formatOrderId,
  PaymentBadge,
  StatusBadge,
  TD_CLASS,
} from "../components/admin-ui";
import type { Order } from "./types";

interface OrderRowProps {
  order: Order;
  onManage: (order: Order) => void;
}

export function OrderRow({ order, onManage }: OrderRowProps) {
  return (
    <tr className="transition-colors hover:bg-neutral-50/50">
      <td className={cn(TD_CLASS, "font-mono font-bold text-neutral-800")}>
        {formatOrderId(order.id)}
      </td>

      <td className={cn(TD_CLASS, "text-neutral-500")}>{formatDateTime(order.created_at)}</td>

      <td className={TD_CLASS}>
        <div className="flex flex-col">
          <span className="font-semibold text-neutral-700">{order.customer_name}</span>

          <span className="mt-0.5 text-[10px] text-neutral-400">
            {order.customer_email ?? "No email on file"}
          </span>
        </div>
      </td>

      <td className={TD_CLASS}>
        <StatusBadge status={order.status} />
      </td>

      <td className={TD_CLASS}>
        <PaymentBadge status={order.payment_status} />
      </td>

      <td className={cn(TD_CLASS, "font-bold text-neutral-800")}>
        {formatCurrency(order.total_amount)}
      </td>

      <td className={cn(TD_CLASS, "text-right")}>
        <button
          type="button"
          onClick={() => onManage(order)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-brand-strong transition-colors hover:bg-neutral-50 hover:text-brand-strong"
        >
          <Eye className="h-4 w-4" />
          Manage
        </button>
      </td>
    </tr>
  );
}
