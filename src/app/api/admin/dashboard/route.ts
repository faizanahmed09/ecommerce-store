/*
 * ---------------------------------------------------------
 * GET /api/admin/dashboard
 * ---------------------------------------------------------
 *
 * The whole back-office landing page in one request.
 *
 * The browser used to open four connections of its own - two
 * counts, every order row, then the customer names once those
 * had landed. The fan-out still happens, but it happens here,
 * beside the database, and the dashboard makes a single call.
 *
 * The caller's own access token is forwarded to Supabase, so
 * every policy in schema.sql applies exactly as it would from
 * the browser. This route holds no service key and can read
 * nothing the signed-in admin could not read themselves.
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { buildDashboard, type OrderRow } from "@/src/app/admin/lib/dashboard-figures";
import type { Database } from "@/src/app/lib/supabase/database.types";

/*
 * The join rides along with the order row, so the five names
 * under "Recent orders" cost nothing beyond this one query.
 */
const ORDER_SELECT =
  "id, user_id, total_amount, created_at, status, payment_status, " + "users (full_name, email)";

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  return scheme?.toLowerCase() === "bearer" && token ? token : null;
};

export async function GET(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Sign in to view the dashboard." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "The server is missing its Supabase configuration." },
      { status: 500 }
    );
  }

  /*
   * Anon key plus the caller's bearer token: RLS runs as that
   * user, not as the service role.
   */
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  /*
   * The role lives on users.user_type, the same column the
   * admin layout gates on. Without this check a shopper would
   * get a dashboard built from their own orders rather than a
   * refusal - the figures would be wrong, not merely empty.
   */
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "Could not confirm your access." }, { status: 500 });
  }

  if (profile?.user_type !== "admin") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const [products, categories, orders] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }),
  ]);

  const failure = products.error ?? categories.error ?? orders.error;

  if (failure) {
    console.error("Dashboard query failed:", failure);

    return NextResponse.json({ error: failure.message }, { status: 502 });
  }

  const data = buildDashboard(
    (orders.data ?? []) as unknown as OrderRow[],
    products.count ?? 0,
    categories.count ?? 0,
    searchParams.get("tz") ?? "UTC"
  );

  /* Figures go stale the moment an order lands; never cache them. */
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
