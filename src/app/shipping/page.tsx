import { LegalPage } from "@/src/app/components/legal-page";
import { SHIPPING_POLICY } from "@/src/app/lib/legal";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  title: "Shipping Policy",
  description: "Delivery charges, timings and coverage for Lamees orders.",
  alternates: { canonical: "/shipping" },
};

export default function Page() {
  return <LegalPage document={SHIPPING_POLICY} />;
}
