import { Button } from "@/src/app/components/ui/button";
import { Container } from "@/src/app/components/ui/container";
import {
  mailtoHref,
  STORE_ADDRESS,
  STORE_EMAIL,
  STORE_HOURS,
  STORE_PHONE,
  telHref,
  whatsappHref,
} from "@/src/app/lib/store-contact";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  title: "Contact Us | Lamees",
  description:
    "Reach the Lamees team on WhatsApp, by phone or by email — we usually reply the same day.",
  alternates: { canonical: "/contact" },
};

const ENQUIRY = "Hi! I have a question about Lamees.";

/*
 * ---------------------------------------------------------
 * CONTACT
 * ---------------------------------------------------------
 *
 * Every route on this page is one a customer can actually
 * complete: a WhatsApp chat, a dialable number, a mail client.
 *
 * There is deliberately no message form. A form needs somewhere
 * to deliver to, and an unwired one that thanks you for getting
 * in touch is worse than no form at all - the customer believes
 * they have been heard and nobody has heard them.
 */

const CHANNELS = [
  {
    icon: Phone,
    label: "Phone",
    value: STORE_PHONE,
    href: telHref,
    detail: "Call us during business hours.",
    external: false,
  },
  {
    icon: Mail,
    label: "Email",
    value: STORE_EMAIL,
    href: mailtoHref,
    detail: "Best for order queries and returns.",
    external: false,
  },
];

export default function ContactPage() {
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
            <li className="font-medium text-foreground">Contact</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Get in touch</h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          Questions about an order, a size, or a return? WhatsApp is the fastest way to reach us —
          we usually reply the same day.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-12">
        <div className="space-y-4">
          {/* WhatsApp leads, because it is what most customers use. */}
          <a
            href={whatsappHref(ENQUIRY)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-xl border bg-card p-6 transition-colors hover:border-[#25D366]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </span>

            <span className="min-w-0">
              <span className="block font-semibold">WhatsApp</span>

              <span className="mt-0.5 block text-sm text-muted-foreground">
                Chat with us now — order updates, sizing, anything.
              </span>

              <span className="mt-3 inline-block text-sm font-medium text-[#25D366] group-hover:underline">
                Open WhatsApp
              </span>
            </span>
          </a>

          {CHANNELS.map((channel) => {
            const Icon = channel.icon;

            return (
              <a
                key={channel.label}
                href={channel.href}
                className="group flex items-start gap-4 rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>

                <span className="min-w-0">
                  <span className="block font-semibold">{channel.label}</span>

                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {channel.detail}
                  </span>

                  <span className="mt-3 block break-words text-sm font-medium group-hover:underline">
                    {channel.value}
                  </span>
                </span>
              </a>
            );
          })}
        </div>

        <aside className="space-y-6 rounded-xl border bg-muted/30 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Opening hours
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">{STORE_HOURS}</p>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Where we are
            </h2>

            <address className="mt-2 text-sm not-italic text-muted-foreground">
              {STORE_ADDRESS}
            </address>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-sm font-semibold">Already ordered?</h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Your order status and tracking number are on your account page.
            </p>

            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/account">View my orders</Link>
            </Button>
          </div>
        </aside>
      </div>
    </Container>
  );
}
