import { JsonLd } from "@/src/app/components/json-ld";
import { Button } from "@/src/app/components/ui/button";
import { Container } from "@/src/app/components/ui/container";
import { FREE_SHIPPING_LABEL } from "@/src/app/lib/order-totals";
import { EXCHANGE_WINDOW_DAYS } from "@/src/app/lib/returns-policy";
import { breadcrumbJsonLd, pageMetadata } from "@/src/app/lib/seo";
import { STORE_ADDRESS } from "@/src/app/lib/store-contact";
import {
  HandCoins,
  MessageCircle,
  RefreshCw,
  Scissors,
  Sparkles,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const metadata = pageMetadata({
  title: "About HAANI Threads | Unstitched Fabrics",
  description:
    "Discover HAANI Threads and its unstitched fabric collections for summer and winter, delivered across Pakistan.",
  path: "/about",
});

/*
 * ---------------------------------------------------------
 * ABOUT US
 * ---------------------------------------------------------
 *
 * The footer has linked here since before the page existed.
 *
 * Every promise on this page is one the shop already keeps
 * somewhere else in the code - cash on delivery at checkout,
 * the delivery threshold in order-totals, the exchange window
 * in returns-policy - and quotes those constants rather than
 * restating them, so the story cannot drift from the terms.
 *
 * The brand story itself is deliberately general. Add the
 * founding year, the people behind the label and anything
 * else true and specific - that is what makes an About page
 * worth reading - but do not invent any of it.
 */

const COLLECTIONS = [
  {
    icon: Sparkles,
    title: "Summer Unstitched",
    detail:
      "Expressive prints and embroidery for lighter days, ready to tailor to your own style.",
  },
  {
    icon: Scissors,
    title: "Winter Unstitched",
    detail:
      "Seasonal fabrics and considered textures for the cooler months.",
  },
  {
    icon: Sparkles,
    title: "Made your way",
    detail:
      "Select a fabric you love and have it made into a look that feels entirely yours.",
  },
];

const PROMISES = [
  {
    icon: HandCoins,
    title: "Cash on delivery",
    detail: "Pay when your parcel arrives - no card or advance payment needed.",
  },
  {
    icon: Truck,
    title: "Delivery across Pakistan",
    detail: `To your doorstep in any city, and free on orders over ${FREE_SHIPPING_LABEL}.`,
  },
  {
    icon: RefreshCw,
    title: `${EXCHANGE_WINDOW_DAYS}-day exchanges`,
    detail: "Wrong size? Exchange unworn pieces within the window, no fuss.",
  },
  {
    icon: MessageCircle,
    title: "Real people on WhatsApp",
    detail: "Ask about fabric, fit or your order and talk to our team directly.",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "About Us", path: "/about" },
        ])}
      />

      {/* Story */}
      <Container className="py-12 lg:py-16">
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground">About Us</li>
          </ol>
        </nav>

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Fabric made for your own story
            </h1>

            <div className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
              <p>
                HAANI Threads brings together unstitched fabrics for the seasons and moments that
                matter. Pick the pieces that feel like you, then have them tailored your way.
              </p>

              <p>
                Our edit is rooted in expressive prints, thoughtful embroidery and the freedom to
                make each look your own. We deliver across Pakistan.
              </p>

              <p>
                Every order is cash on delivery, and our team is a WhatsApp message away if you need
                help choosing a size, a fabric or the right piece for an event.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full px-7">
                <Link href="/products">Shop the collection</Link>
              </Button>

              <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                <Link href="/contact">Contact us</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black lg:max-w-none">
            <Image
              src="/haani-fabrics-hero.png"
              alt="Embroidered unstitched fabric and floral dupatta"
              fill
              sizes="(min-width: 1024px) 420px, 384px"
              className="object-cover"
            />
          </div>
        </div>
      </Container>

      {/* What we make */}
      <section className="border-y bg-muted/20">
        <Container className="py-12 lg:py-16">
          <h2 className="text-2xl font-semibold tracking-tight">What we make</h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {COLLECTIONS.map((item) => (
              <div key={item.title} className="rounded-2xl border bg-background p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <h3 className="font-semibold tracking-tight">{item.title}</h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Promises */}
      <Container className="py-12 lg:py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Why shop with HAANI Threads</h2>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map((item) => (
            <div key={item.title}>
              <item.icon className="h-5 w-5" aria-hidden="true" />

              <h3 className="mt-3 font-semibold tracking-tight">{item.title}</h3>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Have a question first?</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Our FAQs cover delivery, exchanges and sizing. We are based at {STORE_ADDRESS}.
            </p>
          </div>

          <Button asChild variant="outline" className="mt-4 shrink-0 rounded-full sm:mt-0">
            <Link href="/faqs">Read the FAQs</Link>
          </Button>
        </div>
      </Container>
    </>
  );
}
