/*
 * ---------------------------------------------------------
 * DASHBOARD FIGURES
 * ---------------------------------------------------------
 *
 * The arithmetic behind the back-office landing page, with no
 * React and no Supabase in it: order rows in, finished figures
 * out. That is what makes the money rules testable, and it is
 * why the API route can run them server-side.
 *
 * Every bucket is keyed on a calendar day *in the admin's own
 * time zone*, which the browser names and passes through, so a
 * sale made at 11pm in Karachi lands on that Tuesday rather
 * than on Wednesday UTC.
 */

export interface RecentOrder {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  payment_status: string;
  customer_name: string;
}

export interface Trend {
  trend: string;
  trendPositive: boolean;
}

export interface DashboardData {
  totalRevenue: number;
  totalOrders: number;
  productCount: number;
  categoryCount: number;
  revenueTrend: Trend | null;
  orderTrend: Trend | null;
  chart: { label: string; value: number }[];
  recentOrders: RecentOrder[];
}

/* The customer profile as it arrives embedded in an order. */
interface EmbeddedUser {
  full_name: string | null;
  email: string | null;
}

/* The orders columns the dashboard reads. */
export interface OrderRow {
  id: string;
  user_id: string | null;
  created_at: string;
  status: string;
  total_amount: number | string;
  payment_status: string | null;
  /*
   * PostgREST returns an embedded parent as an object, but the
   * generated types describe some relations as an array, so
   * both shapes are accepted and normalised below.
   */
  users?: EmbeddedUser | EmbeddedUser[] | null;
}

export const GUEST_CUSTOMER = "Guest Customer";

/* How many recent orders the panel lists. */
export const RECENT_ORDER_LIMIT = 5;

/* Days in the revenue chart, and in one comparison window. */
export const CHART_DAYS = 7;

/*
 * ---------------------------------------------------------
 * CALENDAR DAYS
 * ---------------------------------------------------------
 *
 * Everything below works on "YYYY-MM-DD" keys rather than on
 * instants. Stepping back a *day* through UTC arithmetic on
 * the key cannot drift the way subtracting 24 hours does when
 * a clock change falls inside the window.
 */

const dayKeyFormatter = (timeZone: string) =>
  /* en-CA is the locale that formats as YYYY-MM-DD. */
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const weekdayFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });

/* Falls back to UTC rather than throwing on an unknown zone. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) {
    return "UTC";
  }

  try {
    dayKeyFormatter(timeZone).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

/* "2026-09-03" -> the same date shifted by `days`. */
const shiftKey = (key: string, days: number): string => {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
};

/*
 * A guest order carries no user_id, and a deleted profile
 * leaves the embed empty - both read as a guest rather than as
 * a blank byline.
 */
const customerName = (order: OrderRow): string => {
  const profile = Array.isArray(order.users) ? order.users[0] : order.users;

  if (!profile) {
    return GUEST_CUSTOMER;
  }

  return profile.full_name || profile.email || "Customer";
};

/*
 * Revenue counts settled money only: orders whose
 * payment_status is 'paid' and that were not cancelled.
 */
const isRevenue = (order: OrderRow): boolean =>
  order.payment_status === "paid" && order.status !== "cancelled";

/* Percentage change between two periods, for the stat caption. */
export function buildTrend(current: number, previous: number): Trend | null {
  if (previous <= 0) {
    return current > 0 ? { trend: "New activity this week", trendPositive: true } : null;
  }

  const change = ((current - previous) / previous) * 100;

  return {
    trend: `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs last week`,
    trendPositive: change >= 0,
  };
}

export function buildDashboard(
  orders: OrderRow[],
  productCount: number,
  categoryCount: number,
  timeZone: string
): DashboardData {
  const zone = safeTimeZone(timeZone);
  const toDayKey = dayKeyFormatter(zone);
  const toWeekday = weekdayFormatter(zone);

  const todayKey = toDayKey.format(new Date());

  /* Oldest first, so the chart reads left to right. */
  const chartDays = Array.from({ length: CHART_DAYS }, (_, index) =>
    shiftKey(todayKey, index - (CHART_DAYS - 1))
  );

  const thisWeekKeys = new Set(chartDays);

  const lastWeekKeys = new Set(
    Array.from({ length: CHART_DAYS }, (_, index) => shiftKey(chartDays[0], index - CHART_DAYS))
  );

  /*
   * One pass over the orders fills every figure at once - the
   * totals, both comparison windows and the chart buckets.
   */
  let totalRevenue = 0;
  let thisWeekRevenue = 0;
  let lastWeekRevenue = 0;
  let thisWeekOrders = 0;
  let lastWeekOrders = 0;

  const revenueByDay = new Map<string, number>();

  for (const order of orders) {
    const dayKey = toDayKey.format(new Date(order.created_at));
    const inThisWeek = thisWeekKeys.has(dayKey);
    const inLastWeek = lastWeekKeys.has(dayKey);

    if (inThisWeek) {
      thisWeekOrders += 1;
    } else if (inLastWeek) {
      lastWeekOrders += 1;
    }

    if (!isRevenue(order)) {
      continue;
    }

    const amount = Number(order.total_amount);

    totalRevenue += amount;

    if (inThisWeek) {
      thisWeekRevenue += amount;
      revenueByDay.set(dayKey, (revenueByDay.get(dayKey) ?? 0) + amount);
    } else if (inLastWeek) {
      lastWeekRevenue += amount;
    }
  }

  const chart = chartDays.map((dayKey) => {
    const [year, month, day] = dayKey.split("-").map(Number);

    return {
      /* Noon UTC, so the weekday cannot slip either side of the date. */
      label: toWeekday.format(new Date(Date.UTC(year, month - 1, day, 12))),
      value: revenueByDay.get(dayKey) ?? 0,
    };
  });

  /* The rows arrive newest first, names already attached. */
  const recentOrders: RecentOrder[] = orders.slice(0, RECENT_ORDER_LIMIT).map((order) => ({
    id: order.id,
    created_at: order.created_at,
    status: order.status,
    total_amount: Number(order.total_amount),
    payment_status: order.payment_status ?? "pending",
    customer_name: customerName(order),
  }));

  return {
    totalRevenue,
    totalOrders: orders.length,
    productCount,
    categoryCount,
    revenueTrend: buildTrend(thisWeekRevenue, lastWeekRevenue),
    orderTrend: buildTrend(thisWeekOrders, lastWeekOrders),
    chart,
    recentOrders,
  };
}
