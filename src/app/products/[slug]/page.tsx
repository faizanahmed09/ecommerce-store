import { ProductDetails } from "@/src/app/components/product-details";
import { RelatedProducts } from "@/src/app/components/related-products";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getCategoryById, getProductBySlug } from "@/src/app/lib/catalogue";
import { JsonLd } from "@/src/app/components/json-ld";
import { childSegment } from "@/src/app/lib/navigation";
import { getPrimaryImage, type StorefrontProduct } from "@/src/app/lib/products";
import {
  breadcrumbJsonLd,
  defaultProductDescription,
  NO_INDEX,
  pageMetadata,
  productJsonLd,
} from "@/src/app/lib/seo";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/* Next 15 hands route props in as promises. */
type Params = Promise<{ slug: string }>;

/*
 * generateMetadata and the page both need the product, and
 * React's cache collapses that into a single query per request.
 */
const getProduct = cache(async (slug: string) => {
  try {
    return await getProductBySlug(slug);
  } catch (error) {
    console.error("Error fetching product:", error);
    throw error;
  }
});

/*
 * Home > Department > Subcategory > Product, as far as the
 * category tree goes. A lookup failure drops the category
 * crumbs rather than the page.
 */
async function getBreadcrumbs(product: StorefrontProduct) {
  const crumbs = [{ name: "Home", path: "/" }];

  try {
    const category = product.category_id ? await getCategoryById(product.category_id) : null;
    const parent = category?.parent_id ? await getCategoryById(category.parent_id) : null;

    if (category && parent && !parent.parent_id) {
      crumbs.push({ name: parent.name, path: `/${parent.slug}` });
      crumbs.push({
        name: category.name,
        path: `/${parent.slug}/${childSegment(category.slug, parent.slug)}`,
      });
    } else if (category && !category.parent_id) {
      crumbs.push({ name: category.name, path: `/${category.slug}` });
    }
  } catch (error) {
    console.error("Could not build product breadcrumbs:", error);
  }

  crumbs.push({ name: product.name, path: `/products/${product.slug}` });

  return crumbs;
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;

  try {
    const product = await getProduct(slug);

    if (!product) {
      return {
        title: "Product Not Found | HAANI Threads",
        description: "The requested product could not be found.",
        robots: NO_INDEX,
      };
    }

    const image = getPrimaryImage(product);

    return pageMetadata({
      title: `${product.name}${product.categories?.name ? ` - ${product.categories.name}` : ""} | HAANI Threads`,
      description: product.description || defaultProductDescription(product),
      path: `/products/${product.slug}`,
      ...(image ? { images: [image] } : {}),
    });
  } catch {
    return {
      title: "Product | HAANI Threads",
      description: "View product details and purchase options.",
    };
  }
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;

  /*
   * A missing product is a 404 rather than placeholder data,
   * so a broken link is visible instead of looking like a real
   * listing.
   */
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const breadcrumbs = await getBreadcrumbs(product);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:py-8">
      {/* Price, stock and photos for Google's product results. */}
      <JsonLd
        data={[productJsonLd(product, `/products/${product.slug}`), breadcrumbJsonLd(breadcrumbs)]}
      />

      <ProductDetails product={product} />

      <RelatedProducts currentProductId={product.id} categoryId={product.category_id} />
    </div>
  );
}
