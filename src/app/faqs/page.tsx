import { JsonLd } from "@/src/app/components/json-ld";
import { Button } from "@/src/app/components/ui/button";
import { Container } from "@/src/app/components/ui/container";
import { FAQ_GROUPS } from "@/src/app/lib/faqs";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata } from "@/src/app/lib/seo";
import { mailtoHref, STORE_EMAIL, whatsappHref } from "@/src/app/lib/store-contact";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";

export const metadata = pageMetadata({
  title: "FAQs - Orders, Delivery, Exchanges & Sizing | Lamees",
  description:
    "Answers to common questions about shopping at Lamees: cash on delivery, delivery charges and times, exchanges, stitched vs unstitched suits and sizing.",
  path: "/faqs",
});

const ENQUIRY = "Hi! I have a question that is not on the Lamees FAQ page.";

/*
 * ---------------------------------------------------------
 * FAQS
 * ---------------------------------------------------------
 *
 * The footer has linked here since before the page existed.
 *
 * Each answer is a native <details>, not the Radix accordion in
 * components/ui: Radix unmounts a closed panel, which leaves the
 * answers out of the HTML that search engines read. <details>
 * keeps every answer in the page, opens without JavaScript, and
 * is announced correctly by screen readers.
 */

export default function FaqsPage() {
  return (
    <Container className="py-12 lg:py-16">
      <JsonLd
        data={[
          faqJsonLd(FAQ_GROUPS.flatMap((group) => group.items)),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "FAQs", path: "/faqs" },
          ]),
        ]}
      />

      <header className="mb-12 max-w-2xl">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground">FAQs</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h1>

        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Everything you need to know about ordering, delivery, exchanges and choosing the right
          size. Can&apos;t find your answer? Message us and we will help.
        </p>

        {/* Jump links, so a long page is still quick to scan. */}
        <ul className="mt-6 flex flex-wrap gap-2">
          {FAQ_GROUPS.map((group) => (
            <li key={group.id}>
              <a
                href={`#${group.id}`}
                className="inline-flex rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-foreground/30 hover:bg-muted"
              >
                {group.title}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-16">
        <div className="max-w-2xl space-y-12">
          {FAQ_GROUPS.map((group) => (
            <section key={group.id} id={group.id} className="scroll-mt-24">
              <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>

              <div className="mt-4 divide-y rounded-2xl border">
                {group.items.map((faq) => (
                  <details key={faq.question} className="group px-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-medium [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <ChevronDown
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                      />
                    </summary>

                    <p className="pb-5 text-sm leading-7 text-muted-foreground">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border p-6">
            <h2 className="text-base font-semibold tracking-tight">Still have a question?</h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              WhatsApp is the quickest way to reach us - we usually reply the same day.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Button asChild className="w-full rounded-full">
                <a href={whatsappHref(ENQUIRY)} target="_blank" rel="noopener noreferrer">
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
              Full details are in our{" "}
              <Link href="/shipping" className="underline underline-offset-4 hover:text-foreground">
                Shipping Policy
              </Link>{" "}
              and{" "}
              <Link href="/returns" className="underline underline-offset-4 hover:text-foreground">
                Returns &amp; Exchanges
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </Container>
  );
}
