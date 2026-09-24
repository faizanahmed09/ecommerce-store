// src/app/context/auth-provider.tsx
"use client";

import { createClient } from "@/src/app/lib/supabase/client";
import { ensureUserProfile, fetchUserProfileByEmail, type UserProfile } from "@/src/app/lib/users";
import type { AuthError, PostgrestError, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Type definitions
export type SignUpResult = {
  error: AuthError | PostgrestError | null;
  /*
   * True when Supabase created the account but is waiting on
   * email confirmation, so there is no session yet.
   */
  needsEmailConfirmation: boolean;
};

export type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
  signOut: () => Promise<{ error: AuthError | null }>;
  /* Sends the "set a new password" email. */
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  /* Applies a new password for the recovery session. */
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
};

// Create context with proper typing
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    /*
     * Sign-up cannot write the profile row (no session, so RLS rejects it),
     * and the server-side trigger that normally does is not guaranteed to be
     * installed. Reconciling once a session exists means a missing profile
     * repairs itself instead of surfacing as a broken account.
     */
    const syncProfile = (sessionUser: User) => {
      ensureUserProfile(sessionUser).catch((error) => {
        console.error("Profile sync error:", error);
      });
    };

    const getSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("Session error:", error);
          setUser(null);
        } else {
          setUser(session?.user ?? null);

          if (session?.user) {
            syncProfile(session.user);
          }
        }
      } catch (error) {
        console.error("Unexpected error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      /*
       * Only on a fresh sign-in - this fires on every token refresh too, and
       * the profile does not need re-checking each time.
       */
      if (event === "SIGNED_IN" && session?.user) {
        syncProfile(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      console.error("Sign in error:", error);
      return { error: error as AuthError };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<SignUpResult> => {
    try {
      const normalisedEmail = email.trim().toLowerCase();

      // Auth signup
      const { data, error: authError } = await supabase.auth.signUp({
        email: normalisedEmail,
        password,
        options: { data: { full_name: fullName } },
      });

      if (authError) {
        return { error: authError, needsEmailConfirmation: false };
      }

      /*
       * With email confirmation switched on Supabase returns a
       * user but no session until the link is clicked.
       */
      const needsEmailConfirmation = !data.session;

      const authUser = data.user;

      if (!authUser) {
        return { error: null, needsEmailConfirmation: true };
      }

      /*
       * Without a session the client is still the anon role, so
       * auth.uid() is NULL and users_insert_self (id = auth.uid())
       * rejects the write with a 403. The account itself is fine -
       * the on_auth_user_created trigger writes the profile
       * server-side, and ensureUserProfile() backstops it on the
       * first sign-in. Reporting an error here would fail a signup
       * that actually succeeded.
       */
      if (needsEmailConfirmation) {
        return { error: null, needsEmailConfirmation: true };
      }

      /*
       * Mirror the auth user into the public users table.
       *
       * The row id is set to the auth user id on purpose: the
       * schema points orders.user_id, carts.user_id and
       * wishlists.user_id at users.id, so the two must match or
       * nothing can ever be joined back to the signed-in user.
       */
      let existing: UserProfile | null = null;

      try {
        existing = await fetchUserProfileByEmail(normalisedEmail);
      } catch (lookupError) {
        return {
          error: lookupError as PostgrestError,
          needsEmailConfirmation,
        };
      }

      if (existing) {
        /*
         * A profile already exists for this address (older
         * signups created one with a random id). Leave the id
         * alone - other tables may reference it - and just
         * refresh the name.
         */
        const { error: updateError } = await supabase
          .from("users")
          .update({ full_name: fullName, updated_at: new Date().toISOString() })
          .eq("id", existing.id);

        return { error: updateError, needsEmailConfirmation };
      }

      const { error: profileError } = await supabase.from("users").insert({
        id: authUser.id,
        email: normalisedEmail,
        full_name: fullName,
        /*
         * Supabase Auth owns the credential. password_hash is
         * NOT NULL in schema.sql, so it carries a marker rather
         * than a real hash - never a copy of the password.
         */
        password_hash: "managed_by_supabase_auth",
        user_type: "user",
      });

      return { error: profileError, needsEmailConfirmation };
    } catch (error) {
      console.error("Sign up error:", error);
      return {
        error: error as PostgrestError,
        needsEmailConfirmation: false,
      };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
      });

      return { error };
    } catch (error) {
      console.error("Password reset error:", error);
      return { error: error as AuthError };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      return { error };
    } catch (error) {
      console.error("Password update error:", error);
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      setUser(null);
      return { error };
    } catch (error) {
      console.error("Sign out error:", error);
      return { error: error as AuthError };
    }
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
export { AuthContext };

// Export the hook directly from this file
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
