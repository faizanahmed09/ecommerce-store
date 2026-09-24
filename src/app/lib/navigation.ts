/**
 * Storefront navigation, built from the `categories` table.
 *
 * The desktop mega menu and the mobile drawer both render the tree this file
 * produces, so the two can never drift apart — and neither can drift from the
 * catalogue, because the departments and their subcategories are the rows an
 * admin manages under /admin/categories.
 *
 * Two entries are not categories and stay hard-coded: the promotional Sale
 * banner and New In, which are routes rather than rows.
 */

import type { CategoryRecord } from "@/src/app/lib/categories";

export type NavLink = {
  name: string;
  href: string;
  /** Small pill rendered next to the link, e.g. "New" or "50% off". */
  badge?: string;
};

export type NavGroup = {
  /** Column heading. Blank on continuation columns of a long list. */
  title: string;
  links: NavLink[];
};

export type NavFeature = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  /** Tailwind gradient used as the card background. */
  gradient: string;
};

export type NavCategory = {
  name: string;
  href: string;
  /** Highlighted in the brand pink (sale / promo entries). */
  accent?: boolean;
  groups?: NavGroup[];
  feature?: NavFeature;
};

/*
 * ---------------------------------------------------------
 * ROUTES
 * ---------------------------------------------------------
 *
 * A department's URL is its slug. /[department] renders any
 * top-level category, so there is nothing to map and nothing
 * to keep in step.
 *
 * This used to be a hand-maintained slug -> path table, which
 * existed mostly to record that the `fragrance` row lived under
 * a misspelt `/fragnance` directory. The directory is gone.
 */

export const sectionHref = (slug: string): string => `/${slug}`;

/*
 * Child slugs carry the parent as a prefix ("men-t-shirts"),
 * while the routes do not (/men/t-shirts).
 */
export const childSegment = (childSlug: string, parentSlug: string): string =>
  childSlug.startsWith(`${parentSlug}-`) ? childSlug.slice(parentSlug.length + 1) : childSlug;

const childHref = (child: CategoryRecord, parent: CategoryRecord): string =>
  `${sectionHref(parent.slug)}/${childSegment(child.slug, parent.slug)}`;

/*
 * ---------------------------------------------------------
 * PANEL LAYOUT
 * ---------------------------------------------------------
 */

/* Links per column before the list spills into the next one. */
const LINKS_PER_COLUMN = 6;

/* Columns the mega-menu panel can show beside its feature card. */
const MAX_COLUMNS = 3;

const toColumns = (links: NavLink[]): NavGroup[] => {
  if (links.length === 0) {
    return [];
  }

  const perColumn = Math.max(LINKS_PER_COLUMN, Math.ceil(links.length / MAX_COLUMNS));

  const columns: NavGroup[] = [];

  for (let index = 0; index < links.length; index += perColumn) {
    columns.push({
      /* Only the first column is labelled; the rest continue it. */
      title: index === 0 ? "Shop by category" : "",
      links: links.slice(index, index + perColumn),
    });
  }

  return columns;
};

/*
 * ---------------------------------------------------------
 * FEATURE CARDS
 * ---------------------------------------------------------
 *
 * The card is decoration, so only its palette is hard-coded.
 * Its words come from the category row, which means a new
 * department gets a finished panel the moment it is created.
 */

const SECTION_GRADIENTS: Record<string, string> = {
  men: "from-neutral-900 to-neutral-600",
  women: "from-[#B5468A] to-[#4C1D3D]",
  kids: "from-[#2F6DB5] to-[#123055]",
  footwear: "from-[#1F7A6C] to-[#0C3A33]",
  fragrance: "from-[#8A6A3A] to-[#3A2A14]",
  "winter-wear": "from-[#3B5A78] to-[#16232F]",
};

const FALLBACK_GRADIENTS = [
  "from-[#4C4F8A] to-[#1E1F3A]",
  "from-[#8A4C5C] to-[#3A1E26]",
  "from-[#3F6E4C] to-[#17301C]",
  "from-[#7A5A2E] to-[#2E2113]",
  "from-[#42708A] to-[#152B3A]",
  "from-[#7A3F6E] to-[#2B1730]",
  "from-[#8A6440] to-[#3A2A1B]",
  "from-[#4F7A73] to-[#1A302D]",
];

