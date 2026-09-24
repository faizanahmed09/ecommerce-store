import { Button } from "@/src/app/components/ui/button";
import { Container } from "@/src/app/components/ui/container";
import { FREE_SHIPPING_LABEL } from "@/src/app/lib/order-totals";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/*
 * Editorial hero. The copy is evergreen rather than tied to a
 * fixed campaign date, so it doesn't go stale on the shelf.
 */

const HERO_IMAGE = "/main_img.jpeg";

const highlights = [
  { value: "Free", label: `Shipping over ${FREE_SHIPPING_LABEL}` },
  { value: "30-day", label: "Easy returns" },
  { value: "100%", label: "Authentic products" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-neutral-950 text-white">
      {/* Soft light bloom behind the copy */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-brand/20 blur-3xl"
      />

      <Container className="relative">
        <div className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          {/* Copy */}
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              New season, now live
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Pakistani eastern wear,
              <br />
              <span className="font-light italic text-white/70">beautifully embroidered.</span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-7 text-white/60">
              Embroidered dresses, stitched and unstitched 3-piece suits, lawn and kurtis - eastern
              wear in considered fabrics, at honest prices, delivered across Pakistan.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="group h-12 rounded-full bg-white px-7 text-neutral-950 hover:bg-white/90"
              >
                <Link href="/products">
                  Shop the collection
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/25 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/sale">View offers</Link>
              </Button>
            </div>

            {/* Trust strip */}
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-7">
              {highlights.map((item) => (
                <div key={item.label}>
                  <dt className="text-lg font-semibold tracking-tight">{item.value}</dt>
                  <dd className="mt-1 text-xs leading-5 text-white/50">{item.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Image */}
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-white/5">
              <Image
                src={HERO_IMAGE}
                alt="Lamees embroidered stitched suit - Pakistani eastern wear"
                fill
                preload
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />

              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-neutral-950/60 via-transparent to-transparent"
              />
            </div>

            {/* Floating price card */}
            <div className="absolute -bottom-5 left-5 rounded-xl border border-white/10 bg-neutral-900/90 px-5 py-3.5 shadow-xl backdrop-blur sm:left-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Starting from
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">Rs. 3500</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
