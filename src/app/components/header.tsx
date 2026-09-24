"use client";

import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useCart } from "@/src/app/components/cart-provider";
import { MegaMenu } from "@/src/app/components/mega-menu";
import MobileNav from "@/src/app/components/mobile-nav";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/src/app/components/ui/sheet";
import { useAuth } from "@/src/app/context/auth-context";
import { cn } from "@/src/app/lib/utils";

const topBarLinks = [
  { name: "PK", href: "#" },
  { name: "Returns & Exchanges", href: "/returns" },
  { name: "Order Tracking", href: "/track-order" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { cartCount } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  /*
   * Search is a page, not a live filter: it hands the term to /products, so
   * results keep the sort and filter controls and the url can be shared.
   */
  const handleSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const term = searchTerm.trim();

    if (!term) {
      return;
    }

    router.push(`/products?q=${encodeURIComponent(term)}`);
    setIsSearchOpen(false);
  };

  /* Closing discards the term, so re-opening never shows a stale search. */
  const toggleSearch = (): void => {
    setIsSearchOpen((open) => {
      if (open) {
        setSearchTerm("");
      }

      return !open;
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-100 bg-white">
      {/* Top bar */}
      <div className="hidden bg-neutral-950 sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <div className="flex items-center space-x-6">
            {topBarLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400 transition-colors hover:text-white"
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Mobile menu trigger */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0 sm:w-[380px]">
              <SheetHeader className="sr-only">
                <SheetTitle>Site menu</SheetTitle>
              </SheetHeader>
              <MobileNav onNavigate={() => setIsMenuOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <div className="flex-1 text-center lg:flex-none lg:text-left">
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Lamees home">
              <Image
                src="/lamees-logo.jpg"
                alt="Lamees logo"
                width={44}
                height={44}
                loading="eager"
                className="h-10 w-10 rounded-md sm:h-11 sm:w-11"
              />
              {/* Phones get the logo alone; the name joins it from sm up. */}
              <span className="hidden flex-col items-start sm:flex">
                <span className="text-2xl font-bold uppercase tracking-[0.2em] text-neutral-900">
                  Lamees
                </span>
                <span className="mt-1 h-[2px] w-8 bg-[#FF3D6E]" />
              </span>
            </Link>
          </div>

          {/* Search, account, wishlist, cart */}
          <div className="flex items-center gap-1">
            <form
              onSubmit={handleSearch}
              role="search"
              className={cn(
                "overflow-hidden transition-all duration-300 ease-out",
                isSearchOpen ? "w-40 sm:w-64" : "w-0"
              )}
            >
              <label htmlFor="site-search" className="sr-only">
                Search products
              </label>
              <Input
                id="site-search"
                type="search"
                name="q"
                placeholder="Search..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                autoFocus={isSearchOpen}
                /* Nothing to submit while it is closed, and nothing to tab to. */
                disabled={!isSearchOpen}
                className="h-9 w-full border-neutral-200 focus-visible:ring-[#FF3D6E]"
              />
            </form>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSearch}
              aria-label={isSearchOpen ? "Close search" : "Open search"}
            >
              {isSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>
            {user ? (
              <Link href="/account">
                <Button variant="ghost" size="icon" aria-label="Your account">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                {/* Signed out: an explicit way in, and a way to join. */}
                <Link href="/login" className="hidden sm:block">
                  <Button variant="ghost" size="sm" className="text-sm">
                    Sign in
                  </Button>
                </Link>

                <Link href="/signup" className="hidden sm:block">
                  <Button size="sm" className="rounded-full text-sm">
                    Sign up
                  </Button>
                </Link>

                <Link href="/login" className="sm:hidden">
                  <Button variant="ghost" size="icon" aria-label="Sign in">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
              </>
            )}
            <Link href="/wishlist">
              <Button variant="ghost" size="icon" aria-label="Wishlist">
                <Heart className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative" aria-label="Cart">
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF3D6E] text-[10px] font-semibold text-white">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop navigation */}
      <div className="hidden border-t border-neutral-100 lg:block">
        <div className="mx-auto max-w-7xl px-4">
          <MegaMenu />
        </div>
      </div>
    </header>
  );
}
