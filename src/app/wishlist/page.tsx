"use client";

/*
 * ---------------------------------------------------------
 * WISHLIST
 * ---------------------------------------------------------
 *
 * The heart in the header has always pointed at /wishlist, and
 * there was no such route - the saved list existed only as a
 * tab inside /account, so the header's own button 404'd.
 *
 * The list itself is the same component the account tab
 * renders, so the two cannot drift apart.
 */

import { AccountWishlist } from "@/src/app/components/account-wishlist";
import { Button } from "@/src/app/components/ui/button";
import { Container } from "@/src/app/components/ui/container";
import { useAuth } from "@/src/app/context/auth-context";
import { Heart } from "lucide-react";
import Link from "next/link";

export default function WishlistPage() {
  const { user, loading } = useAuth();

  return (
    <Container className="py-10 lg:py-14">
      <header className="mb-10 border-b pb-8">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground">Wishlist</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Wishlist</h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pieces you have saved. A wishlist is kept with your account, so it follows you to any
          device you sign in on.
        </p>
      </header>

      {/*
        Signed out there is nothing to read: the list lives in
        wishlist_items against a user, never in this browser.
      */}
      {!user && !loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-3">
            <Heart className="h-6 w-6 text-muted-foreground" />
          </div>

          <h2 className="text-lg font-semibold">Sign in to see your wishlist</h2>

          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Saved items are kept with your account rather than on this device.
          </p>

          <Button asChild className="mt-6 rounded-full px-6">
            <Link href="/login?redirect=/wishlist">Sign in</Link>
          </Button>
        </div>
      ) : (
        <AccountWishlist />
      )}
    </Container>
  );
}
