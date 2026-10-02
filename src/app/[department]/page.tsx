import {
  getCategoriesBySlugs,
  getCategoryChildren,
  getRootCategories,
} from "@/src/app/lib/catalogue";
import { CollectionSubcategories } from "@/src/app/components/collection-subcategories";
import { ProductListing } from "@/src/app/components/product-listing";
import { JsonLd } from "@/src/app/components/json-ld";
import { type CategoryRecord } from "@/src/app/lib/categories";
import { buildDepartment, RESERVED_SLUGS } from "@/src/app/lib/departments";
import { notFound } from "next/navigation";
import { breadcrumbJsonLd, pageMetadata } from "@/src/app/lib/seo";

/*
 * ---------------------------------------------------------
 * DEPARTMENT LANDING PAGE
 * ---------------------------------------------------------
 *
 * /men, /women, /kids, /footwear, /fragrance, /winter-wear -
 * and whatever top-level category an admin creates next. Each
 * used to be its own directory, which is how the route
 * `/fragnance` came to disagree with the slug `fragrance`.
 * Here the URL segment IS the slug, so the two cannot drift.
 */

type PageProps = {
  /* Next 15 delivers route props as promises. */
  params: Promise<{ department: string }>;
};

/*
 * Prerender the departments that exist at build time. Anything
 * created afterwards still renders on demand - dynamicParams
 * defaults to true - so a new department is live without a
 * deploy.
 */
export async function generateStaticParams() {
  try {
    const roots = await getRootCategories();

    return roots
      .filter((category) => !RESERVED_SLUGS.has(category.slug))
      .map((category) => ({ department: category.slug }));
  } catch (error) {
    /* A build without a database still has to produce a site. */
    console.error("Could not enumerate departments:", error);
    return [];
  }
}

/*
 * A department is a category with no parent. A child slug, an
 * unknown slug, or one shadowed by a static route is a 404 -
 * without this an arbitrary URL would render an empty page
 * that looks like a real department.
 */
async function getDepartmentCategory(slug: string): Promise<CategoryRecord | null> {
  if (RESERVED_SLUGS.has(slug)) {
    return null;
  }

  const rows = await getCategoriesBySlugs([slug]);
  const category = rows[0];

  return category && !category.parent_id ? category : null;
}

export async function generateMetadata({ params }: PageProps) {
  const { department: slug } = await params;
  const category = await getDepartmentCategory(slug);

  if (!category) {
    return {};
  }

  const department = buildDepartment(category);

  return pageMetadata({
    title: `${department.metaTitle} | HAANI Threads`,
    description: department.metaDescription,
    path: `/${department.slug}`,
    ...(department.imageUrl ? { images: [department.imageUrl] } : {}),
  });
}

export default async function DepartmentRoute({ params }: PageProps) {
  const { department: slug } = await params;
  const category = await getDepartmentCategory(slug);

  if (!category) {
    notFound();
  }

  /* Include products filed directly on the parent as well as its children. */
  const children = await getCategoryChildren(category.slug).catch((error: unknown) => {
    console.error("Could not resolve department children:", error);
    return [];
  });

  const slugs = [category.slug, ...children.map((child) => child.slug)];

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: category.name, path: `/${category.slug}` },
        ])}
      />
      <ProductListing
        title={category.name}
        crumbLabel={category.name}
        description={category.description ?? undefined}
        collectionStyle
        headerExtra={<CollectionSubcategories parent={category} categories={children} />}
        categorySlugs={slugs}
        filterCategoryId={category.id}
      />
    </>
  );
}
