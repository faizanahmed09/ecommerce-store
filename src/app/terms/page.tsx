import { LegalPage } from "@/src/app/components/legal-page";
import { TERMS_OF_SERVICE } from "@/src/app/lib/legal";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you order from HAANI Threads.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return <LegalPage document={TERMS_OF_SERVICE} />;
}
