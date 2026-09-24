"use client";

import { AuthLayout } from "@/src/app/components/auth-form";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import { useAuth } from "@/src/app/context/auth-context";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error: resetError } = await resetPassword(email);

      if (resetError) {
        throw resetError;
      }

      /*
       * Always confirm, even for an address with no account -
       * telling people which emails are registered leaks the
       * user list.
       */
      setSent(true);
    } catch (resetError) {
      console.error("Password reset error:", resetError);
      setError(
        resetError instanceof Error
          ? resetError.message
          : "We couldn't send the reset email. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand-strong">
            <MailCheck className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>,
            we&apos;ve sent a link to reset your password. It expires in one hour.
          </p>

          <Button asChild className="mt-8 h-11 w-full rounded-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <div>
          <Link
            href="/login"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reset your password</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Enter the email on your account and we&apos;ll send you a link to set a new password.
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
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-11"
                required
              />
            </div>

            <Button type="submit" disabled={submitting} className="h-11 w-full rounded-full">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        </div>
      )}
    </AuthLayout>
  );
}
