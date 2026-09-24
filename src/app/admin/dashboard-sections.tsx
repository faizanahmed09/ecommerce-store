"use client";

/*
 * ---------------------------------------------------------
 * DASHBOARD SECTIONS
 * ---------------------------------------------------------
 *
 * Presentation only. Every figure arrives finished from
 * lib/dashboard, the same way the Orders screen's drawer takes
 * rows from its queries module.
 */

import { Button } from "@/src/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/app/components/ui/card";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { cn } from "@/src/app/lib/utils";
import { ArrowRight, ClipboardList } from "lucide-react";
import Link from "next/link";
import type React from "react";
import {
  AdminTable,
  EmptyState,
  formatCurrency,
  formatDate,
  formatOrderId,
  PANEL_CLASS,
  StatusBadge,
  TableSkeleton,
  TD_CLASS,
} from "./components/admin-ui";
import type { RecentOrder, Trend } from "./lib/dashboard";

export interface StatItem {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: Trend | null;
}

export function StatCards({ stats, loading }: { stats: StatItem[]; loading: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {loading
        ? Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border-neutral-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>

              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))
        : stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <Card
                key={stat.title}
                className="border-neutral-200 shadow-sm transition-all hover:shadow-md"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    {stat.title}
                  </CardTitle>

                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand-strong">
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="text-2xl font-black text-neutral-900">{stat.value}</div>

                  <p className="mt-1 text-[10px] font-semibold text-neutral-400">
                    {stat.trend ? (
                      <span
                        className={stat.trend.trendPositive ? "text-green-600" : "text-red-500"}
                      >
                        {stat.trend.trend}
                      </span>
                    ) : (
                      stat.description
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })}
    </div>
  );
}

export interface QuickLink {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

export function QuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-1">
      <div>
        <h3 className="mb-4 text-base font-bold text-neutral-800">Quick Management</h3>

        <div className="space-y-2.5">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-lg border border-neutral-100 p-3 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded bg-neutral-100 p-2 text-neutral-700">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="text-left">
                    <p className="text-xs font-bold text-neutral-800">{link.title}</p>

                    <p className="text-[10px] text-neutral-400">{link.description}</p>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-neutral-400" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-6 border-t border-neutral-100 pt-4 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
          Lamees Dashboard v1.0.0
        </span>
      </div>
    </div>
  );
}

export function RecentOrdersPanel({
  orders,
  loading,
}: {
  orders: RecentOrder[];
  loading: boolean;
}) {
  return (
    <div className={PANEL_CLASS}>
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
        <h3 className="text-base font-bold text-neutral-800">Recent Orders</h3>

        <Link href="/admin/orders">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs font-semibold text-brand-strong hover:bg-neutral-50 hover:text-brand-strong"
          >
            View All Orders
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <TableSkeleton rows={3} columns={6} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No orders yet."
            description="Orders placed in the storefront will appear here."
          />
        ) : (
          <AdminTable
            columns={[
              { key: "id", label: "Order ID" },
              { key: "date", label: "Date" },
              { key: "customer", label: "Customer" },
              { key: "status", label: "Status" },
              { key: "total", label: "Total" },
              { key: "actions", label: "Actions", align: "right" },
            ]}
          >
            {orders.map((order) => (
              <tr key={order.id} className="transition-colors hover:bg-neutral-50/50">
                <td className={cn(TD_CLASS, "font-mono font-bold text-neutral-800")}>
                  {formatOrderId(order.id)}
                </td>

                <td className={cn(TD_CLASS, "text-neutral-500")}>{formatDate(order.created_at)}</td>

                <td className={cn(TD_CLASS, "text-neutral-600")}>{order.customer_name}</td>

                <td className={TD_CLASS}>
                  <StatusBadge status={order.status} />
                </td>

                <td className={cn(TD_CLASS, "font-bold text-neutral-800")}>
                  {formatCurrency(order.total_amount)}
                </td>

                <td className={cn(TD_CLASS, "text-right")}>
                  <Link href={`/admin/orders?id=${order.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs font-medium text-neutral-500 hover:text-brand-strong"
                    >
                      Manage
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </div>
    </div>
  );
}

export function DashboardSkeletonChart() {
  return (
    <div className="h-[320px] rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}
