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
  Shirt,
  Sparkles,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const metadata = pageMetadata({
  title: "About Us - Pakistani Eastern Wear for Women | Lamees",
  description:
    "Lamees is a women's eastern wear label from Lahore, making embroidered dresses and stitched and unstitched suits, delivered across Pakistan with cash on delivery.",
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
    title: "Embroidered dresses",
    detail:
      "Threadwork, chikankari and embellished pieces for Eid, weddings, dawats and every celebration in between.",
  },
  {
    icon: Scissors,
    title: "Stitched & unstitched suits",
    detail:
      "Ready to wear 2 and 3-piece suits when you want to wear it tomorrow, and unstitched fabric when you want it tailored your way.",
  },
  {
    icon: Shirt,
    title: "Everyday pret & kurtis",
    detail:
      "Easy lawn and cotton pieces for work, college and home - comfortable, considered and made to be worn often.",
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
              Eastern wear, made for the women who wear it
            </h1>

            <div className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
              <p>
                Lamees (لمیس) is a women&apos;s eastern wear label from Lahore. We make embroidered
                dresses, stitched and unstitched suits and everyday kurtis that feel as good to wear
                as they look.
              </p>

              <p>
                We believe a beautiful suit should not be kept only for special occasions - or cost
                a fortune. So we focus on considered fabrics, careful embroidery and honest prices,
                and we deliver straight to your door anywhere in Pakistan.
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
              src="/lamees-logo.jpg"
              alt="Lamees logo in Urdu calligraphy"
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
        <h2 className="text-2xl font-semibold tracking-tight">Why shop with Lamees</h2>

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
