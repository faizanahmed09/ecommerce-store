import { getCategoriesBySlugs, getCategoryChildren } from "@/src/app/lib/catalogue";
import { CollectionSubcategories } from "@/src/app/components/collection-subcategories";
import { ProductListing } from "@/src/app/components/product-listing";
import type { CategoryRecord } from "@/src/app/lib/categories";
import { RESERVED_SLUGS } from "@/src/app/lib/departments";
import { childSegment } from "@/src/app/lib/navigation";
import { pageMetadata } from "@/src/app/lib/seo";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ department: string; subcategory: string }>;
};

async function getCollection(department: string, subcategory: string): Promise<{
  parent: CategoryRecord;
  child: CategoryRecord;
  children: CategoryRecord[];
} | null> {
  if (RESERVED_SLUGS.has(department)) return null;

  const parent = (await getCategoriesBySlugs([department])).find(
    (category) => category.slug === department && !category.parent_id
  );
  if (!parent) return null;

  const children = await getCategoryChildren(department);
  const child = children.find(
    (category) => childSegment(category.slug, department) === subcategory
  );
  return child ? { parent, child, children } : null;
}

function collectionTitle(parent: CategoryRecord, child: CategoryRecord): string {
  return /\bunstitched\b/i.test(parent.name) && !/\bunstitched\b/i.test(child.name)
    ? `${child.name} Unstitched`
    : child.name;
}

export async function generateMetadata({ params }: PageProps) {
  const { department, subcategory } = await params;
  const collection = await getCollection(department, subcategory);
  if (!collection) return {};

  const { parent, child } = collection;
  const title = collectionTitle(parent, child);
  return pageMetadata({
    title: `${title} | HAANI Threads`,
    description: child.description || `Shop ${title.toLowerCase()} at HAANI Threads.`,
    path: `/${department}/${subcategory}`,
    ...(child.image_url ? { images: [child.image_url] } : {}),
  });
}

export default async function SubcategoryRoute({ params }: PageProps) {
  const { department, subcategory } = await params;
  const collection = await getCollection(department, subcategory);
  if (!collection) notFound();

  const { parent, child, children } = collection;
  return (
    <ProductListing
      title={collectionTitle(parent, child)}
      crumbLabel={child.name}
      description={child.description ?? undefined}
      crumbs={[{ name: parent.name, href: `/${parent.slug}` }]}
      collectionStyle
      headerExtra={<CollectionSubcategories parent={parent} categories={children} activeId={child.id} />}
      categorySlug={child.slug}
      filterCategoryId={child.id}
      showPieceFilter={/\bunstitched\b/i.test(parent.name)}
    />
  );
}
