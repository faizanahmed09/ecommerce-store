import { LegalPage } from "@/src/app/components/legal-page";
import { PRIVACY_POLICY } from "@/src/app/lib/legal";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  title: "Privacy Policy",
  description: "How HAANI Threads handles your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return <LegalPage document={PRIVACY_POLICY} />;
}
