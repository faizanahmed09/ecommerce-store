import {
  getCategoriesBySlugs,
  getCategoryChildren,
  getRootCategories,
  preloadListing,
} from "@/src/app/lib/catalogue";
import { DEPARTMENT_SECTION_SIZE } from "@/src/app/lib/products";
import { DepartmentPage } from "@/src/app/components/department-page";
import { type CategoryRecord } from "@/src/app/lib/categories";
import { buildDepartment, RESERVED_SLUGS } from "@/src/app/lib/departments";
import { notFound } from "next/navigation";
import { JsonLd } from "@/src/app/components/json-ld";
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
    title: `${department.metaTitle} | Lamees`,
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

  const department = buildDepartment(category);

  /*
   * The rail's data, resolved here instead of in the browser.
   *
   * It used to take two round trips per visitor to draw: the
   * category tree, then the products belonging to whichever
   * children came back. Both are cached scopes now, so one read
   * serves everyone and the products are in the first paint.
   *
   * Products belong to the children ("women-dresses"), never to
   * the department, so the department's own slug is included
   * only in case something is filed directly on it.
   */
  const children = await getCategoryChildren(category.slug).catch((error: unknown) => {
    console.error("Could not resolve department children:", error);
    return [];
  });

  const slugs = [category.slug, ...children.map((child) => child.slug)];

  /* Products AND their stars - the rail was only getting the former. */
  const preloaded = await preloadListing({
    categorySlugs: slugs,
    sort: department.section.sort,
    cardsOnly: true,
    limit: DEPARTMENT_SECTION_SIZE,
    offset: 0,
  });

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: department.name, path: `/${department.slug}` },
        ])}
      />
      <DepartmentPage
        department={department}
        serverSlugs={slugs}
        initialPage={preloaded.page}
        initialStats={preloaded.stats}
      />
    </>
  );
}
