"use client";

import { Button } from "@/src/app/components/ui/button";
import { useAuth } from "@/src/app/context/auth-context";
import { ArrowRight, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { AdminHeader } from "./components/admin-header";
import { AdminProvider, useAdminProfile } from "./components/admin-provider";
import { AdminSidebar } from "./components/admin-sidebar";
import { PRIMARY_BUTTON_CLASS } from "./components/admin-ui";

/*
 * ---------------------------------------------------------
 * GATE SCREEN SHELL
 * ---------------------------------------------------------
 *
 * Loading, "sign in" and "not an admin" all render in the
 * same card so the pre-dashboard states line up.
 */

function GateCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand-strong">
          {icon}
        </div>

        <h1 className="mb-2 text-2xl font-bold text-neutral-900">{title}</h1>

        <p className="mb-6 text-sm text-neutral-500">{description}</p>

        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

function AdminShell({ children }: { readonly children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { loading, isAdmin, profile, error } = useAdminProfile();
  const router = useRouter();

  /*
   * 1. Resolving the session and the users.user_type role.
   */
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-brand-strong" />

          <p className="text-sm font-medium text-neutral-500">Checking credentials...</p>
        </div>
      </div>
    );
  }

  /*
   * 2. Not signed in.
   */
  if (!user) {
    return (
      <GateCard
        icon={<Lock className="h-6 w-6" />}
        title="Access Denied"
        description="This portal is restricted to authorized personnel. Please sign in with an administrator account to continue."
      >
        <Button
          onClick={() => router.push("/login?redirect=/admin")}
          className="flex w-full items-center justify-center gap-2 bg-neutral-900 text-white hover:bg-neutral-800"
        >
          Sign In to Account
          <ArrowRight className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          onClick={() => router.push("/")}
          className="w-full border-neutral-300 text-neutral-600 hover:bg-neutral-50"
        >
          Return to Storefront
        </Button>
      </GateCard>
    );
  }

  /*
   * 3. Signed in, but the users row is missing or its
   *    user_type is not 'admin'.
   */
  if (!isAdmin) {
    return (
      <GateCard
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Administrator Access Required"
        description={
          error
            ? `We could not verify your role: ${error}`
            : profile
              ? `You are signed in as ${profile.email}, but this account is registered as a "${profile.user_type}". Ask an administrator to set your user_type to "admin".`
              : `We could not find a profile for ${user.email} in the users table, so your role could not be confirmed.`
        }
      >
        <Button onClick={() => router.push("/")} className={`w-full ${PRIMARY_BUTTON_CLASS}`}>
          Return to Storefront
        </Button>

        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            router.push("/login");
          }}
          className="w-full border-neutral-300 text-neutral-600 hover:bg-neutral-50"
        >
          Sign in with another account
        </Button>
      </GateCard>
    );
  }

  /*
   * 4. Dashboard shell for verified admins.
   */
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50/50">
      {/* Desktop Sidebar (Fixed Left) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-neutral-800 bg-neutral-900 md:flex md:flex-col">
        <AdminSidebar />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:pl-64">
        <AdminHeader />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
