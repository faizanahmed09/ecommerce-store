"use client";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/src/app/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/src/app/components/ui/sheet";
import { useAuth } from "@/src/app/context/auth-context";
import { countCategories } from "@/src/app/lib/categories";
import { cn } from "@/src/app/lib/utils";
import { LogOut, Menu, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdminProfile } from "./admin-provider";
import { AdminSidebar } from "./admin-sidebar";
import { titleCase } from "./admin-ui";

/*
 * The header title tracks the sidebar routes so both always
 * name the current section the same way.
 */
const PAGE_TITLES: { match: (pathname: string) => boolean; title: string }[] = [
  { match: (p) => p.startsWith("/admin/products"), title: "Products" },
  { match: (p) => p.startsWith("/admin/categories"), title: "Categories" },
  { match: (p) => p.startsWith("/admin/orders"), title: "Orders" },
  { match: (p) => p === "/admin", title: "Dashboard" },
];

export function AdminHeader() {
  const { signOut } = useAuth();
  const { profile } = useAdminProfile();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    /*
     * Health check only: an empty table is still a healthy
     * connection, so only a query error counts as offline.
     */
    async function checkConnection() {
      try {
        await countCategories();

        if (active) {
          setDbConnected(true);
        }
      } catch (error) {
        console.warn("Database connection check failed:", error);

        if (active) {
          setDbConnected(false);
        }
      }
    }

    void checkConnection();

    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");

      toast({
        title: "Logged Out",
        description: "You have been logged out of the admin panel.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const pageTitle = PAGE_TITLES.find((entry) => entry.match(pathname))?.title ?? "Admin Portal";

  const displayName =
    profile?.full_name?.trim() || profile?.email?.split("@")[0] || "Administrator";

  /* Role comes from users.user_type, not from the email string. */
  const roleLabel = profile?.user_type ? titleCase(profile.user_type) : "Administrator";

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-neutral-200 bg-white px-4 shadow-sm md:px-6">
      {/* Mobile Menu & Title */}
      <div className="flex items-center gap-4">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-neutral-600 md:hidden">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="w-[280px] border-none bg-neutral-900 p-0 text-white">
            <SheetHeader className="sr-only">
              <SheetTitle>Admin Navigation</SheetTitle>
            </SheetHeader>

            <AdminSidebar onClose={() => setIsMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <h2 className="text-lg font-semibold text-neutral-800 md:text-xl">{pageTitle}</h2>
      </div>

      {/* Right Side: Status, Profile details, Logout */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* DB Connection Badge */}
        <div
          className={cn(
            "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:flex",
            dbConnected === true && "border-green-200 bg-green-50 text-green-700",
            dbConnected === false && "border-amber-200 bg-amber-50 text-amber-700",
            dbConnected === null && "border-neutral-200 bg-neutral-50 text-neutral-500"
          )}
        ></div>

        {/* Admin Profile */}
        <div className="flex items-center gap-2 border-l border-neutral-200 pl-3 md:pl-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand-strong">
            <User className="h-5 w-5" />
          </div>

          <div className="hidden flex-col text-left lg:flex">
            <span className="text-sm font-semibold leading-none text-neutral-800">
              {displayName}
            </span>

            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          title="Sign Out"
        >
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
