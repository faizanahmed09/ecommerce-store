import { ProductListing } from "@/src/app/components/product-listing";
import { SaleCategories } from "@/src/app/components/sale-categories";
import { SaleCoupons } from "@/src/app/components/sale-coupons";
import { Container } from "@/src/app/components/ui/container";
import { pageMetadata } from "@/src/app/lib/seo";

export const metadata = pageMetadata({
  title: "Sale - Embroidered & Stitched Suits Up to 50% Off | HAANI Threads",
  description:
    "Shop the HAANI Threads sale: embroidered dresses, stitched 3-piece suits, lawn and kurtis at up to 50% off. Pakistani eastern wear with cash on delivery nationwide.",
  path: "/sale",
});

export default async function SalePage() {
  return (
    <>
      <Container className="py-8">
        <div className="mt-12">
          <h2 className="mb-8 text-center text-3xl font-bold">Shop Sale by Category</h2>

          <SaleCategories />
        </div>
      </Container>

      {/*
        Between the departments and the grid: a shopper reaches
        it having decided to browse, and it is the last thing
        read before prices start appearing. Above the fold it
        was a promo bar with no page behind it yet.
      */}
      <SaleCoupons />

      {/*
        The same listing every other product page renders, with
        the sale filter fixed on. It used to be a bare grid with
        no filters and no toolbar, which left the one page where
        narrowing matters most as the only one that could not.

        The banner's "Shop now" jumps to #sale-products, so the
        anchor stays where the grid is.
      */}
      <ProductListing
        id="sale-products"
        title="All sale products"
        headingAs="h2"
        showBreadcrumb={false}
        description="Every reduced line across the store, biggest discounts first. Narrow by price and product options, or sort to find what you need faster."
        sale
        defaultSort="discount-desc"
      />
    </>
  );
}
