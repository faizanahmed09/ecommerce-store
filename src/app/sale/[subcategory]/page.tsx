import { buildCategoryMetadata, CategoryListing } from "@/src/app/components/category-listing";

/* Next 15 delivers route props as promises. */
type PageProps = {
  params: Promise<{ subcategory: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { subcategory } = await params;

  return buildCategoryMetadata(subcategory, { parentSlug: "sale" });
}

export default async function SaleSubcategoryPage({ params }: PageProps) {
  const { subcategory } = await params;

  return (
    <CategoryListing
      slug={subcategory}
      parentSlug="sale"
      parent={{ name: "Sale", href: "/sale" }}
      sale
    />
  );
}
