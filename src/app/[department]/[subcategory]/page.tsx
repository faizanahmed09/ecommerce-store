import { getCategoriesBySlugs } from "@/src/app/lib/catalogue";
import { buildCategoryMetadata, CategoryListing } from "@/src/app/components/category-listing";
import {} from "@/src/app/lib/categories";
import { RESERVED_SLUGS } from "@/src/app/lib/departments";
import { notFound } from "next/navigation";

/*
 * ---------------------------------------------------------
 * SUBCATEGORY LISTING
 * ---------------------------------------------------------
 *
 * /men/t-shirts, /women/dresses, and every other department's
 * children - previously six near-identical route files.
 *
 * CategoryListing resolves the child slug itself: the URL says
 * /men/t-shirts while the row is "men-t-shirts", and it tries
 * the parent-prefixed form first.
 */

type PageProps = {
  params: Promise<{ department: string; subcategory: string }>;
};

/* The parent's display name, for the breadcrumb. */
async function getParentName(slug: string): Promise<string | null> {
  if (RESERVED_SLUGS.has(slug)) {
    return null;
  }

  const rows = await getCategoriesBySlugs([slug]);
  const category = rows[0];

  return category && !category.parent_id ? category.name : null;
}

export async function generateMetadata({ params }: PageProps) {
  const { department, subcategory } = await params;

  return buildCategoryMetadata(subcategory, { parentSlug: department });
}

export default async function SubcategoryRoute({ params }: PageProps) {
  const { department, subcategory } = await params;

  const parentName = await getParentName(department);

  /* No such department means no such page beneath it. */
  if (!parentName) {
    notFound();
  }

  return (
    <CategoryListing
      slug={subcategory}
      parentSlug={department}
      parent={{ name: parentName, href: `/${department}` }}
    />
  );
}
