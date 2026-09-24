"use client";

/*
 * ---------------------------------------------------------
 * BULK PRODUCT IMPORT - UI
 * ---------------------------------------------------------
 *
 * Three steps in one panel: pick a file, review what the
 * sheet is going to do, then run it. Nothing is written until
 * the review step is confirmed, so a malformed sheet costs
 * nothing but a re-upload.
 */

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/src/app/components/ui/button";
import { Checkbox } from "@/src/app/components/ui/checkbox";
import { Label } from "@/src/app/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/app/components/ui/sheet";
import { createClient } from "@/src/app/lib/supabase/client";
import { cn } from "@/src/app/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { getErrorMessage, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "../components/admin-ui";
import {
  buildTemplateCsv,
  IMPORT_COLUMNS,
  ImportParseError,
  MAX_IMPORT_ROWS,
  parseImportGrid,
  rowAction,
  summarisePlan,
  type DuplicateMode,
  type ImportCategory,
  type ImportExistingProduct,
  type ImportRow,
  type ImportRowAction,
  type ImportVariant,
  type ParsedSheet,
} from "./import-parser";

/*
 * ---------------------------------------------------------
 * CONSTANTS
 * ---------------------------------------------------------
 */

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

/* Supabase rejects very large statements, so writes go out in batches. */
const WRITE_BATCH_SIZE = 50;

/* Rows shown in the preview before it starts scrolling on its own. */
const PREVIEW_LIMIT = 200;

interface ImportFailure {
  rowNumber: number;
  name: string;
  message: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  failures: ImportFailure[];
}

interface ProductImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ImportCategory[];
  existingProducts: ImportExistingProduct[];
  /* Called once after a run that wrote at least one row. */
  onImported: () => Promise<void> | void;
}

/*
 * ---------------------------------------------------------
 * COMPONENT
 * ---------------------------------------------------------
 */

