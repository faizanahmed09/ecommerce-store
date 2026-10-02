"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useNavigation } from "@/src/app/components/category-provider";
import { type NavCategory } from "@/src/app/lib/navigation";
import { cn } from "@/src/app/lib/utils";
import { FREE_SHIPPING_COPY } from "@/src/app/lib/order-totals";

/* Hover intent: a short delay in stops the panel flickering as the pointer
   sweeps across the bar, a slightly longer one out lets it travel down into
   the panel without losing it. */
const OPEN_DELAY = 90;
const CLOSE_DELAY = 160;

export function MegaMenu({ light = false }: { light?: boolean }) {
  const { categories, loading } = useNavigation();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  /*
   * An open panel belongs to the route it was opened on, so
   * navigating closes it as a matter of arithmetic rather than
   * an effect reaching in to reset the state after the fact.
   *
   * It also settles the race the old reset could not: a hover
   * timer that fires just after the route changed carries the
   * page it was scheduled on, so it resolves to closed instead
   * of opening a panel over the page the visitor just landed on.
   */
  const [active, setActive] = useState<{ name: string | null; path: string }>({
    name: null,
    path: pathname,
  });

  const activeName = active.path === pathname ? active.name : null;

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const open = useCallback(
    (name: string | null) => {
      setActive({ name, path: pathname });
    },
    [pathname]
  );

  const closeNow = useCallback(() => {
    clearTimer();
    open(null);
  }, [clearTimer, open]);

  const scheduleOpen = useCallback(
    (name: string | null) => {
      clearTimer();
      timer.current = setTimeout(() => open(name), OPEN_DELAY);
    },
    [clearTimer, open]
  );

  const scheduleClose = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => open(null), CLOSE_DELAY);
  }, [clearTimer, open]);

  /*
   * Cleanup only - on unmount, and whenever the route changes,
   * so no pending timer is left to fire into the next page.
   */
  useEffect(() => clearTimer, [pathname, clearTimer]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Main"
      className="hidden justify-center lg:flex"
      onMouseLeave={scheduleClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") closeNow();
      }}
      onBlur={(event) => {
        /* Tabbing out of the nav entirely should put the panel away. */
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          closeNow();
        }
      }}
    >
      <ul className="flex items-center gap-6 xl:gap-9">
        {loading
          ? /* Placeholder bar so the header keeps its height. */
            Array.from({ length: 6 }).map((_, index) => (
              <li key={index} className="py-3.5">
                <span className={cn("block h-3 w-16 animate-pulse rounded", light ? "bg-white/30" : "bg-neutral-100")} />
              </li>
            ))
          : null}

        {categories.map((category) => {
          const hasPanel = Boolean(category.groups?.length);
          const isOpen = activeName === category.name && hasPanel;

          return (
            <li
              key={category.name}
              onMouseEnter={() => scheduleOpen(hasPanel ? category.name : null)}
            >
              <Link
                href={category.href}
                onFocus={() => (hasPanel ? open(category.name) : closeNow())}
                onClick={closeNow}
                aria-expanded={hasPanel ? isOpen : undefined}
                className={cn(
                  "group relative block whitespace-nowrap py-4 text-[13px] font-medium uppercase tracking-[0.16em] transition-colors xl:text-[14px]",
                  category.accent
                    ? light ? "text-[#f0c36b]" : "text-brand-strong"
                    : light
                      ? "text-white hover:text-white/80"
                      : isOpen || isCurrent(category.href)
                        ? "text-neutral-900"
                        : "text-neutral-700 hover:text-neutral-900"
                )}
              >
                {category.name}
                <span
                  className={cn(
                    "absolute bottom-2 left-0 h-[1.5px] transition-all duration-200",
                    category.accent ? "bg-brand" : light ? "bg-white" : "bg-neutral-900",
                    isOpen || isCurrent(category.href) ? "w-full" : "w-0 group-hover:w-full"
                  )}
                />
              </Link>

              {/* Rendered inside the trigger's item so Tab walks straight into
                  the panel it just opened. Both are positioned against the
                  header, which is the nearest positioned ancestor. */}
              {isOpen && (
                <>
                  {/* Dims the page behind the panel — decorative, never eats a click. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-full z-30 h-screen bg-neutral-950/25 duration-200 animate-in fade-in-0"
                  />
                  <MegaMenuPanel
                    category={category}
                    onMouseEnter={clearTimer}
                    onMouseLeave={scheduleClose}
                    onNavigate={closeNow}
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type MegaMenuPanelProps = {
  category: NavCategory;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onNavigate: () => void;
};

function MegaMenuPanel({ category, onMouseEnter, onMouseLeave, onNavigate }: MegaMenuPanelProps) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute inset-x-0 top-full z-40 border-t border-neutral-100 bg-white shadow-[0_28px_60px_-32px_rgba(0,0,0,0.45)] duration-200 ease-out animate-in fade-in-0 slide-in-from-top-1"
    >
      {/* A subtle brand hairline ties the panel to the header. */}
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-9">
        <div className="grid grid-cols-12 gap-10">
          <div
            className={cn(
              "col-span-12 grid gap-x-8 gap-y-8",
              (category.groups?.length ?? 0) > 3 ? "grid-cols-4" : "grid-cols-3"
            )}
          >
            {category.groups?.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="duration-300 animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both"
                style={{ animationDelay: `${groupIndex * 60}ms` }}
              >
                <h3
                  aria-hidden={!group.title}
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400"
                >
                  {group.title || "\u00A0"}
                </h3>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={onNavigate}
                        className="group/link inline-flex items-center gap-2 text-[14px] text-neutral-600 transition-colors hover:text-neutral-900"
                      >
                        <span className="relative after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-neutral-900 after:transition-all after:duration-200 group-hover/link:after:w-full">
                          {link.name}
                        </span>
                        {link.badge && (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-strong">
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-neutral-100 pt-5">
          <Link
            href={category.href}
            onClick={onNavigate}
            className="group/all inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-900"
          >
            Shop all {category.name}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/all:translate-x-1" />
          </Link>
          <span className="text-[12px] text-neutral-400">{FREE_SHIPPING_COPY}</span>
        </div>
      </div>
    </div>
  );
}
