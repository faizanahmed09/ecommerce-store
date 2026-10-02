/*
 * ---------------------------------------------------------
 * BROWSER SUPABASE CLIENT
 * ---------------------------------------------------------
 *
 * createBrowserClient, not the plain createClient: it keeps the
 * session in a cookie rather than in localStorage.
 *
 * That difference is the whole point. localStorage is readable
 * only by JavaScript in the tab that wrote it, so the server
 * had no way to tell who was asking - which is why /admin could
 * only ever be guarded after the page had already rendered, in
 * the browser, by code the visitor controls. A cookie travels
 * with the request, so proxy.ts can refuse an unauthorised
 * visitor before a single byte of the admin shell is sent.
 *
 * The returned client is the same SupabaseClient every call
 * site already uses; only where the session lives has changed.
 */

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;
let publicClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  /*
   * Still memoised. Two clients in one tab would each install
   * their own auth listener and race each other refreshing the
   * same token.
   */
  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}

/* Storefront catalogue reads must use public RLS even in an admin's browser. */
export function createPublicClient() {
  if (publicClient) return publicClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  publicClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return publicClient;
}
