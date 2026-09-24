"use client";

/*
 * ---------------------------------------------------------
 * useAsyncData
 * ---------------------------------------------------------
 *
 * Every screen that reads from Supabase was repeating the
 * same six steps: flip a loading flag, run the query, guard
 * the response against an unmounted component, store the
 * rows, log and report the failure, clear the flag.
 *
 * This hook owns that cycle so the call sites are left with
 * just the query and what to do when it fails.
 *
 * The fetcher must be stable (wrap it in useCallback) - it is
 * the dependency that decides when a refetch happens.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAsyncDataOptions<T> {
  /* Held while loading and restored if the fetch fails. */
  fallback: T;
  /* False keeps the hook idle, e.g. until a user id is known. */
  enabled?: boolean;
  onError?: (error: unknown) => void;
}

export interface AsyncData<T> {
  data: T;
  loading: boolean;
  error: unknown;
  /* Re-runs the current fetcher. */
  reload: () => void;
  /* For optimistic edits, e.g. dropping a deleted row. */
  setData: React.Dispatch<React.SetStateAction<T>>;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  { fallback, enabled = true, onError }: UseAsyncDataOptions<T>
): AsyncData<T> {
  /* Read through refs so neither one can retrigger the fetch. */
  const fallbackRef = useRef(fallback);
  const onErrorRef = useRef(onError);

  /*
   * Kept current in an effect rather than assigned during
   * render: a render can be thrown away, and writing to a ref
   * from one makes the value depend on renders that never
   * committed. Declared above the fetch effect so it has
   * already run by the time a failure can call it.
   */
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);

  /* Bumped by reload() to re-run the effect on demand. */
  const [reloadToken, setReloadToken] = useState(0);

  /*
   * Effects run after paint, so a fetch queued by a new fetcher
   * would otherwise show one frame of "no results" before the
   * loading flag caught up. Adjusting it during render keeps
   * that frame off the screen.
   */
  const [pending, setPending] = useState({ fetcher, enabled });

  if (pending.fetcher !== fetcher || pending.enabled !== enabled) {
    setPending({ fetcher, enabled });
    setLoading(enabled);
  }

  useEffect(() => {
    if (!enabled) {
      setData(fallbackRef.current);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);

    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }

        setData(fallbackRef.current);
        setError(caught);
        onErrorRef.current?.(caught);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    /* A superseded request must not overwrite a newer one. */
    return () => {
      cancelled = true;
    };
  }, [fetcher, enabled, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { data, loading, error, reload, setData };
}
