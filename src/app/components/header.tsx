"use client";

import { Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useCart } from "@/src/app/components/cart-provider";
import { BrandLogo } from "@/src/app/components/brand-logo";
import { MegaMenu } from "@/src/app/components/mega-menu";
import MobileNav from "@/src/app/components/mobile-nav";
import { Button } from "@/src/app/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/src/app/components/ui/sheet";
import { useAuth } from "@/src/app/context/auth-context";
import { cn } from "@/src/app/lib/utils";
import { FREE_SHIPPING_LABEL } from "@/src/app/lib/order-totals";
import { EXCHANGE_WINDOW_DAYS } from "@/src/app/lib/returns-policy";

const announcements = [
  `${EXCHANGE_WINDOW_DAYS}-day exchanges`,
  "Packed within two working days",
  "Cash on delivery across Pakistan",
  `Free shipping from ${FREE_SHIPPING_LABEL}`,
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { cartCount } = useCart();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const overlay = isHome && !scrolled && !hovered && !focused && !isMenuOpen && !isSearchOpen;
  const actionColor = overlay ? "text-white hover:text-white/80" : "text-[#302b27] hover:text-[#7d3e50]";

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 12);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, [pathname]);

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
    <header
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      className={cn(
        "top-0 z-40 w-full border-b transition-[background-color,border-color,box-shadow,backdrop-filter,color] duration-200",
        isHome ? "fixed" : "sticky",
        overlay
          ? "border-transparent bg-transparent text-white"
          : scrolled
            ? "border-[#eadfd2] bg-[#fffaf2]/85 text-[#302b27] shadow-[0_8px_24px_rgba(48,43,39,0.08)] backdrop-blur-[6px]"
            : "border-[#eadfd2] bg-[#fffaf2] text-[#302b27]"
      )}
    >
      <div className="overflow-hidden bg-[#241517] text-[#d9c39e]">
        <div className="announcement-marquee flex w-max whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.15em] sm:text-xs">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex min-h-8 shrink-0 items-center gap-4 pr-4 sm:min-h-10" aria-hidden={copy === 1}>
              {[...announcements, ...announcements].map((message, index) => (
                <span key={`${index}-${message}`} className="inline-flex items-center gap-4" aria-hidden={index >= announcements.length}>
                  <span aria-hidden="true" className="text-[#ba965e]">✦</span>
                  {message}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main header */}
      <div className="mx-auto max-w-[1600px] px-3 py-3 sm:px-6 sm:py-4 lg:px-10 lg:py-2">
        <div className="grid grid-cols-[84px_minmax(0,1fr)_84px] items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
          {/* Mobile menu trigger */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 p-0 hover:bg-transparent lg:hidden [&_svg]:!size-6">
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

          <form onSubmit={handleSearch} role="search" className={cn("hidden w-full max-w-[300px] items-center gap-3 border-b pb-2 lg:flex", overlay ? "border-white/60" : "border-[#cfc3b8]")}>
            <button type="submit" aria-label="Search the store" className={cn("transition-colors", overlay ? "text-white/90 hover:text-white" : "text-[#847b78] hover:text-[#48212a]")}>
              <Search className="h-5 w-5" />
            </button>
            <label htmlFor="desktop-site-search" className="sr-only">Search the store</label>
            <input
              id="desktop-site-search"
              type="search"
              name="q"
              placeholder="Search the store"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none", overlay ? "text-white placeholder:text-white/75" : "text-[#302b27] placeholder:text-[#8c8580]")}
            />
          </form>

          {/* Logo */}
          <div className="min-w-0 text-center">
            <Link href="/" className="inline-flex items-center" aria-label="HAANI Threads home">
              <BrandLogo className="w-[92px] min-[375px]:w-[112px] lg:w-[170px]" inverted={overlay} eager />
            </Link>
          </div>

          {/* Search, account, wishlist, cart */}
          <div className="flex items-center justify-end gap-1 lg:gap-5">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSearch}
              className="h-10 w-10 p-0 hover:bg-transparent lg:hidden [&_svg]:!size-6"
              aria-label={isSearchOpen ? "Close search" : "Open search"}
            >
              <Search />
            </Button>
            {user ? (
              <Link href="/account" className={cn("hidden h-10 items-center text-sm transition-colors lg:inline-flex", actionColor)} aria-label="Your account">
                Account
              </Link>
            ) : (
              <>
                <div className={cn("hidden items-center gap-2 whitespace-nowrap text-sm lg:flex", actionColor)}>
                  <Link href="/login">Sign in</Link>
                  <span className={overlay ? "text-white/60" : "text-[#b5aaa0]"}>/</span>
                  <Link href="/signup">Join</Link>
                </div>
              </>
            )}
            <Link href="/wishlist" className={cn("hidden h-10 w-10 items-center justify-center transition-colors lg:inline-flex", actionColor)} aria-label="Wishlist">
              <Heart className="h-5 w-5" />
            </Link>
            <Link href="/cart" className={cn("relative inline-flex h-10 w-10 items-center justify-center gap-2 transition-colors lg:w-auto", actionColor)} aria-label={`Bag, ${cartCount} items`}>
                <ShoppingBag className="h-6 w-6 lg:h-5 lg:w-5" />
                <span className="hidden whitespace-nowrap text-sm lg:inline">Bag <span className={overlay ? "text-white/75" : "text-[#968f8a]"}>({cartCount})</span></span>
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white lg:hidden">
                    {cartCount}
                  </span>
                )}
            </Link>
          </div>
        </div>
      </div>

      {isSearchOpen && (
        <form onSubmit={handleSearch} role="search" className="flex h-16 items-center gap-4 border-t border-[#eadfd2] bg-[#fffaf2] px-6 text-[#302b27] lg:hidden">
          <button type="submit" aria-label="Search products" className="shrink-0">
            <Search className="h-6 w-6" />
          </button>
          <label htmlFor="mobile-site-search" className="sr-only">Search the store</label>
          <input
            id="mobile-site-search"
            type="search"
            name="q"
            placeholder="SEARCH FOR..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-sm uppercase tracking-[0.18em] outline-none placeholder:text-[#68707a]"
          />
          <button type="button" onClick={toggleSearch} aria-label="Close search" className="shrink-0">
            <X className="h-7 w-7" />
          </button>
        </form>
      )}

      {/* Desktop navigation */}
      <div className={cn("hidden border-t lg:block", overlay ? "border-white/30" : "border-[#eadfd2]")}>
        <div className="mx-auto max-w-7xl px-4">
          <MegaMenu light={overlay} />
        </div>
      </div>
    </header>
  );
}
