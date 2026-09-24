import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/*
 * Server-side Supabase client for anonymous reads (categories,
 * products) in server components.
 *
 * This deliberately does NOT bind to cookies. The old
 * implementation used createServerComponentClient from
 * @supabase/auth-helpers-nextjs, which reads `cookies()`
 * synchronously - that package is deprecated and Next 15 made
 * `cookies()` async, so every server render logged:
 *
 *   Route "..." used `cookies().get(...)`. `cookies()` should
 *   be awaited before using its value.
 *
 * Nothing on the server reads the session today; the signed-in
 * user is resolved in client components through auth-context.
 * If server-side session access is needed later, add
 * @supabase/ssr and use createServerClient with the async
 * cookie adapter rather than reviving auth-helpers.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
