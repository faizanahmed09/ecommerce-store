"use client";

import { Button } from "@/src/app/components/ui/button";
import { Container } from "@/src/app/components/ui/container";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/*
 * The storefront's error boundary. Without it an unhandled
 * throw - a Supabase outage during a server render, say -
 * reaches Next's default screen, which in production reads
 * "Application error: a client-side exception has occurred".
 *
 * `reset` re-renders the segment, which is enough to recover
 * from a request that failed once.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Storefront error:", error);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>

      <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Something went wrong
      </h1>

      <p className="mb-8 max-w-md text-sm leading-6 text-muted-foreground">
        We couldn&apos;t load this page. Your cart and account are unaffected —
        please try again.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>Try again</Button>

        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>

      {/*
        The digest is the only handle on a production stack trace,
        which is stripped before it reaches the browser.
      */}
      {error.digest && (
        <p className="mt-8 font-mono text-[11px] text-muted-foreground/60">
          Reference: {error.digest}
        </p>
      )}
    </Container>
  );
}
