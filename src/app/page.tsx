import { CategoryShowcase } from "@/src/app/components/category-showcase";
import { CouponModal } from "@/src/app/components/coupon-modal";
import { FeaturedPicks } from "@/src/app/components/featured-picks";
import { FeaturedProducts } from "@/src/app/components/featured-products";
import { HeroSection } from "@/src/app/components/hero-section";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageMetadata } from "@/src/app/lib/seo";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = pageMetadata({
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  path: "/",
});

/*
 * Nothing on this page is read on the server any more - the
 * categories come from the shared store and the products from
 * the client - so there is nothing here to revalidate.
 */

export default function Home() {
  return (
    <>
      {/*
        Renders nothing until it has a promoted code and has
        checked it has not already been dismissed, so it costs
        the page no layout either way.
      */}
      <CouponModal />

      {/*
        Each section carries its own spacing and hides itself
        when it has nothing to show, so an empty catalogue
        leaves no blank bands behind.
      */}
      <HeroSection />
      <CategoryShowcase />
      <FeaturedProducts />
      <FeaturedPicks />

      {/*
        The newsletter sign-up lives in the footer on every
        page, so the homepage no longer repeats it.
      */}
    </>
  );
}
