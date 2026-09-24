import { Button } from "@/src/app/components/ui/button";
import { PolicySections } from "@/src/app/components/policy-sections";
import { Container } from "@/src/app/components/ui/container";
import {
  DEFECT_REPORT_HOURS,
  EXCHANGE_WINDOW_DAYS,
  POLICY_SECTIONS,
} from "@/src/app/lib/returns-policy";
import { mailtoHref, STORE_EMAIL, whatsappHref } from "@/src/app/lib/store-contact";
import { BadgeCheck, CalendarClock, Mail, MessageCircle, Ticket } from "lucide-react";
import Link from "next/link";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  title: "Returns & Exchanges | Lamees",
  description:
    "How to exchange something you bought from Lamees: the window, the condition we can accept items in, and how to start.",
  alternates: { canonical: "/returns" },
};

/*
 * ---------------------------------------------------------
 * RETURNS & EXCHANGES
 * ---------------------------------------------------------
 *
 * The header has linked here since before the page existed, so
 * "Returns & Exchanges" in the top bar was a 404.
 *
 * The wording lives in lib/returns-policy so the terms can be
 * changed without touching this layout - and so the numbers
 * quoted in the summary below cannot drift out of step with the
 * ones in the policy text, which is exactly how a policy page
 * ends up contradicting itself.
 */

const EXCHANGE_ENQUIRY = "Hi! I'd like to exchange something from my Lamees order.";

const SUMMARY = [
  {
    icon: CalendarClock,
    title: `${EXCHANGE_WINDOW_DAYS} days`,
    detail: "to request an exchange from the day your order arrives.",
  },
  {
    icon: Ticket,
    title: "Store credit",
    detail: "issued for returns — we do not refund to cash.",
  },
  {
    icon: BadgeCheck,
    title: "Unworn, tagged",
    detail: "in original packaging, with your invoice or order number.",
  },
];

export default function ReturnsPage() {
  return (
    <Container className="py-12 lg:py-16">
      <header className="mb-12 max-w-2xl">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground">Returns & Exchanges</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Returns &amp; Exchanges
        </h1>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          If something is not right, we would rather sort it out than have you keep a piece you will
          not wear. Here is what we can do, and what we need from you to do it.
        </p>
      </header>

      {/* The three things most people are actually looking for. */}
      <div className="mb-14 grid gap-4 sm:grid-cols-3">
        {SUMMARY.map((item) => (
          <div key={item.title} className="rounded-2xl border bg-muted/20 p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-sm">
              <item.icon className="h-4 w-4" />
            </div>

            <p className="text-base font-semibold tracking-tight">{item.title}</p>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-16">
        <PolicySections sections={POLICY_SECTIONS} />

        {/* How to actually start one. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border p-6">
            <h2 className="text-base font-semibold tracking-tight">Start an exchange</h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Message us with your order number and what you would like instead. For a damaged or
              wrong item, attach photographs within {DEFECT_REPORT_HOURS} hours of delivery.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Button asChild className="w-full rounded-full">
                <a href={whatsappHref(EXCHANGE_ENQUIRY)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp us
                </a>
              </Button>

              <Button asChild variant="outline" className="w-full rounded-full">
                <a href={mailtoHref}>
                  <Mail className="mr-2 h-4 w-4" />
                  {STORE_EMAIL}
                </a>
              </Button>
            </div>

            <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">
              Your order number is on your confirmation email, and under{" "}
              <Link href="/account" className="underline underline-offset-4 hover:text-foreground">
                Orders
              </Link>{" "}
              in your account.
            </p>
          </div>
        </aside>
      </div>
    </Container>
  );
}
