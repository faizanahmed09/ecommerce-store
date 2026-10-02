import { ProductListing } from "@/src/app/components/product-listing";
import { NEW_ARRIVAL_MONTHS } from "@/src/app/lib/products";
import { pageMetadata } from "@/src/app/lib/seo";

export const metadata = pageMetadata({
  title: "New Arrivals - Latest Eastern Wear Collection | HAANI Threads",
  description:
    "The newest embroidered dresses, stitched and unstitched suits, kurtis and pret wear at HAANI Threads. Fresh Pakistani eastern wear designs, delivered across Pakistan.",
  path: "/new-arrivals",
});

/*
 * "Newest first" is an ordering, not a filter, so this page
 * used to list the entire catalogue - the oldest product in
 * the shop was a new arrival, it was simply last. A product
 * is new here if it was added in the last NEW_ARRIVAL_MONTHS.
 */

export default async function NewArrivalsPage() {
  return (
    <ProductListing
      title="New Arrivals"
      crumbLabel="New In"
      description={`Everything added in the last ${NEW_ARRIVAL_MONTHS} months, newest first. Narrow by price and product options, or sort to find what you need faster.`}
      defaultSort="newest"
      newWithinMonths={NEW_ARRIVAL_MONTHS}
    />
  );
}
