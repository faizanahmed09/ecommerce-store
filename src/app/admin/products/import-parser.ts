/*
 * ---------------------------------------------------------
 * BULK PRODUCT IMPORT - PARSING & VALIDATION
 * ---------------------------------------------------------
 *
 * Pure functions only. The sheet is turned into rows here and
 * checked against the same rules the single-product form
 * applies, so a spreadsheet can never create a product the
 * form would have rejected.
 *
 * Nothing in this file touches React or Supabase - the UI in
 * import-sheet.tsx decides what to do with the verdicts.
 */

import { generateSlug, safeImageSrc } from "@/src/app/lib/utils";

/*
 * ---------------------------------------------------------
 * COLUMNS
 * ---------------------------------------------------------
 */

export type ImportField =
  | "name"
  | "slug"
  | "description"
  | "price"
  | "sale_price"
  | "stock_quantity"
  | "category"
  | "featured"
  | "image_url"
  | "variants";

interface ColumnSpec {
  field: ImportField;
  /* The heading written into the downloadable template. */
  label: string;
  required: boolean;
  /*
   * Accepted headings, already normalised. Sheets exported from
   * Excel, Shopify and WooCommerce all name these differently,
   * so a handful of aliases saves a lot of manual re-typing.
   */
  aliases: string[];
  example: string;
}

export const IMPORT_COLUMNS: readonly ColumnSpec[] = [
  {
    field: "name",
    label: "name",
    required: true,
    aliases: ["name", "productname", "product", "title"],
    example: "Men's Casual Polo",
  },
  {
    field: "slug",
    label: "slug",
    required: false,
    aliases: ["slug", "handle", "productslug", "urlkey"],
    example: "mens-casual-polo",
  },
  {
    field: "description",
    label: "description",
    required: false,
    aliases: ["description", "desc", "details", "productdescription"],
    example: "Soft cotton polo with a ribbed collar.",
  },
  {
    field: "price",
    label: "price",
    required: true,
    aliases: ["price", "regularprice", "mrp", "listprice"],
    example: "2500",
  },
  {
    field: "sale_price",
    label: "sale_price",
    required: false,
    aliases: ["saleprice", "discountprice", "discountedprice", "specialprice"],
    example: "1999",
  },
  {
    field: "stock_quantity",
    label: "stock_quantity",
    required: false,
    aliases: ["stockquantity", "stock", "quantity", "qty", "inventory"],
    example: "50",
  },
  {
    field: "category",
    label: "category",
    required: true,
    aliases: ["category", "categoryname", "categoryslug", "collection"],
    example: "men",
  },
  {
    field: "featured",
    label: "featured",
    required: false,
    aliases: ["featured", "isfeatured", "feature"],
    example: "false",
  },
  {
    /*
     * Several images go in one cell, separated by "|". The first is the
     * primary - the one listings show - and the rest become the gallery in
     * the order written. A single url is still a valid cell, so sheets
     * written for the old one-image importer keep working.
     */
    field: "image_url",
    label: "image_url",
    required: false,
    aliases: ["imageurl", "image", "primaryimage", "photo", "picture", "images"],
    example: "https://picsum.photos/seed/polo/800/1000|https://picsum.photos/seed/polo2/800/1000",
  },
  {
    /*
     * One "|"-separated entry per option value, written
     * name:value:price_adjustment:stock - the same shape as a product_variants
     * row. The last two default to 0 and may be left off.
     */
    field: "variants",
    label: "variants",
    required: false,
    aliases: ["variants", "variant", "options", "attributes", "variantoptions"],
    example: "Size:S:0:10|Size:M:0:5|Color:Black:250:8",
  },
] as const;

/*
 * A cap keeps a 50k-row sheet from locking up the browser tab.
 * Larger catalogues should be split across several files.
 */
export const MAX_IMPORT_ROWS = 1000;

/*
 * ---------------------------------------------------------
 * SHAPES
 * ---------------------------------------------------------
 */

export interface ImportCategory {
  id: string;
  name: string;
  slug: string;
}

export interface ImportExistingProduct {
  id: string;
  slug: string;
}

/* One product_variants row, as written in the sheet's variants cell. */
export interface ImportVariant {
  name: string;
  value: string;
  price_adjustment: number;
  stock_quantity: number;
}

/* Mirrors ProductPayload in page.tsx - the products table columns. */
export interface ImportProductValues {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  category_id: string;
  featured: boolean;
}

export type ImportRowAction = "create" | "update" | "skip" | "error";

