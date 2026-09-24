"use client";

import { Button } from "@/src/app/components/ui/button";
import { cn } from "@/src/app/lib/utils";
import {
  AlertCircle,
  ClipboardList,
  DollarSign,
  FolderOpen,
  Plus,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { AnalyticsChart } from "./components/analytics-chart";
import {
  EmptyState,
  formatCurrency,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  RefreshButton,
} from "./components/admin-ui";
import {
  DashboardSkeletonChart,
  QuickLinks,
  RecentOrdersPanel,
  StatCards,
  type QuickLink,
  type StatItem,
} from "./dashboard-sections";
import { useDashboard } from "./lib/use-dashboard";

const QUICK_LINKS: QuickLink[] = [
  {
    href: "/admin/products",
    icon: ShoppingBag,
    title: "Inventory Catalog",
    description: "View and update stock quantities",
  },
  {
    href: "/admin/orders",
    icon: ClipboardList,
    title: "Order Processing",
    description: "Manage orders and delivery statuses",
  },
  {
    href: "/admin/categories",
    icon: FolderOpen,
    title: "Taxonomy Tree",
    description: "Reorganize store departments",
  },
];

export default function AdminDashboard() {
  const { data, loading, error, reload } = useDashboard();

  const stats: StatItem[] = [
    {
      title: "Total Revenue",
      value: formatCurrency(data.totalRevenue),
      description: "Settled payments across all orders",
      icon: DollarSign,
      trend: data.revenueTrend,
    },
    {
      title: "Total Orders",
      value: data.totalOrders,
      description: "Orders placed all time",
      icon: ClipboardList,
      trend: data.orderTrend,
    },
    {
      title: "Active Products",
      value: data.productCount,
      description: "Live store listings",
      icon: ShoppingBag,
    },
    {
      title: "Categories",
      value: data.categoryCount,
      description: "Product taxonomies",
      icon: FolderOpen,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome to Lamees back office. Here is an overview of your store."
      >
        <RefreshButton onClick={reload} loading={loading} />

        <Link href="/admin/products">
          <Button className={cn("flex items-center gap-2", PRIMARY_BUTTON_CLASS)}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </PageHeader>

      {/*
        A failed load used to render four zeros, which reads as
        "no sales" when it actually means "could not ask". The
        figures are withheld until they are real.
      */}
      {error ? (
        <EmptyState
          bordered
          icon={AlertCircle}
          title="Couldn't load your store figures."
          description="The dashboard could not reach the database. Nothing is wrong with your data."
          action={
            <Button type="button" onClick={reload} className={PRIMARY_BUTTON_CLASS}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <StatCards stats={stats} loading={loading} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {loading ? <DashboardSkeletonChart /> : <AnalyticsChart data={data.chart} />}
            </div>

            <QuickLinks links={QUICK_LINKS} />
          </div>

          <RecentOrdersPanel orders={data.recentOrders} loading={loading} />
        </>
      )}
    </div>
  );
}
