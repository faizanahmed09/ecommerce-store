"use client";

import { cn } from "@/src/app/lib/utils";
import {
  ArrowLeft,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Star,
  TicketPercent,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export function AdminSidebar({ className, onClose }: SidebarProps) {
  const pathname = usePathname();

  const routes = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/admin",
      active: pathname === "/admin",
    },
    {
      label: "Products",
      icon: Package,
      href: "/admin/products",
      active: pathname.startsWith("/admin/products"),
    },
    {
      label: "Categories",
      icon: FolderTree,
      href: "/admin/categories",
      active: pathname.startsWith("/admin/categories"),
    },
    {
      label: "Discounts",
      icon: TicketPercent,
      href: "/admin/coupons",
      active: pathname.startsWith("/admin/coupons"),
    },
    {
      label: "Orders",
      icon: ClipboardList,
      href: "/admin/orders",
      active: pathname.startsWith("/admin/orders"),
    },
    {
      label: "Couriers",
      icon: Truck,
      href: "/admin/couriers",
      active: pathname.startsWith("/admin/couriers"),
    },
    {
      label: "Reviews",
      icon: Star,
      href: "/admin/reviews",
      active: pathname.startsWith("/admin/reviews"),
    },
  ];

  return (
    <div className={cn("flex h-full flex-col bg-neutral-900 text-white", className)}>
      {/* Sidebar Brand */}
      <div className="flex h-16 items-center border-b border-neutral-800 px-6">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-lg font-bold tracking-wider text-white"
          onClick={onClose}
        >
          <ShieldCheck className="h-6 w-6 text-brand" />
          <span>
            HAANI THREADS{" "}
            <span className="rounded bg-neutral-800 px-1 py-0.5 text-xs font-semibold text-brand">
              ADMIN
            </span>
          </span>
        </Link>
      </div>

      {/* Sidebar Links */}
      <div className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
        {routes.map((route) => {
          const Icon = route.icon;
          return (
            <Link
              key={route.href}
              href={route.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                route.active
                  ? "bg-brand text-brand-foreground shadow-lg shadow-brand/20"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              )}
            >
              <Icon className={cn("h-5 w-5", route.active ? "text-white" : "text-neutral-400")} />
              {route.label}
            </Link>
          );
        })}
      </div>

      {/* Sidebar Footer */}
      <div className="space-y-2 border-t border-neutral-800 p-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-400 transition-all duration-200 hover:bg-neutral-800 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Storefront
        </Link>
      </div>
    </div>
  );
}
