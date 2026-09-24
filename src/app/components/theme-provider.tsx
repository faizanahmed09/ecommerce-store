"use client";

/*
 * ---------------------------------------------------------
 * THEME PROVIDER
 * ---------------------------------------------------------
 *
 * The stored preference and the operating system's setting are
 * both things outside React that can change on their own, so
 * they are read as external stores rather than copied into
 * state by an effect.
 *
 * That is not only a lint rule: the effect version rendered
 * once with the default theme, then set state and rendered
 * again, so a shopper who had chosen dark saw a flash of light
 * on every page load. Subscribing means the first client render
 * already knows the answer.
 */

import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

type ThemeContextType = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/*
 * ---------------------------------------------------------
 * THE STORED PREFERENCE
 * ---------------------------------------------------------
 */

const storeListeners = new Set<() => void>();

/* Cached so getSnapshot does not hit localStorage every render. */
let cachedTheme: Theme | null = null;
let cacheLoaded = false;

function readStoredTheme(): Theme | null {
  /* Private windows and blocked site data both throw here. */
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);

    return value === "light" || value === "dark" || value === "system" ? value : null;
  } catch {
    return null;
  }
}

function getStoredTheme(): Theme | null {
  if (!cacheLoaded) {
    cachedTheme = readStoredTheme();
    cacheLoaded = true;
  }

  return cachedTheme;
}

function writeStoredTheme(theme: Theme): void {
  cachedTheme = theme;
  cacheLoaded = true;

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* The in-memory value still drives this tab. */
  }
}

function emitThemeChange(): void {
  for (const listener of storeListeners) {
    listener();
  }
}

function subscribeToStoredTheme(listener: () => void): () => void {
  storeListeners.add(listener);

  /* Another tab changing the theme fires this, never our own. */
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      cacheLoaded = false;
      listener();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    storeListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/*
 * ---------------------------------------------------------
 * THE SYSTEM SETTING
 * ---------------------------------------------------------
 */

function subscribeToSystemTheme(listener: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);

  query.addEventListener("change", listener);

  return () => query.removeEventListener("change", listener);
}

const getSystemPrefersDark = (): boolean => window.matchMedia(DARK_QUERY).matches;

/* The server has no window; light is the documented default. */
const getServerStoredTheme = (): Theme | null => null;
const getServerPrefersDark = (): boolean => false;

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "light",
  enableSystem = false,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const storedTheme = useSyncExternalStore(
    subscribeToStoredTheme,
    getStoredTheme,
    getServerStoredTheme
  );

  const prefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemPrefersDark,
    getServerPrefersDark
  );

  /* Set by the setter so the effect below knows a change was
     deliberate, and can suppress the transition for it. */
  const suppressTransition = useRef(false);

  const theme: Theme = useMemo(() => {
    const initial = storedTheme ?? defaultTheme;

    if (enableSystem && (!storedTheme || initial === "system")) {
      return prefersDark ? "dark" : "light";
    }

    return initial;
  }, [storedTheme, defaultTheme, enableSystem, prefersDark]);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (prefersDark ? "dark" : "light") : theme;

  /*
   * Writing the class onto <html> is synchronising an external
   * system with React state, which is what an effect is for -
   * no state is set here.
   */
  useEffect(() => {
    if (attribute !== "class") {
      return;
    }

    const root = document.documentElement;
    const suppress = suppressTransition.current;

    if (suppress) {
      root.style.transition = "none";
    }

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);

    if (!suppress) {
      return;
    }

    suppressTransition.current = false;

    /* Restored after the browser has painted the new colours. */
    const frame = requestAnimationFrame(() => {
      root.style.transition = "";
    });

    return () => cancelAnimationFrame(frame);
  }, [attribute, resolvedTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      suppressTransition.current = disableTransitionOnChange;
      writeStoredTheme(next);
      emitThemeChange();
    },
    [disableTransitionOnChange]
  );

  const value = useMemo<ThemeContextType>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
};
