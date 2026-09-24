"use client";

import { Button } from "@/src/app/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { PRIMARY_BUTTON_CLASS } from "./components/admin-ui";

/*
 * The admin has its own boundary because the storefront's sits
 * outside the admin shell - a failure inside /admin should not
 * drop staff onto a customer-facing page.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand-strong">
        <AlertCircle className="h-6 w-6" />
      </div>

      <h1 className="mb-2 text-xl font-bold text-neutral-900">This screen failed to load</h1>

      <p className="mb-6 max-w-sm text-sm text-neutral-500">
        Nothing has been changed. Retry, and if it keeps happening check that the database is
        reachable.
      </p>

      <Button type="button" onClick={reset} className={PRIMARY_BUTTON_CLASS}>
        Try again
      </Button>

      {error.digest && (
        <p className="mt-8 font-mono text-[11px] text-neutral-400">Reference: {error.digest}</p>
      )}
    </div>
  );
}
