import { AuthForm, AuthLayout } from "@/src/app/components/auth-form";
import { Suspense } from "react";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  title: "Create Account | HAANI Threads",
  description: "Create a HAANI Threads account to track orders and save your wishlist.",
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<AuthFormSkeleton />}>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthLayout>
  );
}

function AuthFormSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-9 w-56 animate-pulse rounded bg-muted" />
      <div className="h-11 w-full animate-pulse rounded bg-muted" />
      <div className="h-11 w-full animate-pulse rounded bg-muted" />
      <div className="h-11 w-full animate-pulse rounded bg-muted" />
      <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
    </div>
  );
}
