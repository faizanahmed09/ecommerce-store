/*
 * ---------------------------------------------------------
 * DEPARTMENTS
 * ---------------------------------------------------------
 *
 * A department landing page is generated for any top-level
 * row in `categories`, by /[department]. Creating a department
 * is therefore an admin action, not a deploy.
 *
 * What the categories table cannot hold is editorial: hero
 * copy, a call-to-action label, promo tiles, and the fact that
 * Women leads with "Trending Now" where another department
 * leads with "Best Sellers". That lives in OVERRIDES below, keyed by slug and
 * entirely optional - a department with no entry still gets a
 * complete page built from its own row.
 *
 * /sale and /new-arrivals are not departments. They are routes
 * rather than category rows, and their pages differ enough
 * that forcing them into this shape would cost more than it
 * saves.
 */

import type { CategoryRecord } from "@/src/app/lib/categories";

/*
 * Slugs that can never be a department, because a static route
 * of the same name already answers that URL. Next resolves
 * static segments before dynamic ones, so a category called
 * "products" would simply be unreachable - better to refuse it
 * than to ship a page nobody can open.
 */
export const RESERVED_SLUGS = new Set([
  "about",
  "account",
  "admin",
  "api",
  "cart",
  "categories",
  "checkout",
  "faqs",
  "forgot-password",
  "login",
  "new-arrivals",
  "products",
  "reset-password",
  "sale",
  "signup",
]);

export interface DepartmentSection {
  /* Anchor id, so the hero button can actually scroll to it. */
  id: string;
  title: string;
  /* Passed to ProductGrid, and to /products for "View all". */
  sort: string;
}

export interface Department {
  slug: string;
  name: string;
  /* Prepended to the grid headings, e.g. "Women's". */
  metaTitle: string;
  metaDescription: string;
  hero: {
    title: string;
    description: string;
    primaryCta: string;
  };
  /*
   * One product rail. There used to be two - "New Arrivals" and
   * "Trending Now" / "Best Sellers" - but the schema has no
   * sales counters, so `trending` and `best-selling` both fell
   * through applySort to the same default ordering: the same
   * query, run twice, under two headings.
   */
  section: DepartmentSection;
  /* The category's own banner, when the admin has uploaded one. */
  imageUrl: string | null;
}

const NEW_ARRIVALS: DepartmentSection = {
  id: "new-arrivals",
  title: "New Arrivals",
  sort: "newest",
};

/*
 * An entry may set any part of a department. `slug` selects the
 * row it applies to; `name` is allowed so the literal below
 * reads as a department rather than a bag of strings, but the
 * category row is what actually supplies it.
 */
type DepartmentOverride = Partial<Department>;

