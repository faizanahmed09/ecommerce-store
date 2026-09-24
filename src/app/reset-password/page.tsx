"use client";

import { AuthLayout } from "@/src/app/components/auth-form";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/src/app/context/auth-context";
import { createClient } from "@/src/app/lib/supabase/client";
import { cn } from "@/src/app/lib/utils";
import { Check, Eye, EyeOff, Loader2, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

const MIN_PASSWORD_LENGTH = 8;

/*
 * Supabase sends people here from the recovery email. The link
 * carries a token that the client turns into a temporary
 * session, so the page has to wait for that before deciding
 * whether the visitor is allowed to set a new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { updatePassword } = useAuth();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const supabase = createClient();

    /*
     * The recovery token is exchanged for a session as the page
     * loads, so listen as well as checking once.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }

      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const checks = useMemo(
    () => [
      {
        label: `At least ${MIN_PASSWORD_LENGTH} characters`,
        passed: password.length >= MIN_PASSWORD_LENGTH,
      },
      { label: "Contains a number", passed: /\d/.test(password) },
      { label: "Contains a letter", passed: /[a-zA-Z]/.test(password) },
    ],
    [password]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) {
      return;
    }

    setError(null);

    if (checks.some((check) => !check.passed)) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include a letter and a number.`
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await updatePassword(password);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });

      router.push("/account");
      router.refresh();
    } catch (updateError) {
      console.error("Password update error:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "We couldn't update your password. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying your reset link...</p>
        </div>
      </AuthLayout>
    );
  }

  /* Link expired, already used, or opened directly. */
  if (!hasRecoverySession) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">This link is no longer valid</h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Password reset links expire after an hour and can only be used once. Request a fresh one
            to continue.
          </p>

          <Button asChild className="mt-8 h-11 w-full rounded-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Set a new password</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Choose a password you haven&apos;t used before.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>

            <div className="relative">
              <Input
                id="new-password"
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-11 pr-11"
                required
              />

              <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                aria-label={visible ? "Hide password" : "Show password"}
                className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {password.length > 0 && (
            <ul className="space-y-1.5">
              {checks.map((check) => (
                <li
                  key={check.label}
                  className={cn(
                    "flex items-center gap-2 text-xs",
                    check.passed ? "text-emerald-600" : "text-muted-foreground"
                  )}
                >
                  {check.passed ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {check.label}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm new password</Label>

            <Input
              id="confirm-new-password"
              type={visible ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="h-11"
              required
            />

            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>

          <Button type="submit" disabled={submitting} className="h-11 w-full rounded-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating password...
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