export interface ImportRow {
  /* 1-based row number as shown in Excel, header included. */
  rowNumber: number;
  name: string;
  slug: string;
  values: ImportProductValues | null;
  /* Primary first, then the gallery in sheet order. */
  imageUrls: string[];
  variants: ImportVariant[];
  /* Set when the slug already exists in the catalogue. */
  existingId: string | null;
  errors: string[];
  warnings: string[];
}

export interface ParsedSheet {
  rows: ImportRow[];
  /* Headings that were recognised, in sheet order. */
  matchedColumns: ImportField[];
  /* Headings present in the file that mean nothing to us. */
  ignoredColumns: string[];
  /* Set when the file has more data rows than MAX_IMPORT_ROWS. */
  truncated: boolean;
}

export class ImportParseError extends Error {}

/*
 * ---------------------------------------------------------
 * CELL READERS
 * ---------------------------------------------------------
 */

const normaliseHeading = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/*
 * Spreadsheets carry money as "Rs. 2,500.00" or "2 500" just as
 * often as a bare number, so pull the figure out of whatever
 * decorates it rather than rejecting the row. Thousands
 * separators go first - note that this reads "2,5" as 25, so a
 * sheet written with European decimal commas needs converting
 * before it is uploaded.
 */
const parseNumber = (value: string): number | null => {
  const separatorless = value.replace(/[\s,](?=\d)/g, "");
  const match = separatorless.match(/-?\d+(?:\.\d+)?/);

  return match ? Number(match[0]) : null;
};

/* Multi-value cells are "|"-separated; blanks between separators are dropped. */
const splitList = (value: string): string[] =>
  value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

const TRUTHY = new Set(["true", "yes", "y", "1", "featured"]);
const FALSY = new Set(["false", "no", "n", "0", ""]);

const parseBoolean = (value: string): boolean | null => {
  const normalised = value.trim().toLowerCase();

  if (TRUTHY.has(normalised)) return true;
  if (FALSY.has(normalised)) return false;

  return null;
};

/*
 * ---------------------------------------------------------
 * HEADER MAPPING
 * ---------------------------------------------------------
 */

interface HeaderMap {
  /* Column index in the sheet for each recognised field. */
  indexes: Partial<Record<ImportField, number>>;
  matched: ImportField[];
  ignored: string[];
}

function mapHeaders(headings: string[]): HeaderMap {
  const indexes: Partial<Record<ImportField, number>> = {};
  const matched: ImportField[] = [];
  const ignored: string[] = [];

  headings.forEach((heading, index) => {
    const normalised = normaliseHeading(heading);

    if (normalised === "") return;

    const column = IMPORT_COLUMNS.find((candidate) => candidate.aliases.includes(normalised));

    /* First occurrence wins, so a duplicated heading is ignored. */
    if (!column || indexes[column.field] !== undefined) {
      ignored.push(heading.trim() || `Column ${index + 1}`);
      return;
    }

    indexes[column.field] = index;
    matched.push(column.field);
  });

  return { indexes, matched, ignored };
}

/*
 * ---------------------------------------------------------
 * ROW VALIDATION
 * ---------------------------------------------------------
 *
 * The rules here are deliberately the same as validateForm()
 * in page.tsx: name and category required, non-negative price
 * and stock, and a sale price that never exceeds the price.
 */

interface ValidateContext {
  categoriesBySlug: Map<string, ImportCategory>;
  categoriesByName: Map<string, ImportCategory>;
  existingBySlug: Map<string, string>;
  /* Slugs already claimed by earlier rows of the same file. */
  seenSlugs: Map<string, number>;
}

