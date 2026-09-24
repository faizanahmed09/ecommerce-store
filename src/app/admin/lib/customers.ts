/*
 * ---------------------------------------------------------
 * CUSTOMER PROFILE LOOKUP
 * ---------------------------------------------------------
 *
 * orders.user_id is nullable (guest checkout) and there is no
 * FK embed to users, so both the dashboard and the orders
 * table resolved names with their own copy of this query.
 * One reader now serves both.
 */

import { createClient } from "@/src/app/lib/supabase/client";

export interface CustomerProfile {
  name: string;
  email: string | null;
  phone: string | null;
}

export { GUEST_CUSTOMER } from "./dashboard-figures";

export async function fetchCustomerProfiles(
  userIds: string[]
): Promise<Map<string, CustomerProfile>> {
  const profiles = new Map<string, CustomerProfile>();

  if (userIds.length === 0) {
    return profiles;
  }

  const { data, error } = await createClient()
    .from("users")
    .select("id, full_name, email, phone")
    .in("id", userIds);

  if (error) {
    /* A missing profile degrades to a guest label, not a failed page. */
    console.warn("Could not resolve customer profiles:", error);
    return profiles;
  }

  data?.forEach((row) => {
    profiles.set(row.id as string, {
      name: (row.full_name as string) || (row.email as string) || "Customer",
      email: (row.email as string) || null,
      phone: (row.phone as string) || null,
    });
  });

  return profiles;
}

/* The distinct, non-null user ids across a set of order rows. */
export const customerIdsOf = (rows: { user_id: string | null }[]): string[] =>
  Array.from(new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id))));
