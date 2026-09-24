/*
 * ---------------------------------------------------------
 * COPYRIGHT YEAR
 * ---------------------------------------------------------
 *
 * The footer's "© 2026". It sits inside a client boundary
 * (LayoutWrapper is "use client"), so reading the clock there
 * meant calling new Date() during the prerender - a value that
 * differs between the build and the visit, which Cache
 * Components refuses rather than baking in silently.
 *
 * Read here instead, in a cached scope with a day's life, and
 * passed down as a prop. The year is then part of the static
 * shell, correct for everyone, and rolls over on its own
 * without making the footer - and so every page that renders
 * it - dynamic.
 */

import { cacheLife } from "next/cache";

export async function getCurrentYear(): Promise<number> {
  "use cache";
  cacheLife("days");

  return new Date().getFullYear();
}