export function ProductImportSheet({
  open,
  onOpenChange,
  categories,
  existingProducts,
  onImported,
}: ProductImportSheetProps) {
  const supabase = createClient();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>("");
  const [reading, setReading] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [importing, setImporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const plan = useMemo(
    () => (parsed ? summarisePlan(parsed.rows, duplicateMode) : null),
    [parsed, duplicateMode]
  );

  const writeCount = plan ? plan.create + plan.update : 0;

  /*
   * -------------------------------------------------------
   * RESET
   * -------------------------------------------------------
   */

  const resetState = useCallback((): void => {
    setFileName("");
    setParseError("");
    setParsed(null);
    setResult(null);
    setProgress(0);
    setDuplicateMode("skip");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleOpenChange = (next: boolean): void => {
    /* A half-finished import must not lose its progress to a stray click. */
    if (importing) return;

    onOpenChange(next);

    if (!next) {
      resetState();
    }
  };

  /*
   * -------------------------------------------------------
   * READ FILE
   * -------------------------------------------------------
   */

  const handleFile = useCallback(
    async (file: File): Promise<void> => {
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        setParseError(
          `"${file.name}" is not a spreadsheet. Upload a ${ACCEPTED_EXTENSIONS.join(", ")} file.`
        );
        return;
      }

      setReading(true);
      setParseError("");
      setParsed(null);
      setResult(null);
      setFileName(file.name);

      try {
        /*
         * SheetJS is ~450KB, and only this panel needs it, so it
         * is pulled in on demand rather than shipped with the
         * rest of the admin bundle.
         */
        const XLSX = await import("xlsx");

        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;

        if (!sheet) {
          throw new ImportParseError("The workbook has no sheets.");
        }

        /*
         * `raw: false` renders every cell through its display
         * format, so "2,500" and a date-formatted cell arrive as
         * the strings the admin actually sees in Excel.
         */
        const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          blankrows: false,
          raw: false,
          defval: "",
        });

        setParsed(parseImportGrid(grid, categories, existingProducts));
      } catch (error: unknown) {
        console.error("Product import parse error:", error);

        setParseError(
          error instanceof ImportParseError
            ? error.message
            : `Could not read the file. ${getErrorMessage(error)}`
        );
        setFileName("");
      } finally {
        setReading(false);
      }
    },
    [categories, existingProducts]
  );

  /*
   * -------------------------------------------------------
   * TEMPLATE DOWNLOAD
   * -------------------------------------------------------
   */

  const handleDownloadTemplate = (): void => {
    /* The BOM keeps Excel from mangling non-ASCII product names. */
    const blob = new Blob(["﻿", buildTemplateCsv(categories)], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "product-import-template.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  /*
   * -------------------------------------------------------
   * RUN IMPORT
   * -------------------------------------------------------
   */

  const runImport = async (): Promise<void> => {
    if (!parsed || !plan || importing) return;

    setImporting(true);
    setProgress(0);

    const failures: ImportFailure[] = [];
    let created = 0;
    let updated = 0;
    let processed = 0;

    const total = plan.create + plan.update;

    const advance = (count: number): void => {
      processed += count;
      setProgress(Math.round((processed / total) * 100));
    };

    const toCreate = parsed.rows.filter((row) => rowAction(row, duplicateMode) === "create");
    const toUpdate = parsed.rows.filter((row) => rowAction(row, duplicateMode) === "update");

    try {
      /*
       * ---------------------------------------------------
       * INSERTS
       * ---------------------------------------------------
       *
       * A failed batch is retried row by row so one bad row
       * cannot silently discard the 49 good ones beside it.
       */
      for (let i = 0; i < toCreate.length; i += WRITE_BATCH_SIZE) {
        const batch = toCreate.slice(i, i + WRITE_BATCH_SIZE);

        const { data, error } = await supabase
          .from("products")
          .insert(batch.map((row) => row.values!))
          .select("id, slug");

        if (error) {
          for (const row of batch) {
            const single = await supabase
              .from("products")
              .insert(row.values!)
              .select("id, slug")
              .single();

            if (single.error || !single.data) {
              failures.push({
                rowNumber: row.rowNumber,
                name: row.name,
                message: getErrorMessage(single.error),
              });
              continue;
            }

            created += 1;
            await insertImages(single.data.id, row.imageUrls);
            await insertVariants(single.data.id, row.variants);
          }

          advance(batch.length);
          continue;
        }

        created += data?.length ?? 0;

        /*
         * Match the returned ids back to their rows by slug -
         * insert() does not promise to preserve input order.
         */
        const idsBySlug = new Map((data ?? []).map((product) => [product.slug, product.id]));

        const saved = batch
          .map((row) => ({ id: idsBySlug.get(row.slug), row }))
          .filter((entry): entry is { id: string; row: ImportRow } => Boolean(entry.id));

        const imageRows = saved.flatMap((entry) => imageRowsFor(entry.id, entry.row.imageUrls));

        if (imageRows.length > 0) {
          const { error: imageError } = await supabase.from("product_images").insert(imageRows);

          /*
           * The products themselves are already saved, so a
           * failed image batch is reported rather than thrown.
           */
          if (imageError) {
            failures.push({
              rowNumber: batch[0]?.rowNumber ?? 0,
              name: `${imageRows.length} image(s)`,
              message: `Products saved but images failed: ${getErrorMessage(imageError)}`,
            });
          }
        }

        const variantRows = saved.flatMap((entry) => variantRowsFor(entry.id, entry.row.variants));

        if (variantRows.length > 0) {
          const { error: variantError } = await supabase
            .from("product_variants")
            .insert(variantRows);

          if (variantError) {
            failures.push({
              rowNumber: batch[0]?.rowNumber ?? 0,
              name: `${variantRows.length} variant(s)`,
              message: `Products saved but variants failed: ${getErrorMessage(variantError)}`,
            });
          }
        }

        advance(batch.length);
      }

      /*
       * ---------------------------------------------------
       * UPDATES
       * ---------------------------------------------------
       *
       * These are per-row because each one targets a different
       * id; a handful run at a time to keep the round trips down.
       */
      for (let i = 0; i < toUpdate.length; i += 10) {
        const batch = toUpdate.slice(i, i + 10);

        const outcomes = await Promise.all(
          batch.map(async (row) => {
            const { error } = await supabase
              .from("products")
              .update(row.values!)
              .eq("id", row.existingId!);

            if (error) {
              return { row, message: getErrorMessage(error) };
            }

            /*
             * A blank cell leaves what is already there alone; clearing a
             * gallery or a variant set stays a job for the form.
             */
            if (row.imageUrls.length > 0) {
              const imageError = await replaceImages(row.existingId!, row.imageUrls);

              if (imageError) {
                return {
                  row,
                  message: `Product updated but images failed: ${imageError}`,
                };
              }
            }

            if (row.variants.length > 0) {
              const variantError = await replaceVariants(row.existingId!, row.variants);

              if (variantError) {
                return {
                  row,
                  message: `Product updated but variants failed: ${variantError}`,
                };
              }
            }

            return null;
          })
        );

        for (const outcome of outcomes) {
          if (outcome) {
            failures.push({
              rowNumber: outcome.row.rowNumber,
              name: outcome.row.name,
              message: outcome.message,
            });
          } else {
            updated += 1;
          }
        }

        advance(batch.length);
      }

      setResult({
        created,
        updated,
        skipped: plan.skip,
        invalid: plan.error,
        failures,
      });

      if (created + updated > 0) {
        await onImported();
      }

      toast({
        title: failures.length > 0 ? "Import finished with errors" : "Import complete",
        description: `${created} created, ${updated} updated, ${plan.skip} skipped.`,
        variant: failures.length > 0 ? "destructive" : undefined,
      });
    } catch (error: unknown) {
      console.error("Product import error:", error);

      toast({
        title: "Import failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setProgress(100);
    }
  };

  /*
   * -------------------------------------------------------
   * IMAGE HELPERS
   * -------------------------------------------------------
   */

  /* The product_images rows for one sheet cell: first url is the primary. */
  const imageRowsFor = (productId: string, imageUrls: string[]) =>
    imageUrls.map((url, index) => ({
      product_id: productId,
      image_url: url,
      is_primary: index === 0,
      display_order: index,
    }));

  const insertImages = async (productId: string, imageUrls: string[]): Promise<void> => {
    if (imageUrls.length === 0) return;

    await supabase.from("product_images").insert(imageRowsFor(productId, imageUrls));
  };

  /*
   * Returns an error message, or null when the write succeeded.
   *
   * The whole gallery is replaced rather than patched: the sheet cell is the
   * complete list, so reconciling it row by row would leave images the sheet
   * no longer mentions behind.
   */
  const replaceImages = async (productId: string, imageUrls: string[]): Promise<string | null> => {
    const { error: deleteError } = await supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);

    if (deleteError) return getErrorMessage(deleteError);

    const { error } = await supabase
      .from("product_images")
      .insert(imageRowsFor(productId, imageUrls));

    return error ? getErrorMessage(error) : null;
  };

  /*
   * -------------------------------------------------------
   * VARIANT HELPERS
   * -------------------------------------------------------
   */

  const variantRowsFor = (productId: string, variants: ImportVariant[]) =>
    variants.map((variant) => ({
      product_id: productId,
      name: variant.name,
      value: variant.value,
      price_adjustment: variant.price_adjustment,
      stock_quantity: variant.stock_quantity,
    }));

  const insertVariants = async (productId: string, variants: ImportVariant[]): Promise<void> => {
    if (variants.length === 0) return;

    await supabase.from("product_variants").insert(variantRowsFor(productId, variants));
  };

  /*
   * Same replace-wholesale rule as the gallery. A variant an order line
   * already points at cannot be deleted, so that is reported rather than
   * left to surface as a raw foreign key error.
   */
  const replaceVariants = async (
    productId: string,
    variants: ImportVariant[]
  ): Promise<string | null> => {
    const { error: deleteError } = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId);

    if (deleteError) {
      return (deleteError as { code?: string }).code === "23503"
        ? "its existing variants appear on an order and cannot be replaced"
        : getErrorMessage(deleteError);
    }

    const { error } = await supabase
      .from("product_variants")
      .insert(variantRowsFor(productId, variants));

    return error ? getErrorMessage(error) : null;
  };

  /*
   * -------------------------------------------------------
   * RENDER
   * -------------------------------------------------------
   */

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-3xl">
        <SheetHeader className="mb-6 border-b border-neutral-100 pb-4">
          <SheetTitle className="text-lg font-bold text-neutral-900">
            Bulk Import Products
          </SheetTitle>

          <SheetDescription className="text-xs text-neutral-400">
            Upload a CSV or Excel file to create or update many products at once.
          </SheetDescription>
        </SheetHeader>

        {result ? (
          <ImportSummary
            result={result}
            onImportAnother={resetState}
            onClose={() => handleOpenChange(false)}
          />
        ) : parsed ? (
          <div className="space-y-5">
            <FileBadge fileName={fileName} onChange={resetState} />

            <PreviewNotices parsed={parsed} />

            {/* Duplicate handling */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="import-update-existing"
                  checked={duplicateMode === "update"}
                  disabled={importing}
                  onCheckedChange={(checked) =>
                    setDuplicateMode(checked === true ? "update" : "skip")
                  }
                />

                <div className="space-y-1">
                  <Label
                    htmlFor="import-update-existing"
                    className="cursor-pointer select-none text-xs font-semibold text-neutral-700"
                  >
                    Update products that already exist
                  </Label>

                  <p className="text-[11px] leading-relaxed text-neutral-500">
                    Rows are matched on slug. Leave this off and existing products are left
                    untouched - which is what you want unless the sheet is deliberately a price or
                    stock update.
                  </p>
                </div>
              </div>
            </div>

            {/* Plan */}
            {plan && (
              <div className="grid grid-cols-4 gap-3">
                <PlanTile label="Create" value={plan.create} tone="good" />
                <PlanTile label="Update" value={plan.update} tone="info" />
                <PlanTile label="Skip" value={plan.skip} tone="muted" />
                <PlanTile label="Errors" value={plan.error} tone="bad" />
              </div>
            )}

            <PreviewTable rows={parsed.rows} mode={duplicateMode} />

            {importing && (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full bg-brand transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <p className="text-[11px] text-neutral-500">
                  Writing to the database... {progress}%
                </p>
              </div>
            )}

            <div className="flex gap-3 border-t border-neutral-100 pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={resetState}
                className="flex-1 border-neutral-300 text-neutral-600"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Choose another file
              </Button>

              <Button
                type="button"
                disabled={importing || writeCount === 0}
                onClick={runImport}
                className={cn("flex-1", PRIMARY_BUTTON_CLASS)}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${writeCount} product${writeCount === 1 ? "" : "s"}`
                )}
              </Button>
            </div>
          </div>
        ) : (
          <UploadStep
            reading={reading}
            parseError={parseError}
            fileInputRef={fileInputRef}
            categories={categories}
            onFile={handleFile}
            onDownloadTemplate={handleDownloadTemplate}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/*
 * ---------------------------------------------------------
 * STEP 1 - UPLOAD
 * ---------------------------------------------------------
 */

interface UploadStepProps {
  reading: boolean;
  parseError: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  categories: ImportCategory[];
  onFile: (file: File) => void;
  onDownloadTemplate: () => void;
}

function UploadStep({
  reading,
  parseError,
  fileInputRef,
  categories,
  onFile,
  onDownloadTemplate,
}: UploadStepProps) {
  const [dragging, setDragging] = useState<boolean>(false);

  const noCategories = categories.length === 0;

  return (
    <div className="space-y-5">
      {noCategories && (
        <Notice tone="bad" icon={AlertTriangle}>
          There are no categories yet. Every product needs one, so create your categories before
          importing.
        </Notice>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);

          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors",
          dragging ? "border-brand bg-brand/5" : "border-neutral-200 bg-neutral-50"
        )}
      >
        {reading ? (
          <>
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-neutral-400" />
            <p className="text-sm font-semibold text-neutral-700">Reading file...</p>
          </>
        ) : (
          <>
            <FileSpreadsheet className="mb-3 h-8 w-8 text-neutral-300" />

            <p className="text-sm font-bold text-neutral-800">Drop a spreadsheet here</p>

            <p className="mt-1 text-xs text-neutral-500">
              {ACCEPTED_EXTENSIONS.join(", ")} - up to {MAX_IMPORT_ROWS} rows
            </p>

            <Button
              type="button"
              variant="outline"
              disabled={noCategories}
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 border-neutral-300 text-neutral-700"
            >
              <Upload className="mr-2 h-4 w-4" />
              Browse files
            </Button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </div>

      {parseError && (
        <Notice tone="bad" icon={XCircle}>
          {parseError}
        </Notice>
      )}

      {/* Column reference */}
      <div className="rounded-lg border border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h4 className={LABEL_CLASS}>Expected columns</h4>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDownloadTemplate}
            className="h-7 text-[11px] font-semibold text-brand-strong hover:bg-brand/5 hover:text-brand-strong"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download template
          </Button>
        </div>

        <ul className="divide-y divide-neutral-50">
          {IMPORT_COLUMNS.map((column) => (
            <li key={column.field} className="flex items-baseline gap-3 px-4 py-2 text-xs">
              <code className="w-36 shrink-0 font-mono text-[11px] text-neutral-700">
                {column.label}
              </code>

              <span
                className={cn(
                  "w-16 shrink-0 text-[10px] font-bold uppercase",
                  column.required ? "text-brand-strong" : "text-neutral-300"
                )}
              >
                {column.required ? "Required" : "Optional"}
              </span>

              <span className="truncate text-neutral-400">{column.example}</span>
            </li>
          ))}
        </ul>

        <p className="border-t border-neutral-100 px-4 py-3 text-[11px] leading-relaxed text-neutral-500">
          The first row must be the headings. <code>category</code> accepts either a category name
          or its slug, <code>slug</code> is generated from the name when left blank, and{" "}
          <code>featured</code> takes yes/no or true/false. Unknown columns are ignored.
        </p>
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * STEP 2 - PREVIEW
 * ---------------------------------------------------------
 */

function FileBadge({ fileName, onChange }: { fileName: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <FileSpreadsheet className="h-4 w-4 shrink-0 text-neutral-400" />
        <span className="truncate text-xs font-semibold text-neutral-700">{fileName}</span>
      </div>

      <button
        type="button"
        onClick={onChange}
        className="shrink-0 text-[11px] font-semibold text-neutral-400 hover:text-neutral-700"
      >
        Change
      </button>
    </div>
  );
}

function PreviewNotices({ parsed }: { parsed: ParsedSheet }) {
  const warningCount = parsed.rows.filter((row) => row.warnings.length > 0).length;

  return (
    <div className="space-y-2">
      {parsed.truncated && (
        <Notice tone="warn" icon={AlertTriangle}>
          Only the first {MAX_IMPORT_ROWS} rows were read. Split the rest into another file and
          import it after this one.
        </Notice>
      )}

      {parsed.ignoredColumns.length > 0 && (
        <Notice tone="muted" icon={AlertTriangle}>
          Ignored {parsed.ignoredColumns.length} unrecognised column
          {parsed.ignoredColumns.length === 1 ? "" : "s"}: {parsed.ignoredColumns.join(", ")}
        </Notice>
      )}

      {warningCount > 0 && (
        <Notice tone="warn" icon={AlertTriangle}>
          {warningCount} row{warningCount === 1 ? " has" : "s have"} a warning. These still import -
          hover the row to read the detail.
        </Notice>
      )}
    </div>
  );
}

function PlanTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "info" | "muted" | "bad";
}) {
  const tones = {
    good: "border-emerald-100 bg-emerald-50 text-emerald-700",
    info: "border-blue-100 bg-blue-50 text-blue-700",
    muted: "border-neutral-100 bg-neutral-50 text-neutral-500",
    bad: "border-red-100 bg-red-50 text-red-700",
  } as const;

  return (
    <div className={cn("rounded-lg border px-3 py-2.5", tones[tone])}>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}

const ACTION_STYLES: Record<ImportRowAction, string> = {
  create: "bg-emerald-50 text-emerald-700",
  update: "bg-blue-50 text-blue-700",
  skip: "bg-neutral-100 text-neutral-500",
  error: "bg-red-50 text-red-700",
};

function PreviewTable({ rows, mode }: { rows: ImportRow[]; mode: DuplicateMode }) {
  /*
   * Problem rows sort to the top - with a few hundred rows the
   * three that need fixing are the only ones worth scrolling to.
   */
  const ordered = useMemo(() => {
    const rank = (row: ImportRow): number => {
      if (row.values === null) return 0;
      if (row.warnings.length > 0) return 1;
      return 2;
    };

    return [...rows]
      .sort((a, b) => rank(a) - rank(b) || a.rowNumber - b.rowNumber)
      .slice(0, PREVIEW_LIMIT);
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-bold">Row</th>
              <th className="px-3 py-2 font-bold">Product</th>
              <th className="px-3 py-2 font-bold">Action</th>
              <th className="px-3 py-2 font-bold">Notes</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-50">
            {ordered.map((row) => {
              const action = rowAction(row, mode);
              const notes = [...row.errors, ...row.warnings];

              return (
                <tr key={row.rowNumber} className="align-top">
                  <td className="px-3 py-2 font-mono text-[10px] text-neutral-400">
                    {row.rowNumber}
                  </td>

                  <td className="px-3 py-2">
                    <div className="font-semibold text-neutral-800">
                      {row.name || <span className="text-neutral-300">-</span>}
                    </div>

                    {row.slug && (
                      <div className="font-mono text-[10px] text-neutral-400">{row.slug}</div>
                    )}

                    {/* What the multi-value cells actually parsed to. */}
                    {row.imageUrls.length + row.variants.length > 0 && (
                      <div className="text-[10px] text-neutral-400">
                        {[
                          row.imageUrls.length > 0 &&
                            `${row.imageUrls.length} image${row.imageUrls.length === 1 ? "" : "s"}`,
                          row.variants.length > 0 &&
                            `${row.variants.length} variant${row.variants.length === 1 ? "" : "s"}`,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                        ACTION_STYLES[action]
                      )}
                    >
                      {action}
                    </span>
                  </td>

                  <td className="px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
                    {notes.length > 0 ? notes.join(" ") : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > PREVIEW_LIMIT && (
        <p className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
          Showing {PREVIEW_LIMIT} of {rows.length} rows. All {rows.length} will be imported.
        </p>
      )}
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * STEP 3 - RESULT
 * ---------------------------------------------------------
 */

function ImportSummary({
  result,
  onImportAnother,
  onClose,
}: {
  result: ImportResult;
  onImportAnother: () => void;
  onClose: () => void;
}) {
  const clean = result.failures.length === 0 && result.invalid === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-neutral-50 p-8 text-center">
        {clean ? (
          <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />
        ) : (
          <AlertTriangle className="mb-3 h-9 w-9 text-amber-500" />
        )}

        <p className="text-sm font-bold text-neutral-800">
          {clean ? "Import complete" : "Import finished with issues"}
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          {result.created} created, {result.updated} updated, {result.skipped} skipped,{" "}
          {result.invalid} invalid.
        </p>
      </div>

      {result.failures.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-red-100">
          <h4 className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700">
            {result.failures.length} row
            {result.failures.length === 1 ? "" : "s"} could not be saved
          </h4>

          <ul className="max-h-60 divide-y divide-neutral-50 overflow-y-auto">
            {result.failures.map((failure, index) => (
              <li key={`${failure.rowNumber}-${index}`} className="px-4 py-2.5">
                <div className="text-xs font-semibold text-neutral-800">
                  Row {failure.rowNumber}
                  {failure.name ? ` - ${failure.name}` : ""}
                </div>

                <div className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
                  {failure.message}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 border-t border-neutral-100 pt-5">
        <Button
          type="button"
          variant="outline"
          onClick={onImportAnother}
          className="flex-1 border-neutral-300 text-neutral-600"
        >
          Import another file
        </Button>

        <Button type="button" onClick={onClose} className={cn("flex-1", PRIMARY_BUTTON_CLASS)}>
          Done
        </Button>
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * SHARED
 * ---------------------------------------------------------
 */

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: "bad" | "warn" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const tones = {
    bad: "border-red-100 bg-red-50 text-red-700",
    warn: "border-amber-100 bg-amber-50 text-amber-800",
    muted: "border-neutral-200 bg-neutral-50 text-neutral-600",
  } as const;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-xs leading-relaxed",
        tones[tone]
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
