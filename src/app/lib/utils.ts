import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/*
 * One currency format for the whole app - storefront and
 * admin both render "Rs. 1,234".
 */
export function formatCurrency(amount: number | string | null): string {
  const value = Number(amount ?? 0);

  if (!Number.isFinite(value)) {
    return "Rs. 0";
  }

  return `Rs. ${new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function generatePagination(currentPage: number, totalPages: number) {
  // If the total number of pages is 7 or less,
  // display all pages without any ellipsis.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // If the current page is among the first 3 pages,
  // show the first 3, an ellipsis, and the last 2 pages.
  if (currentPage <= 3) {
    return [1, 2, 3, "...", totalPages - 1, totalPages];
  }

  // If the current page is among the last 3 pages,
  // show the first 2, an ellipsis, and the last 3 pages.
  if (currentPage >= totalPages - 2) {
    return [1, 2, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  // If the current page is somewhere in the middle,
  // show the first page, an ellipsis, the current page and its neighbors,
  // another ellipsis, and the last page.
  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

/*
 * Hosts next/image is allowed to optimise, mirroring
 * `images.remotePatterns` in next.config.ts. Keep the two in sync.
 */
const ALLOWED_IMAGE_SOURCES: ReadonlyArray<{
  hostname: RegExp;
  pathname?: RegExp;
}> = [
  { hostname: /(^|\.)supabase\.co$/, pathname: /^\/storage\/v1\/object\// },
  { hostname: /^picsum\.photos$/ },
];

/*
 * next/image throws - and takes the whole route down with a 500 - when its
 * src names a host that is not configured. Image URLs are typed into the
 * admin UI, so one typo or pasted link would otherwise break the storefront.
 * Anything that is not a local path or an allow-listed remote degrades to the
 * placeholder instead.
 */
export function safeImageSrc(
  src: string | null | undefined,
  fallback = "/placeholder.svg",
): string {
  const value = src?.trim();

  if (!value) return fallback;

  /* Local assets are served by us and need no allow-list entry. */
  if (value.startsWith("/")) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fallback;
  }

  if (url.protocol !== "https:") return fallback;

  const allowed = ALLOWED_IMAGE_SOURCES.some(
    ({ hostname, pathname }) =>
      hostname.test(url.hostname) && (!pathname || pathname.test(url.pathname)),
  );

  return allowed ? value : fallback;
}

/*
 * URL-safe slug from a display name: lowercase, non-alphanumerics
 * collapsed to single hyphens, no leading or trailing hyphen.
 */
export const generateSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
