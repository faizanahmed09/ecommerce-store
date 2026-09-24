/*
 * ---------------------------------------------------------
 * USER PROFILE QUERIES
 * ---------------------------------------------------------
 *
 * The sign-in redirect, the admin role guard and the signup
 * profile sync each looked up `users` by email with their own
 * projection. One reader keeps the role check identical
 * everywhere.
 *
 * Mirrors schema.sql: users (email, full_name, phone,
 * user_type).
 */

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/src/app/lib/supabase/client";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  user_type: string | null;
}

export const ADMIN_USER_TYPE = "admin";

/* Addresses are stored lowercased, so lookups must match. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

export async function fetchUserProfileByEmail(email: string): Promise<UserProfile | null> {
  const { data, error } = await createClient()
    .from("users")
    .select("id, email, full_name, phone, user_type")
    .eq("email", normaliseEmail(email))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as UserProfile | null) ?? null;
}

export const isAdminProfile = (profile: UserProfile | null): boolean =>
  profile?.user_type === ADMIN_USER_TYPE;

export interface ProfileUpdate {
  fullName: string;
  phone: string | null;
}

/**
 * Saves the account page's profile form.
 *
 * Email is deliberately absent: it is the Auth identity, and the form shows it
 * disabled for that reason. `users_update_own` in schema.sql permits this write
 * but pins user_type, so a shopper cannot promote themselves here.
 */
export async function updateUserProfile(
  userId: string,
  { fullName, phone }: ProfileUpdate
): Promise<void> {
  const { error } = await createClient()
    .from("users")
    .update({
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

/**
 * Guarantees the signed-in user has a `users` row.
 *
 * The profile is normally created by the `on_auth_user_created` trigger in
 * schema.sql, which runs SECURITY DEFINER because sign-up happens with no
 * session and RLS would reject a browser insert. This is the safety net for
 * the cases the trigger does not cover: a database where it was never
 * installed, and accounts created before it existed.
 *
 * It must run with a session - `users_insert_self` checks `id = auth.uid()`.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const supabase = createClient();

  const { data, error } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return;
  }

  const { error: insertError } = await supabase.from("users").insert({
    id: user.id,
    email: normaliseEmail(user.email ?? ""),
    full_name:
      typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "",
    /*
     * Supabase Auth owns the credential. password_hash is NOT NULL in
     * schema.sql, so it carries a marker rather than a real hash.
     */
    password_hash: "managed_by_supabase_auth",
    user_type: "user",
  });

  /*
   * 23505 is the unique violation on users.email: a legacy row already holds
   * this address under a different id. Other tables may reference that id, so
   * it is left alone rather than replaced.
   */
  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }
}
