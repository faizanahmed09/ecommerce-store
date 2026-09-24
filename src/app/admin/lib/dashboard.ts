/*
 * ---------------------------------------------------------
 * DASHBOARD DATA
 * ---------------------------------------------------------
 *
 * One request. The counts, the totals, the week-over-week
 * arithmetic, the 7-day chart and the recent orders with their
 * customer names all arrive together from
 * /api/admin/dashboard, which does the fan-out server-side.
 *
 * The figures themselves are computed in lib/dashboard-figures,
 * which has no React and no Supabase in it. This module only
 * asks for them.
 */

import { createClient } from "@/src/app/lib/supabase/client";
import { safeTimeZone, type DashboardData } from "./dashboard-figures";

/* The screens import their row shapes from here, as before. */
export { buildTrend, type DashboardData, type RecentOrder, type Trend } from "./dashboard-figures";

const DASHBOARD_ENDPOINT = "/api/admin/dashboard";

/*
 * The chart buckets on the admin's own calendar day so the
 * columns match the weekday labels underneath them. The server
 * cannot know that zone, so the browser names it.
 */
const localTimeZone = (): string => {
  try {
    return safeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return "UTC";
  }
};

/* The route answers a failure with { error }, not with figures. */
const errorFrom = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string };

    return body.error || `The dashboard request failed (${response.status}).`;
  } catch {
    return `The dashboard request failed (${response.status}).`;
  }
};

export async function fetchDashboard(): Promise<DashboardData> {
  /*
   * The route runs every query as the caller, so it needs the
   * caller's token. getSession reads it from storage and only
   * reaches the network when it has expired.
   */
  const {
    data: { session },
  } = await createClient().auth.getSession();

  if (!session) {
    throw new Error("Sign in to view the dashboard.");
  }

  const response = await fetch(`${DASHBOARD_ENDPOINT}?tz=${encodeURIComponent(localTimeZone())}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await errorFrom(response));
  }

  return (await response.json()) as DashboardData;
}