function validateRow(
  cells: Partial<Record<ImportField, string>>,
  rowNumber: number,
  context: ValidateContext
): ImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const read = (field: ImportField): string => (cells[field] ?? "").trim();

  const name = read("name");
  const rawSlug = read("slug");
  const slug = generateSlug(rawSlug || name);

  if (!name) {
    errors.push("Name is required.");
  }

  if (!slug) {
    errors.push("Slug is empty and could not be derived from the name.");
  }

  /* Category may be given as either the slug or the display name. */
  const categoryInput = read("category");
  let categoryId = "";

  if (!categoryInput) {
    errors.push("Category is required.");
  } else {
    const key = categoryInput.toLowerCase();
    const category =
      context.categoriesBySlug.get(key) ??
      context.categoriesBySlug.get(generateSlug(categoryInput)) ??
      context.categoriesByName.get(key);

    if (category) {
      categoryId = category.id;
    } else {
      errors.push(`Category "${categoryInput}" does not exist.`);
    }
  }

  const priceInput = read("price");
  const price = parseNumber(priceInput);

  if (price === null) {
    errors.push(priceInput ? `Price "${priceInput}" is not a number.` : "Price is required.");
  } else if (price < 0) {
    errors.push("Price cannot be negative.");
  }

  /* Stock is optional; the column defaults to 0 like the table does. */
  const stockInput = read("stock_quantity");
  let stock = 0;

  if (stockInput !== "") {
    const parsed = parseNumber(stockInput);

    if (parsed === null) {
      errors.push(`Stock quantity "${stockInput}" is not a number.`);
    } else if (!Number.isInteger(parsed) || parsed < 0) {
      errors.push("Stock quantity must be a whole number of 0 or more.");
    } else {
      stock = parsed;
    }
  }

  const salePriceInput = read("sale_price");
  let salePrice: number | null = null;

  if (salePriceInput !== "") {
    const parsed = parseNumber(salePriceInput);

    if (parsed === null) {
      errors.push(`Sale price "${salePriceInput}" is not a number.`);
    } else if (parsed < 0) {
      errors.push("Sale price cannot be negative.");
    } else if (price !== null && parsed > price) {
      errors.push("Sale price cannot be greater than the price.");
    } else {
      salePrice = parsed;
    }
  }

  const featuredInput = read("featured");
  const featured = parseBoolean(featuredInput);

  if (featured === null) {
    errors.push(`Featured "${featuredInput}" is not a yes/no value.`);
  }

  /*
   * A bad image host no longer breaks the page - safeImageSrc
   * swaps in the placeholder - but the admin should still know
   * the picture will not show, so it is a warning, not an error.
   */
  const imageUrls = splitList(read("image_url"));

  const blockedHosts = imageUrls.filter((url) => safeImageSrc(url) !== url);

  if (blockedHosts.length > 0) {
    warnings.push(
      blockedHosts.length === imageUrls.length
        ? "Image URL is not an allowed host, so the placeholder will show instead."
        : `${blockedHosts.length} of ${imageUrls.length} image URLs are not an allowed host, so the placeholder will show for those.`
    );
  }

  /*
   * Variants are written name:value:price_adjustment:stock, one per "|".
   * A malformed entry is an error rather than a warning: silently dropping
   * an option would publish a product missing a size shoppers can pick.
   */
  const variants: ImportVariant[] = [];
  const seenVariants = new Set<string>();

  for (const entry of splitList(read("variants"))) {
    const parts = entry.split(":").map((part) => part.trim());
    const [variantName, variantValue, adjustmentInput, stockInput] = parts;

    if (parts.length > 4) {
      errors.push(
        `Variant "${entry}" has too many parts - expected name:value:price_adjustment:stock.`
      );
      continue;
    }

    if (!variantName || !variantValue) {
      errors.push(`Variant "${entry}" needs both an option name and a value, like Size:M.`);
      continue;
    }

    const key = `${variantName.toLowerCase()}\u0000${variantValue.toLowerCase()}`;

    if (seenVariants.has(key)) {
      errors.push(`Variant "${variantName}: ${variantValue}" is listed twice.`);
      continue;
    }

    seenVariants.add(key);

    let adjustment = 0;

    if (adjustmentInput) {
      const parsedAdjustment = parseNumber(adjustmentInput);

      if (parsedAdjustment === null) {
        errors.push(`Variant "${entry}" has a price adjustment that is not a number.`);
        continue;
      }

      adjustment = parsedAdjustment;
    }

    let variantStock = 0;

    if (stockInput) {
      const parsedStock = parseNumber(stockInput);

      if (parsedStock === null || !Number.isInteger(parsedStock) || parsedStock < 0) {
        errors.push(`Variant "${entry}" has a stock that is not a whole number of 0 or more.`);
        continue;
      }

      variantStock = parsedStock;
    }

    variants.push({
      name: variantName,
      value: variantValue,
      price_adjustment: adjustment,
      stock_quantity: variantStock,
    });
  }

  /* A slug repeated inside the file would fail the UNIQUE index. */
  const duplicateOfRow = slug ? context.seenSlugs.get(slug) : undefined;

  if (duplicateOfRow !== undefined) {
    errors.push(`Slug "${slug}" is already used by row ${duplicateOfRow}.`);
  } else if (slug) {
    context.seenSlugs.set(slug, rowNumber);
  }

  const existingId = slug ? (context.existingBySlug.get(slug) ?? null) : null;

  const valid = errors.length === 0 && price !== null && featured !== null && categoryId;

  return {
    rowNumber,
    name,
    slug,
    imageUrls,
    variants,
    existingId,
    errors,
    warnings,
    values: valid
      ? {
          name,
          slug,
          description: read("description") || null,
          price: price as number,
          sale_price: salePrice,
          stock_quantity: stock,
          category_id: categoryId,
          featured: featured as boolean,
        }
      : null,
  };
}

