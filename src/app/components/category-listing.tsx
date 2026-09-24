import { getCategoriesBySlugs, getCategoryChildren } from "@/src/app/lib/catalogue";
import { ProductListing, type ListingSearchParams } from "@/src/app/components/product-listing";
import { pageMetadata } from "@/src/app/lib/seo";

/*
 * ---------------------------------------------------------
 * CATEGORY LISTING
 * ---------------------------------------------------------
 *
 * /men/[subcategory], /women/[subcategory], /sale/[subcategory]
 * and friends were eight near-identical copies of this page.
 * They now all render this component, so a fix lands once.
 */

export type { ListingSearchParams };

interface CategoryListingProps {
  /* The [subcategory] / [slug] segment from the URL. */
  slug: string;
  /* Breadcrumb parent, omitted for a top-level category page. */
  parent?: { name: string; href: string };
  /*
   * The parent's own slug, used to resolve child slugs that
   * carry the parent as a prefix ("women" + "dresses" ->
   * "women-dresses").
   */
  parentSlug?: string;
  /* Prefix for the heading, e.g. "Women's". */
  titlePrefix?: string;
  /* Restrict to discounted products. */
  sale?: boolean;
}

interface CategoryRecord {
  name: string;
  description: string | null;
  /* The slug as actually stored, which may differ from the URL. */
  slug: string;
}

/* "winter-coats" -> "Winter Coats" */
const titleFromSlug = (slug: string): string =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/*
 * Resolve a URL segment to a category row.
 *
 * The navigation links to /women/dresses, but seed.sql stores
 * that category as "women-dresses" - the parent name is baked
 * into the child slug. So a segment is looked up both ways:
 * "<parent>-<segment>" first, then the bare "<segment>".
 *
 * Returning the stored slug matters as much as the name: the
 * product grid filters on categories.slug, so it has to be
 * given the slug the database actually holds.
 *
 * `null` means the lookup ran and found nothing; `undefined`
 * means the lookup itself failed, which must not become a 404.
 */
async function getCategory(
  slug: string,
  parentSlug?: string
): Promise<CategoryRecord | null | undefined> {
  try {
    const prefixed = parentSlug ? `${parentSlug}-${slug}` : null;

    const candidates = prefixed ? [prefixed, slug] : [slug];

    const rows = await getCategoriesBySlugs(candidates);

    if (rows.length === 0) {
      return null;
    }

    /* Prefer the parent-scoped slug when both exist. */
    const match =
      (prefixed && rows.find((row) => row.slug === prefixed)) ||
      rows.find((row) => row.slug === slug) ||
      rows[0];

    return {
      name: String(match.name ?? ""),
      description: (match.description as string | null) ?? null,
      slug: String(match.slug ?? slug),
    };
  } catch (error) {
    console.error("Error loading category:", error);
    return undefined;
  }
}

/*
 * The children of a resolved category, or an empty list when it
 * is a leaf. A failure here must not empty the page: falling
 * back to no children leaves the listing filtering on the
 * category itself, which is what it did before.
 */
async function getChildSlugs(slug: string): Promise<string[]> {
  try {
    const children = await getCategoryChildren(slug);

    return children.map((child) => child.slug);
  } catch (error) {
    console.error("Error loading category children:", error);
    return [];
  }
}

export async function CategoryListing({
  slug,
  parent,
  parentSlug,
  titlePrefix,
  sale,
}: CategoryListingProps) {
  const category = await getCategory(slug, parentSlug);

  /*
   * The heading falls back to a readable version of the URL
   * segment when the slug isn't in the categories table. It
   * does NOT invent a description - an unknown category just
   * shows an empty product list, which is the truth.
   */
  const name = category?.name ?? titleFromSlug(slug);

  const heading = titlePrefix ? `${titlePrefix} ${name}` : name;

  /*
   * Filter on the stored slug so /women/dresses actually
   * narrows to the "women-dresses" category.
   */
  const filterSlug = category?.slug ?? slug;

  /*
   * A department has to carry its children with it. Products
   * belong to "women-dresses", never to "women", so filtering
   * /sale/women on the single slug "women" matched nothing and
   * every department tile led to an empty page - however much
   * discounted stock was sitting one level down.
   *
   * department-page.tsx has always done this for its own
   * sections; this route reached the same data by a different
   * path and never got it.
   */
  const childSlugs = await getChildSlugs(filterSlug);

  return (
    <ProductListing
      title={heading}
      crumbLabel={name}
      description={category?.description ?? undefined}
      crumbs={parent ? [{ name: parent.name, href: parent.href }] : []}
      /*
       * A leaf category stays on the singular prop: passing a
       * one-element list would work, but the singular form is
       * what the rest of the app reads as "this category only".
       */
      categorySlug={childSlugs.length > 0 ? undefined : filterSlug}
      categorySlugs={childSlugs.length > 0 ? [filterSlug, ...childSlugs] : undefined}
      sale={sale}
      filterCategoryId={slug}
    />
  );
}

/*
 * Metadata helper so each route's generateMetadata stays a
 * one-liner.
 */
export async function buildCategoryMetadata(
  slug: string,
  context: { titlePrefix?: string; parentSlug?: string }
) {
  const category = await getCategory(slug, context.parentSlug);
  const name = category?.name ?? titleFromSlug(slug);

  const title = context.titlePrefix ? `${context.titlePrefix} ${name}` : name;

  const sale = context.parentSlug === "sale";

  return pageMetadata({
    title: sale ? `${title} Sale - Eastern Wear Up to 50% Off | Lamees` : `${title} | Lamees`,
    description:
      category?.description ||
      (sale
        ? `Shop discounted ${title.toLowerCase()} at Lamees: embroidered, stitched and unstitched eastern wear on sale, with cash on delivery across Pakistan.`
        : `Shop ${title.toLowerCase()} online at Lamees: embroidered, stitched and unstitched Pakistani eastern wear, delivered across Pakistan with cash on delivery.`),
    path: context.parentSlug ? `/${context.parentSlug}/${slug}` : `/${slug}`,
  });
}
