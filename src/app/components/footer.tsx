import type { LucideIcon } from "lucide-react";
import { FooterShopLinks } from "@/src/app/components/footer-shop-links";
import {
  mailtoHref,
  SOCIAL_PROFILES,
  STORE_ADDRESS_LINES,
  STORE_EMAIL,
  STORE_PHONE,
  telHref,
} from "@/src/app/lib/store-contact";
import { Button } from "@/src/app/components/ui/button";
import {
  ArrowUpRight,
  Code2,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const DEVELOPER_URL = "https://abdullahdev.website/";

const quickLinks = [
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Returns & Exchanges", href: "/returns" },
  { label: "FAQs", href: "/faqs" },
];

/* Label -> icon, so store-contact can stay free of components. */
const SOCIAL_ICONS: Record<string, LucideIcon> = {
  Facebook,
  Instagram,
  TikTok: Youtube,
  YouTube: Youtube,
  Twitter,
};

/* The year is read in a cached server scope and handed down; see lib/current-year.ts. */
export default function Footer({ year }: { year: number }) {
  return (
    <footer className="border-t bg-background">
      {/* Newsletter / CTA */}
      <div className="border-b bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Stay in the loop
              </span>

              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Get the latest from Lamees.
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
                Be the first to discover new collections, exclusive offers, and fashion inspiration.
              </p>
            </div>

            <form className="flex w-full max-w-md gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  type="email"
                  placeholder="Your email address"
                  aria-label="Email address"
                  className="h-11 w-full rounded-md border bg-background pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground"
                />
              </div>

              <Button type="submit" className="h-11 px-5">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        {/*
         * Phones and tablets: brand and contact take a full row
         * each, with Company and Shop side by side between them.
         * Desktop: all four in one row.
         */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr] lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-3 text-2xl font-bold tracking-tight transition-opacity hover:opacity-70"
            >
              <Image
                src="/lamees-logo.jpg"
                alt="Lamees logo"
                width={48}
                height={48}
                className="h-12 w-12 rounded-md"
              />
              LAMEES
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
              Pakistani eastern wear from Lahore - embroidered dresses, stitched and unstitched
              suits, and kurtis for women, delivered across Pakistan with cash on delivery.
            </p>

            {/* Socials */}
            <div className="mt-7 flex items-center gap-2">
              {SOCIAL_PROFILES.map(({ label, href }) => {
                const Icon = SOCIAL_ICONS[label] ?? Instagram;

                return (
                  <Button
                    key={label}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full transition-all hover:-translate-y-0.5 hover:bg-foreground hover:text-background"
                    asChild
                  >
                    <Link href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
                      <Icon className="h-4 w-4" />
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold">Company</h3>

            <ul className="mt-5 space-y-3">
              {quickLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                    <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold">Shop</h3>

            <FooterShopLinks />
          </div>

          {/* Contact */}
          <div className="col-span-2 lg:col-span-1">
            <h3 className="text-sm font-semibold">Get in touch</h3>

            <ul className="mt-5 space-y-5">
              <li className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/50">
                  <MapPin className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Visit us
                  </p>
                  <p className="mt-1 text-sm leading-5">
                    {STORE_ADDRESS_LINES.map((line, index) => (
                      <span key={line}>
                        {index > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </p>
                </div>
              </li>

              <li className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/50">
                  <Phone className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Call us
                  </p>
                  <a
                    href={telHref}
                    className="mt-1 block text-sm transition-colors hover:text-muted-foreground"
                  >
                    {STORE_PHONE}
                  </a>
                </div>
              </li>

              <li className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted/50">
                  <Mail className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Email us
                  </p>
                  <a
                    href={mailtoHref}
                    className="mt-1 block text-sm transition-colors hover:text-muted-foreground"
                  >
                    {STORE_EMAIL}
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Developer Credit */}
        <div className="mt-14 rounded-lg border bg-muted/40 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background">
                <Code2 className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-medium">Website designed &amp; developed by Abdullah</p>
                <p className="text-xs text-muted-foreground">
                  Need a site like this? Let&apos;s build something together.
                </p>
              </div>
            </div>

            <Button variant="outline" size="sm" className="group w-full sm:w-auto" asChild>
              <a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer">
                Contact developer
                <ArrowUpRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-7 border-t pt-7">
          <div className="flex flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {year} Lamees. All rights reserved.</p>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Privacy
              </Link>

              <Link href="/terms" className="transition-colors hover:text-foreground">
                Terms
              </Link>

              <Link href="/returns" className="transition-colors hover:text-foreground">
                Returns
              </Link>

              <Link href="/shipping" className="transition-colors hover:text-foreground">
                Shipping
              </Link>

              <a
                href={DEVELOPER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                Developer
              </a>

              <span className="hidden h-3 w-px bg-border sm:block" />

              <span>Pakistan</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
