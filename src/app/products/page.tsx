import { ProductListing } from "@/src/app/components/product-listing";
import { SearchHeading } from "@/src/app/components/search-heading";
import { pageMetadata } from "@/src/app/lib/seo";

export const metadata = pageMetadata({
  title: "All Eastern Wear - Stitched & Embroidered Suits | HAANI Threads",
  description:
    "Browse all HAANI Threads eastern wear for women: embroidered dresses, stitched 3-piece suits, unstitched lawn and kurtis. Cash on delivery across Pakistan.",
  path: "/products",
});

/*
 * Static, deliberately.
 *
 * This route used to read ?q= on the server to word its own
 * heading. That single read made it impossible to prerender, so
 * the whole catalogue sat behind a function call and every
 * visitor waited on it before seeing a product.
 *
 * The grid reads ?q= itself now, and SearchHeading says what
 * was searched for. The page is a static shell served from the
 * edge with the unfiltered first page already in it.
 */
export default function ProductsPage() {
  return (
    <ProductListing
      title="All products"
      description="Browse the full catalogue. Narrow it down by price and product options, or sort to find what you need faster."
      crumbLabel="Products"
      headerExtra={<SearchHeading />}
    />
  );
}
