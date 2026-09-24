/*
 * ---------------------------------------------------------
 * ROUTE GUARD (Next's `proxy` convention)
 * ---------------------------------------------------------
 *
 * Formerly middleware.ts. Next 16 renamed the convention -
 * "middleware" was read as Express middleware and encouraged
 * treating it as a general request pipeline, which it is not.
 * "Proxy" says what it is: a network boundary in front of the
 * app, deployable to the CDN, and a last resort rather than a
 * first reach.
 *
 * The rename is all that changed. Same APIs, same behaviour.
 *
 *
 * /admin used to be protected only in the browser. The page
 * shell rendered for anybody who typed the URL, and the check
 * that they were staff ran afterwards, in JavaScript the
 * visitor controls. RLS meant they saw empty tables rather than
 * data - but they saw the office, and could read what sections
 * and forms it has.
 *
 * This refuses them before a byte of it is sent. It runs before
 * the route does, and it is the reason the
 * session moved from localStorage into a cookie: a cookie
 * travels with the request, so the server can finally answer
 * "who is this?" without asking the browser.
 *
 * It gates /admin on users.user_type, not merely on being
 * signed in. Every shopper has an account; almost none of them
 * are staff.
 *
 * Scoped to /admin and nothing else, deliberately. getUser()
 * asks Supabase to verify the token, which is a network call -
 * running it on every storefront page would put an auth round
 * trip in front of pages we went to some trouble to serve from
 * cache, and bill a function invocation for each. Nothing on
 * the server reads the session outside this guard, and the
 * browser client refreshes its own token into the cookie, so
 * there is nothing for a wider matcher to do.
 *
 * This does NOT replace RLS. It is the outer door; the policies
 * are the locks on each drawer. A guard that could be bypassed
 * would then find every table still refusing it.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/src/app/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  /*
   * The response carries any refreshed auth cookies back to the
   * browser, so it has to be built before the client is and
   * handed to it - not created fresh afterwards, which would
   * throw the new cookies away.
   */
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    /*
     * Misconfigured rather than unauthorised. Failing closed on
     * /admin is the safe side of that line.
     */
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  /*
   * getUser(), not getSession(): getSession trusts whatever the
   * cookie says, and a cookie is client-supplied. getUser asks
   * Supabase to verify the token, which is the difference
   * between a guard and a formality.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", request.url);
    /* Come back here once they have signed in. */
    login.searchParams.set("redirect", request.nextUrl.pathname);

    return NextResponse.redirect(login);
  }

  /*
   * Signed in is not the same as staff. The role lives on
   * users.user_type, the same column is_admin() reads, so the
   * door and the locks agree on who is who.
   */
  const { data: profile } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.user_type !== "admin") {
    /*
     * Home rather than /login: they are signed in perfectly
     * well, just not as staff. Sending them to a login form
     * they have already passed would only confuse them - and
     * it quietly confirms that /admin is worth attacking.
     */
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  /*
   * The admin only. A shopper's request never reaches this
   * file, so browsing costs no invocation and no auth call.
   */
  matcher: ["/admin/:path*"],
};
