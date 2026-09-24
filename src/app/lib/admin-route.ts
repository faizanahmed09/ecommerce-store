/*
 * ---------------------------------------------------------
 * ADMIN ROUTE GUARD
 * ---------------------------------------------------------
 *
 * Every /api/admin route needs the same four things: a bearer
 * token, a Supabase client bound to it, a verified user, and a
 * users.user_type of 'admin'. It was written out twice; a third
 * copy is where the checks start to diverge.
 *
 * The caller's own token is forwarded rather than a service
 * key, so RLS runs as that admin and these routes can read
 * nothing the person using them could not.
 *
 * proxy.ts already refuses non-admins at /admin/*, but that
 * guards pages, not API routes - a route reached directly with
 * a shopper's token has to refuse for itself.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Database } from "@/src/app/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type AdminContext =
  { ok: true; supabase: Client; userId: string } | { ok: false; response: NextResponse };

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  return scheme?.toLowerCase() === "bearer" && token ? token : null;
};

export async function requireAdmin(request: Request): Promise<AdminContext> {
  const token = bearerToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in first." }, { status: 401 }),
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Supabase is not configured." }, { status: 500 }),
    };
  }

  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  /*
   * getUser, not getSession: getSession trusts the token as
   * presented, and a token is whatever the caller sent.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Your session has expired." }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.user_type !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }),
    };
  }

  return { ok: true, supabase, userId: user.id };
}