/*
 * ---------------------------------------------------------
 * SHEET PARSING
 * ---------------------------------------------------------
 */

/*
 * `grid` is the raw sheet: row 0 is the heading row and every
 * cell is already a string. SheetJS produces this for .csv,
 * .xlsx and .xls alike, so this function never has to care
 * which format was uploaded.
 */
export function parseImportGrid(
  grid: string[][],
  categories: ImportCategory[],
  existingProducts: ImportExistingProduct[]
): ParsedSheet {
  const headings = grid[0];

  if (!headings) {
    throw new ImportParseError("The file is empty.");
  }

  const { indexes, matched, ignored } = mapHeaders(headings);

  const missingRequired = IMPORT_COLUMNS.filter(
    (column) => column.required && indexes[column.field] === undefined
  );

  if (missingRequired.length > 0) {
    throw new ImportParseError(
      `The first row must contain the headings ${missingRequired
        .map((column) => `"${column.label}"`)
        .join(", ")}. Download the template to see the expected columns.`
    );
  }

  const context: ValidateContext = {
    categoriesBySlug: new Map(
      categories.map((category) => [category.slug.toLowerCase(), category])
    ),
    categoriesByName: new Map(
      categories.map((category) => [category.name.toLowerCase(), category])
    ),
    existingBySlug: new Map(
      existingProducts.map((product) => [product.slug.toLowerCase(), product.id])
    ),
    seenSlugs: new Map(),
  };

  const rows: ImportRow[] = [];
  let truncated = false;

  for (let index = 1; index < grid.length; index += 1) {
    const cells = grid[index] ?? [];

    /* Excel likes to hand back trailing rows of empty strings. */
    const isBlank = cells.every((cell) => (cell ?? "").trim() === "");

    if (isBlank) continue;

    if (rows.length >= MAX_IMPORT_ROWS) {
      truncated = true;
      break;
    }

    const values: Partial<Record<ImportField, string>> = {};

    for (const [field, columnIndex] of Object.entries(indexes)) {
      values[field as ImportField] = cells[columnIndex as number] ?? "";
    }

    /* +1 because the grid is 0-based and Excel rows are 1-based. */
    rows.push(validateRow(values, index + 1, context));
  }

  if (rows.length === 0) {
    throw new ImportParseError("The file has headings but no product rows.");
  }

  return { rows, matchedColumns: matched, ignoredColumns: ignored, truncated };
}

/*
 * ---------------------------------------------------------
 * PLANNING
 * ---------------------------------------------------------
 */

export type DuplicateMode = "skip" | "update";

export function rowAction(row: ImportRow, mode: DuplicateMode): ImportRowAction {
  if (row.values === null) return "error";
  if (row.existingId === null) return "create";

  return mode === "update" ? "update" : "skip";
}

export interface ImportPlan {
  create: number;
  update: number;
  skip: number;
  error: number;
}

export function summarisePlan(rows: ImportRow[], mode: DuplicateMode): ImportPlan {
  const plan: ImportPlan = { create: 0, update: 0, skip: 0, error: 0 };

  for (const row of rows) {
    plan[rowAction(row, mode)] += 1;
  }

  return plan;
}

/*
 * ---------------------------------------------------------
 * TEMPLATE
 * ---------------------------------------------------------
 */

const escapeCsv = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/*
 * Two sample rows: one fully populated, one with only the
 * required columns, so the optional ones are visibly optional.
 */
export function buildTemplateCsv(categories: ImportCategory[]): string {
  const sampleCategory = categories[0]?.slug ?? "men";

  const header = IMPORT_COLUMNS.map((column) => column.label);

  const fullRow = IMPORT_COLUMNS.map((column) =>
    column.field === "category" ? sampleCategory : column.example
  );

  const minimalRow = IMPORT_COLUMNS.map((column) => {
    if (column.field === "name") return "Basic Cotton Tee";
    if (column.field === "price") return "1200";
    if (column.field === "category") return sampleCategory;
    return "";
  });

  return [header, fullRow, minimalRow].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}
