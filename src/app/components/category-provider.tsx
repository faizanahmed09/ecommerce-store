"use client";

/*
 * ---------------------------------------------------------
 * CATEGORY STORE
 * ---------------------------------------------------------
 *
 * The `categories` table barely changes, but it was being read
 * on nearly every page: the header ran its own query, the
 * homepage showcase ran another on the server, each department
 * grid ran a third, and the admin ran a fourth.
 *
 * It is now fetched once - on the first page a visitor opens -
 * and held here. Every later page, storefront and admin alike,
 * reads the rows already in hand, and a reload reads them back
 * from localStorage rather than the network.
 *
 * The store is refilled when the admin adds, edits or removes a
 * category (see `invalidateCategories`) - not on a timer, and
 * not on navigation.
 *
 * It lives outside React, as a module-level value components
 * subscribe to, because that is what it is: one copy of the
 * table shared by every tree on the page.
 */

import { buildNavCategories, type NavCategory } from "@/src/app/lib/navigation";
import { fetchCategories, type CategoryRecord } from "@/src/app/lib/categories";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

/*
 * Bump the version when the shape of CategoryRecord changes -
 * an old entry would otherwise be read back as the new shape.
 */
const CACHE_KEY = "lamees:categories:v1";

/*
 * A backstop, not a refresh policy. Admin writes invalidate the
 * store directly; this only covers the browser that never sees
 * one - a shopper whose device cached before the admin, working
 * elsewhere, added a department.
 */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/* Same-tab invalidation. Other tabs hear the `storage` event. */
const INVALIDATED_EVENT = "lamees:categories:invalidated";

const EMPTY: CategoryRecord[] = [];

interface CachedCategories {
  storedAt: number;
  rows: CategoryRecord[];
}

interface CategorySnapshot {
  /* Every row, alphabetical, parents and children together. */
  categories: CategoryRecord[];
  loading: boolean;
  error: unknown;
}

/*
 * ---------------------------------------------------------
 * THE STORE
 * ---------------------------------------------------------
 */

/*
 * The server renders with nothing in hand, so the client's
 * first render has to agree with it. The cache is read in an
 * effect, after hydration.
 */
const INITIAL: CategorySnapshot = {
  categories: EMPTY,
  loading: true,
  error: null,
};

let snapshot: CategorySnapshot = INITIAL;

/* "idle" is also where a failed load lands, so it can retry. */
let status: "idle" | "loading" | "ready" = "idle";

/* Concurrent mounts share one request rather than racing. */
let inFlight: Promise<CategoryRecord[]> | null = null;

const listeners = new Set<() => void>();

function publish(next: Partial<CategorySnapshot>): void {
  snapshot = { ...snapshot, ...next };

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): CategorySnapshot => snapshot;
const getServerSnapshot = (): CategorySnapshot => INITIAL;

/*
 * ---------------------------------------------------------
 * PERSISTENCE
 * ---------------------------------------------------------
 */

function readCache(): CategoryRecord[] | null {
  /* Private windows and blocked site data both throw here. */
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedCategories;

    if (!Array.isArray(parsed?.rows)) {
      return null;
    }

    if (Date.now() - parsed.storedAt > CACHE_MAX_AGE_MS) {
      return null;
    }

    return parsed.rows;
  } catch {
    return null;
  }
}

function writeCache(rows: CategoryRecord[]): void {
  try {
    const entry: CachedCategories = { storedAt: Date.now(), rows };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* A full or unavailable store still leaves the copy above. */
  }
}

/*
 * ---------------------------------------------------------
 * LOADING
 * ---------------------------------------------------------
 */

/*
 * Fills the store if it is empty. Does nothing once it holds
 * the table, which is what keeps this to one call per visit.
 */
function ensureLoaded(): void {
  if (status !== "idle") {
    return;
  }

  const cached = readCache();

  if (cached) {
    status = "ready";
    publish({ categories: cached, loading: false, error: null });
    return;
  }

  status = "loading";
  publish({ loading: true });

  inFlight ??= fetchCategories().finally(() => {
    inFlight = null;
  });

  inFlight
    .then((rows) => {
      writeCache(rows);
      status = "ready";
      publish({ categories: rows, loading: false, error: null });
    })
    .catch((error: unknown) => {
      /* The header still renders; it just has no departments. */
      console.error("Could not load categories:", error);

      /* Back to idle, so the next page can try again. */
      status = "idle";
      publish({ categories: EMPTY, loading: false, error });
    });
}

/*
 * Called by the admin after a category is created, edited or
 * deleted. Empties the store here and in every other open tab,
 * so it refills from the table.
 */
export function invalidateCategories(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    /*
     * Removing the key is also what other tabs hear: a `storage`
     * event fires in them, never in the tab that wrote it.
     */
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* Ignored - the copy below is dropped either way. */
  }

  status = "idle";
  publish({ loading: true });

  window.dispatchEvent(new Event(INVALIDATED_EVENT));

  ensureLoaded();
}

/*
 * ---------------------------------------------------------
 * REACT
 * ---------------------------------------------------------
 */

/*
 * Mounted once in the root layout. It owns nothing but the
 * lifecycle: fill the store on first paint, and listen for an
 * admin write here or in another tab.
 */
export function CategoryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    ensureLoaded();

    const onInvalidated = () => {
      status = "idle";
      ensureLoaded();
    };

    /* A null key means the whole store was cleared. */
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === CACHE_KEY) {
        onInvalidated();
      }
    };

    window.addEventListener(INVALIDATED_EVENT, onInvalidated);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(INVALIDATED_EVENT, onInvalidated);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <>{children}</>;
}

export interface CategoryStore extends CategorySnapshot {
  /* Drops the store and refills it. */
  refresh: () => void;
}

/* Every category row. */
export function useCategoryStore(): CategoryStore {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const refresh = useCallback(() => {
    invalidateCategories();
  }, []);

  return useMemo(() => ({ ...state, refresh }), [state, refresh]);
}

/* Departments only - the showcase and the sale grid. */
export function useRootCategories(): CategoryStore {
  const store = useCategoryStore();

  const categories = useMemo(
    () => store.categories.filter((category) => !category.parent_id),
    [store.categories]
  );

  return useMemo(() => ({ ...store, categories }), [store, categories]);
}

/*
 * The children of one department, by the parent's slug. Holds
 * no rows when the department itself is not in the table.
 */
export function useCategoryChildren(parentSlug: string): CategoryStore {
  const store = useCategoryStore();

  const categories = useMemo(() => {
    const parent = store.categories.find((category) => category.slug === parentSlug);

    if (!parent) {
      return EMPTY;
    }

    return store.categories.filter((category) => category.parent_id === parent.id);
  }, [store.categories, parentSlug]);

  return useMemo(() => ({ ...store, categories }), [store, categories]);
}

/*
 * The navigation tree the mega menu and the mobile drawer
 * render, built from the same rows.
 */
export function useNavigation(): {
  categories: NavCategory[];
  loading: boolean;
} {
  const { categories, loading } = useCategoryStore();

  return useMemo(
    () => ({ categories: buildNavCategories(categories), loading }),
    [categories, loading]
  );
}

export type { CategoryRecord };
