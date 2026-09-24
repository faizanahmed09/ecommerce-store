"use client";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import { useAuth } from "@/src/app/context/auth-context";
import { fetchUserProfileByEmail, isAdminProfile } from "@/src/app/lib/users";
import { cn } from "@/src/app/lib/utils";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { safeRedirect } from "@/src/app/lib/safe-redirect";

type Mode = "login" | "signup";

/* Supabase rejects anything shorter than this. */
const MIN_PASSWORD_LENGTH = 8;

const BENEFITS = [
  { icon: Truck, text: "Track every order from checkout to your door" },
  { icon: ShieldCheck, text: "Save addresses for a faster checkout" },
  { icon: Check, text: "Keep a wishlist across all your devices" },
];

/*
 * ---------------------------------------------------------
 * PASSWORD FIELD
 * ---------------------------------------------------------
 */

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
  action,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>

      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
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

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * AUTH FORM
 * ---------------------------------------------------------
 */

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { signIn, signUp, user, loading: authLoading } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isSignup = mode === "signup";

  /*
   * Where to land afterwards. The admin area sends people here
   * with ?redirect=/admin so they return to what they wanted.
   */
  const redirectTo = searchParams.get("redirect");

  const resolveDestination = async (userEmail: string): Promise<string> => {
    /*
     * Validated, not merely prefix-checked: see safe-redirect.ts
     * for why "starts with a slash" is not the same as "on this
     * site".
     */
    const requested = safeRedirect(redirectTo);

    if (requested) {
      return requested;
    }

    /*
     * Admins land in the back office; everyone else in their
     * account. The role lives on users.user_type per schema.sql.
     */
    try {
      const profile = await fetchUserProfileByEmail(userEmail);

      return isAdminProfile(profile) ? "/admin" : "/account";
    } catch {
      return "/account";
    }
  };

  /* Someone already signed in has no business on this page. */
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(safeRedirect(redirectTo) ?? "/account");
    }
  }, [authLoading, user, router, redirectTo]);

  const passwordChecks = useMemo(
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

  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) {
      return;
    }

    setFormError(null);

    if (isSignup) {
      if (passwordChecks.some((check) => !check.passed)) {
        setFormError(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include a letter and a number.`
        );
        return;
      }

      if (!passwordsMatch) {
        setFormError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);

    try {
      if (isSignup) {
        const { error, needsEmailConfirmation } = await signUp(email, password, fullName.trim());

        if (error) {
          setFormError(error.message);
          return;
        }

        if (needsEmailConfirmation) {
          setConfirmationSent(true);
          return;
        }

        toast({
          title: "Welcome to Lamees",
          description: "Your account is ready.",
        });

        router.push(await resolveDestination(email));
        router.refresh();
        return;
      }

      const { error } = await signIn(email, password);

      if (error) {
        /* Supabase returns a deliberately vague message here. */
        setFormError(
          error.message === "Invalid login credentials"
            ? "That email and password combination doesn't match an account."
            : error.message
        );
        return;
      }

      toast({ title: "Welcome back", description: "You are now signed in." });

      router.push(await resolveDestination(email));
      router.refresh();
    } catch (error) {
      console.error(`${mode} error:`, error);
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * Post-signup confirmation screen.
   */
  if (confirmationSent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand-strong">
          <MailCheck className="h-6 w-6" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Click it to activate your
          account, then sign in.
        </p>

        <Button asChild className="mt-8 h-11 w-full rounded-full">
          <Link href="/login">Go to sign in</Link>
        </Button>

        <button
          type="button"
          onClick={() => setConfirmationSent(false)}
          className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Use a different email address
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup
            ? "One account for orders, addresses and your wishlist."
            : "Sign in to pick up where you left off."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {formError}
          </div>
        )}

        {isSignup && (
          <div className="space-y-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              type="text"
              placeholder="Sara Ahmed"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="h-11"
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-11"
            required
          />
        </div>

        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete={isSignup ? "new-password" : "current-password"}
          action={
            isSignup ? undefined : (
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            )
          }
        />

        {/* Live password requirements, signup only */}
        {isSignup && password.length > 0 && (
          <ul className="space-y-1.5">
            {passwordChecks.map((check) => (
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

        {isSignup && (
          <PasswordInput
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            hint={confirmPassword && !passwordsMatch ? "Passwords do not match." : undefined}
          />
        )}

        <Button type="submit" disabled={submitting} className="group h-11 w-full rounded-full">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isSignup ? "Creating account..." : "Signing in..."}
            </>
          ) : (
            <>
              {isSignup ? "Create account" : "Sign in"}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {isSignup ? "Already have an account?" : "New to Lamees?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * PAGE SHELL
 * ---------------------------------------------------------
 *
 * Split layout: brand panel on the left from lg up, form on
 * the right. On smaller screens only the form shows.
 */

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-neutral-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/3 h-[420px] w-[420px] rounded-full bg-brand/20 blur-3xl"
        />

        <Link href="/" className="relative text-lg font-semibold tracking-[0.2em] text-white">
          LAMEES
        </Link>

        <div className="relative max-w-sm">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Your wardrobe,
            <br />
            <span className="font-light italic text-white/60">always within reach.</span>
          </h2>

          <ul className="mt-9 space-y-4">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;

              return (
                <li key={benefit.text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                    <Icon className="h-3.5 w-3.5" />
                  </span>

                  <span className="text-sm leading-6 text-white/60">{benefit.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-white/30">&copy; Lamees. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-14 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
