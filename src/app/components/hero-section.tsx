import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[640px] w-full items-end overflow-hidden bg-[#302b27] text-white sm:min-h-[700px] lg:min-h-[780px]">
      <Image
        src="/haani-fabrics-hero.png"
        alt="Folded embroidered unstitched fabric with a floral dupatta"
        fill
        preload
        sizes="100vw"
        className="object-cover object-[72%_center] sm:object-center"
      />
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/55 to-transparent" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 sm:bg-gradient-to-r sm:from-black/75 sm:via-black/45 sm:to-black/10" aria-hidden="true" />
      <div className="relative z-10 w-full px-6 pb-12 pt-28 sm:px-10 sm:pb-16 lg:px-16 lg:pb-20">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/80">
            HAANI Threads / Unstitched edit
          </p>
          <h1 className="mt-6 font-serif text-5xl font-normal leading-[1.03] tracking-[-0.04em] sm:text-6xl xl:text-7xl">
            A season to
            <br />
            make your own.
          </h1>
          <p className="mt-6 max-w-md text-base leading-8 text-white/90">
            Discover unstitched fabrics for summer days and winter moments. Choose the pieces
            that speak to you, then wear them your way.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/summer-unstitched"
              className="group inline-flex min-h-12 items-center gap-3 bg-white px-6 text-xs font-semibold uppercase tracking-[0.14em] text-[#302b27] transition-colors hover:bg-[#f3ece2]"
            >
              Summer Unstitched
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/winter-unstitched"
              className="inline-flex min-h-12 items-center border border-white/70 px-6 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/10"
            >
              Winter Unstitched
            </Link>
          </div>
          <p className="mt-10 text-xs uppercase tracking-[0.18em] text-white/75">
            Fabrics to shape your story
          </p>
        </div>
      </div>
    </section>
  );
}
