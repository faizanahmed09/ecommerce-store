"use client";

import { ArrowRight, ArrowUpRight, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useNavigation } from "@/src/app/components/category-provider";
import { utilityLinks } from "@/src/app/lib/navigation";
import { cn } from "@/src/app/lib/utils";

type MobileNavProps = {
  /** Called whenever a link inside the panel is tapped — use this to close the parent Sheet. */
  onNavigate?: () => void;
};

/**
 * Touch screens have no hover, so the same category tree the desktop mega menu
 * reveals on hover is revealed here by tapping a category open.
 */
export default function MobileNav({ onNavigate }: MobileNavProps) {
  const pathname = usePathname();
  const { categories, loading } = useNavigation();

  /* undefined means "untouched", so the current route decides. */
  const [openCategory, setOpenCategory] = useState<string | null | undefined>(undefined);

  const routeCategory =
    categories.find(
      (category) =>
        category.groups?.length &&
        (pathname === category.href || pathname.startsWith(`${category.href}/`))
    )?.name ?? null;

  const activeCategory = openCategory === undefined ? routeCategory : openCategory;

  const toggleCategory = (categoryName: string) => {
    setOpenCategory(activeCategory === categoryName ? null : categoryName);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="border-b border-neutral-100 px-6 pb-5 pt-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-400">
          Menu
        </span>
      </div>

      <nav aria-label="Main" className="flex-1 px-6">
        {loading
          ? /* Placeholder rows so the drawer does not open empty. */
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="border-b border-neutral-100 py-5" aria-hidden>
                <span className="block h-4 w-32 animate-pulse rounded bg-neutral-100" />
              </div>
            ))
          : null}

        {categories.map((category) => {
          const isOpen = activeCategory === category.name;
          const hasPanel = Boolean(category.groups?.length);

          return (
            <div key={category.name} className="border-b border-neutral-100">
              <div className="flex items-center justify-between py-4">
                <Link
                  href={category.href}
                  onClick={onNavigate}
                  className={cn(
                    "text-[15px] font-semibold uppercase tracking-[0.08em] transition-colors",
                    category.accent ? "text-[#FF3D6E]" : "text-neutral-900 hover:text-neutral-500"
                  )}
                >
                  {category.name}
                </Link>

                {hasPanel && (
                  <button
                    onClick={() => toggleCategory(category.name)}
                    aria-expanded={isOpen}
                    aria-label={`Toggle ${category.name} subcategories`}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                      isOpen
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
                    )}
                  >
                    {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>

              {hasPanel && (
                <div
                  className={cn(
                    "grid overflow-hidden transition-all duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="min-h-0">
                    <div className="space-y-5 border-l-2 border-brand/30 py-1 pb-5 pl-4">
                      {category.groups?.map((group, groupIndex) => (
                        <div key={groupIndex}>
                          {group.title && (
                            <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                              {group.title}
                            </h3>
                          )}
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {group.links.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={onNavigate}
                                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-1.5 text-[13px] text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900"
                              >
                                {link.name}
                                {link.badge && (
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-strong">
                                    {link.badge}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}

                      {category.feature && (
                        <Link
                          href={category.feature.href}
                          onClick={onNavigate}
                          className={cn(
                            "relative flex flex-col overflow-hidden rounded-xl bg-gradient-to-br p-4 text-white",
                            category.feature.gradient
                          )}
                        >
                          <span className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10" />
                          <span className="relative text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                            {category.feature.eyebrow}
                          </span>
                          <span className="relative mt-1 text-base font-semibold">
                            {category.feature.title}
                          </span>
                          <span className="relative mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
                            {category.feature.cta}
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-neutral-100 bg-neutral-50 px-6 py-6">
        <div className="flex flex-col divide-y divide-neutral-200">
          {utilityLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={onNavigate}
              className="group flex items-center justify-between py-3 text-sm font-medium text-neutral-700 transition-colors hover:text-neutral-900"
            >
              {link.name}
              <ArrowUpRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neutral-900" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
