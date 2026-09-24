import { AuthForm, AuthLayout } from "@/src/app/components/auth-form";
import { Suspense } from "react";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  title: "Sign In | Lamees",
  description: "Sign in to your Lamees account.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthLayout>
      {/* AuthForm reads ?redirect= from the URL. */}
      <Suspense fallback={<AuthFormSkeleton />}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthLayout>
  );
}

function AuthFormSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-9 w-48 animate-pulse rounded bg-muted" />
      <div className="h-11 w-full animate-pulse rounded bg-muted" />
      <div className="h-11 w-full animate-pulse rounded bg-muted" />
      <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
    </div>
  );
}