/*
 * Stable per slug, so a department keeps its colour between
 * renders - and so a category tile with no banner picks up the
 * same palette its panel in the mega menu already uses.
 */
export const gradientFor = (slug: string): string => {
  const known = SECTION_GRADIENTS[slug];

  if (known) {
    return known;
  }

  /*
   * A plain sum of character codes collides on anagrams, which
   * sibling slugs very nearly are: "women-tops" and
   * "women-pants" summed to the same number and so drew the
   * same card. That went unseen while only the mega menu read
   * this - it shows one card at a time - but the category grids
   * put siblings side by side, where a repeat reads as a bug.
   *
   * djb2 mixes in each character's position, and the final
   * avalanche spreads the result across all 32 bits, so the low
   * bits the modulo actually uses are not decided by a handful
   * of characters. Sibling slugs, which differ only in their
   * last word, land far apart.
   */
  let hash = Array.from(slug).reduce(
    (total, character) => (total * 33 + character.charCodeAt(0)) >>> 0,
    5381
  );

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909) >>> 0;
  hash ^= hash >>> 16;

  return FALLBACK_GRADIENTS[(hash >>> 0) % FALLBACK_GRADIENTS.length];
};

const featureFor = (category: CategoryRecord): NavFeature => ({
  eyebrow: "Explore",
  title: category.name,
  description: category.description ?? `Browse everything in ${category.name}.`,
  href: sectionHref(category.slug),
  cta: `Shop all ${category.name}`,
  gradient: gradientFor(category.slug),
});

/*
 * ---------------------------------------------------------
 * BUILD
 * ---------------------------------------------------------
 */

/* Promo entries that exist as routes rather than category rows. */
const newInCategory: NavCategory = { name: "New In", href: "/new-arrivals" };

/*
 * /sale/[subcategory] resolves its segment against the same
 * table, so the sale panel is the department list pointed at
 * the discounted view of each one.
 */
const saleCategory = (departments: CategoryRecord[]): NavCategory => ({
  name: "Sale",
  href: "/sale",
  accent: true,
  groups: toColumns(
    departments.map((department) => ({
      name: department.name,
      href: `/sale/${department.slug}`,
    }))
  ),
  feature: {
    eyebrow: "Ends soon",
    title: "Sale",
    description: "Reduced lines across every department, while stocks last.",
    href: "/sale",
    cta: "Shop all offers",
    gradient: "from-brand to-[#7C2D12]",
  },
});

/**
 * Turn the flat `categories` rows into the navigation tree.
 *
 * Top-level rows become the bar's departments in the order the query returned
 * them; their children become the panel underneath. A department with no
 * children is a plain link with no panel, exactly like New In.
 */
export function buildNavCategories(categories: CategoryRecord[]): NavCategory[] {
  const departments = categories.filter((category) => !category.parent_id);

  const childrenByParent = new Map<string, CategoryRecord[]>();

  for (const category of categories) {
    if (!category.parent_id) {
      continue;
    }

    const siblings = childrenByParent.get(category.parent_id);

    if (siblings) {
      siblings.push(category);
    } else {
      childrenByParent.set(category.parent_id, [category]);
    }
  }

  const departmentEntries: NavCategory[] = departments.map((department) => {
    const children = childrenByParent.get(department.id) ?? [];

    const groups = toColumns(
      children.map((child) => ({
        name: child.name,
        href: childHref(child, department),
      }))
    );

    return {
      name: department.name,
      href: sectionHref(department.slug),
      /* No children means no panel to open. */
      ...(groups.length > 0 ? { groups, feature: featureFor(department) } : {}),
    };
  });

  /* Nothing loaded yet: the promo entries would stand alone, so show none. */
  if (departmentEntries.length === 0) {
    return [];
  }

  return [saleCategory(departments), newInCategory, ...departmentEntries];
}

export const utilityLinks: NavLink[] = [
  { name: "Sign In", href: "/login" },
  { name: "Create Account", href: "/signup" },
  { name: "Track Order", href: "/track-order" },
  { name: "Store Locator", href: "/stores" },
  { name: "Returns & Exchanges", href: "/returns" },
];