const OVERRIDES: Record<string, DepartmentOverride> = Object.fromEntries(
  (
    [
      {
        slug: "women",
        name: "Women",
        metaTitle: "Women's Eastern Wear - Embroidered & Stitched",
        metaDescription:
          "Shop women's eastern wear: embroidered dresses, stitched and unstitched 3-piece suits, lawn, pret and party wear. Pakistani designs with cash on delivery.",
        hero: {
          title: "Women's Collection",
          description:
            "Explore our stunning women's fashion collection featuring elegant designs for every style and occasion.",
          primaryCta: "Shop New Arrivals",
        },
      },
      {
        slug: "kids",
        name: "Kids",
        metaTitle: "Girls Eastern Wear - Frocks & Shalwar Kameez",
        metaDescription:
          "Kids eastern wear for Eid, weddings and every day: embroidered frocks, kurtis and shalwar kameez for girls. Shop online in Pakistan at HAANI Threads.",
        hero: {
          title: "Kids Collection",
          description:
            "Adorable and comfortable clothing for kids of all ages. From everyday wear to special occasions.",
          primaryCta: "Shop New Arrivals",
        },
      },
      {
        slug: "footwear",
        name: "Footwear",
        metaTitle: "Women's Footwear - Khussa, Heels & Sandals",
        metaDescription:
          "Footwear to finish an eastern look: embroidered khussa, kolhapuris, heels and sandals for women. Cash on delivery across Pakistan.",
        hero: {
          title: "Footwear Collection",
          description: "Step out in style with our premium footwear collection for women.",
          primaryCta: "Shop New Arrivals",
        },
      },
      {
        slug: "fragrance",
        name: "Fragrance",
        metaTitle: "Women's Fragrances & Perfumes",
        metaDescription:
          "Discover HAANI Threads fragrances: perfumes for women, made to pair with your eastern wear. Shop online with cash on delivery in Pakistan.",
        hero: {
          title: "Fragrance Collection",
          description: "Discover our exclusive collection of premium fragrances for women.",
          primaryCta: "Shop New Arrivals",
        },
      },
      {
        slug: "winter-wear",
        name: "Winter Wear",
        metaTitle: "Winter Eastern Wear - Khaddar, Karandi & Shawls",
        metaDescription:
          "Winter eastern wear in khaddar, karandi, marina and linen: embroidered stitched and unstitched suits, shawls and kurtis. Shop online in Pakistan at HAANI Threads.",
        hero: {
          title: "Winter Collection",
          description: "Stay warm and stylish with our premium winter wear collection for women.",
          primaryCta: "Shop Collection",
        },
      },
      /*
       * Eastern-wear departments. None exist until an admin
       * creates the category; an entry here only takes effect
       * for a row with the same slug.
       */
      {
        slug: "stitched",
        metaTitle: "Stitched Suits - Ready to Wear Eastern Dresses",
        metaDescription:
          "Ready to wear stitched suits: embroidered 2 and 3-piece dresses in lawn, cotton, chiffon and khaddar. No tailoring needed - cash on delivery in Pakistan.",
      },
      {
        slug: "unstitched",
        metaTitle: "Unstitched Suits - Embroidered Lawn & 3-Piece",
        metaDescription:
          "Unstitched suits in embroidered lawn, cotton, chiffon and khaddar - 2 and 3-piece fabric with dupatta, tailored your way. Shop online in Pakistan at HAANI Threads.",
      },
      {
        slug: "summer-unstitched",
        metaTitle: "Summer Unstitched Fabrics",
        metaDescription:
          "Explore summer unstitched fabrics at HAANI Threads. Discover prints and embroidery to tailor your way.",
        hero: {
          title: "Summer Unstitched",
          description: "Light, expressive fabrics for the warmer days ahead, ready to make your own.",
          primaryCta: "Explore the collection",
        },
      },
      {
        slug: "winter-unstitched",
        metaTitle: "Winter Unstitched Fabrics",
        metaDescription:
          "Explore winter unstitched fabrics at HAANI Threads. Discover seasonal textures to tailor your way.",
        hero: {
          title: "Winter Unstitched",
          description: "Considered fabrics for cooler days, ready to become your own winter wardrobe.",
          primaryCta: "Explore the collection",
        },
      },
      {
        slug: "embroidered",
        metaTitle: "Embroidered Dresses & Suits",
        metaDescription:
          "Embroidered dresses and suits: chikankari, threadwork and embellished stitched and unstitched eastern wear for Eid, weddings and everyday. Cash on delivery.",
      },
      {
        slug: "pret",
        metaTitle: "Pret Wear - Ready to Wear Kurtis & Suits",
        metaDescription:
          "Pret wear by HAANI Threads: ready to wear kurtis, co-ord sets and embroidered 2 and 3-piece stitched suits for everyday and festive wear. Delivered across Pakistan.",
      },
      {
        slug: "eastern-wear",
        metaTitle: "Eastern Wear - Pakistani Dresses Online",
        metaDescription:
          "Pakistani eastern wear online: embroidered dresses, stitched and unstitched suits, kurtis and shalwar kameez for women. Cash on delivery at HAANI Threads.",
      },
      {
        slug: "lawn",
        metaTitle: "Lawn Suits - Embroidered & Printed Lawn",
        metaDescription:
          "Lawn suits for summer: embroidered and printed lawn, stitched and unstitched 3-piece sets with chiffon dupattas. Shop the HAANI Threads lawn collection online.",
      },
      {
        slug: "formal",
        metaTitle: "Formal & Party Wear - Embroidered Dresses",
        metaDescription:
          "Formal and party wear: embroidered luxury dresses in chiffon, organza and silk for weddings and Eid. Stitched and unstitched, with cash on delivery in Pakistan.",
      },
    ] as (DepartmentOverride & { slug: string })[]
  ).map(({ slug, ...override }) => [slug, override])
);

/* Title Case from a slug: "winter-wear" -> "Winter Wear". */
const titleFromSlug = (slug: string): string =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Build the landing page's content for one top-level category.
 *
 * Everything has a sensible value derived from the row, so a
 * department created in the admin this morning renders a
 * finished page; an OVERRIDES entry only replaces the parts
 * somebody has written better copy for.
 */
export function buildDepartment(category: CategoryRecord): Department {
  const override = OVERRIDES[category.slug] ?? {};

  const name = category.name || titleFromSlug(category.slug);

  const description = category.description ?? `Explore our ${name.toLowerCase()} collection.`;

  return {
    slug: category.slug,
    name,
    metaTitle: override.metaTitle ?? `${name} - Pakistani Eastern Wear`,
    metaDescription:
      override.metaDescription ??
      category.description ??
      `Shop ${name.toLowerCase()} at HAANI Threads: embroidered, stitched and unstitched Pakistani eastern wear, delivered across Pakistan with cash on delivery.`,
    hero: {
      title: override.hero?.title ?? name,
      description: override.hero?.description ?? description,
      primaryCta: override.hero?.primaryCta ?? "Shop New Arrivals",
    },
    section: override.section ?? NEW_ARRIVALS,
    /*
     * Straight off the row. The page used to render a fixed
     * /assets/kids.webp for every department, so /women showed
     * a photo of children.
     */
    imageUrl: category.image_url,
  };
}
