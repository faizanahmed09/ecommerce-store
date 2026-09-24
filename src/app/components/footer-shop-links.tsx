"use client";

/*
 * ---------------------------------------------------------
 * FOOTER SHOP COLUMN
 * ---------------------------------------------------------
 *
 * The footer's "Shop" list was six hand-written links - Men,
 * Kids, Footwear, Fragrance - none of which are departments in
 * this catalogue, so most of the column 404'd or opened an
 * empty page. It now reads the same category store the mega
 * menu and the homepage do, so it can only ever offer what the
 * shop actually sells.
 *
 * Sale stays hard-coded on the end: it is a route rather than a
 * category row, exactly as it is in the navigation.
 */

import { useRootCategories } from "@/src/app/components/category-provider";
import { sectionHref } from "@/src/app/lib/navigation";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/* The footer is a list, not a directory - keep it short. */
const MAX_DEPARTMENTS = 6;

export function FooterShopLinks() {
  const { categories, loading } = useRootCategories();

  const links = [
    ...categories.slice(0, MAX_DEPARTMENTS).map((category) => ({
      label: category.name,
      href: sectionHref(category.slug),
    })),
    { label: "Sale", href: "/sale" },
  ];

  if (loading) {
    return (
      <ul className="mt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="h-4 w-24 animate-pulse rounded bg-muted" />
        ))}
      </ul>
    );
  }

  return (
    <ul className="mt-5 space-y-3">
      {links.map(({ label, href }) => (
        <li key={href}>
          <Link
            href={href}
            className="group inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {label}
            <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
