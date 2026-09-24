/*
 * ---------------------------------------------------------
 * SIZE GUIDE
 * ---------------------------------------------------------
 *
 * The garment measurements behind the "Size guide" modal on
 * the product page.
 *
 * Figures are held in centimetres only, and inches are derived
 * on render. Storing both would mean two numbers per cell that
 * can disagree, and a table where 96.5 cm sits beside 39 in is
 * a table nobody can trust.
 *
 * These are garment measurements, not body measurements - the
 * dimensions of the piece itself, which is what a shopper
 * compares against something they already own.
 */

/* Sizes carried, in the order the columns appear. */
export const SIZES = ["S", "M", "L"] as const;

export type Size = (typeof SIZES)[number];

export interface SizeRow {
  label: string;
  /* One measurement per entry in SIZES, in centimetres. */
  cm: [number, number, number];
}

export interface SizeChart {
  /* The garment this table covers, e.g. "Kurti". */
  garment: string;
  rows: SizeRow[];
}

const CM_PER_INCH = 2.54;

/*
 * One decimal place. Centimetres arrive that way, and inches
 * divide into figures like 39.017 that would otherwise read as
 * false precision.
 */
export function formatMeasurement(cm: number, unit: Unit): string {
  const value = unit === "cm" ? cm : cm / CM_PER_INCH;

  return (Math.round(value * 10) / 10).toString();
}

export type Unit = "cm" | "in";

export const UNITS: { value: Unit; label: string }[] = [
  { value: "cm", label: "CM" },
  { value: "in", label: "Inches" },
];

/*
 * The default chart, used for any product without one of its
 * own. Three-piece suits are the bulk of the catalogue, so the
 * kurti and trouser tables are what a shopper usually needs.
 */
export const SIZE_CHARTS: SizeChart[] = [
  {
    garment: "Kurti",
    rows: [
      { label: "Length (regular)", cm: [99.1, 102, 104] },
      { label: "Length (fusion A)", cm: [76.2, 78.7, 81.3] },
      { label: "Length (long)", cm: [107, 107, 112] },
      { label: "Shoulder", cm: [35.6, 36.8, 39.4] },
      { label: "Chest", cm: [48.3, 50.8, 55.9] },
      { label: "Sleeves", cm: [55.9, 55.9, 58.4] },
    ],
  },
  {
    garment: "Trouser",
    rows: [
      { label: "Waist (relaxed)", cm: [33, 35.6, 39.4] },
      { label: "Hip", cm: [54.6, 57.1, 61] },
      { label: "Knee", cm: [21.6, 22.9, 24.1] },
      { label: "Length", cm: [92.7, 95.3, 97.8] },
    ],
  },
];
