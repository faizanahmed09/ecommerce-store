"use client";

/*
 * ---------------------------------------------------------
 * SHARED ADMIN UI
 * ---------------------------------------------------------
 *
 * Every admin page renders the same shell: a page header, a
 * filter bar, a panel with a table, badges and a form sheet.
 *
 * Keeping those primitives here is what makes the Dashboard,
 * Products, Categories and Orders screens line up with each
 * other instead of each page inventing its own spacing,
 * colours and status labels.
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Badge } from "@/src/app/components/ui/badge";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/app/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/app/components/ui/sheet";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import { cn } from "@/src/app/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type React from "react";

/*
 * ---------------------------------------------------------
 * DESIGN TOKENS
 * ---------------------------------------------------------
 */

export const ACCENT = "#F97316";

export const PRIMARY_BUTTON_CLASS = "bg-brand text-brand-foreground hover:bg-brand-strong";

export const PANEL_CLASS =
  "overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm";

export const FILTER_BAR_CLASS =
  "flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm md:flex-row md:items-center";

export const LABEL_CLASS = "text-xs font-bold text-neutral-700";

export const INPUT_CLASS = "border-neutral-200";

export const TD_CLASS = "px-6 py-4 align-middle";

/*
 * ---------------------------------------------------------
 * STATUS VOCABULARY (mirrors schema.sql)
 * ---------------------------------------------------------
 *
 * orders.status         VARCHAR(50) DEFAULT 'pending'
 * orders.payment_status VARCHAR(50) DEFAULT 'pending'
 */

export const ORDER_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const PAYMENT_STATUSES = [
  { value: "pending", label: "Unpaid / Pending" },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
] as const;

/*
 * orders.payment_method VARCHAR(50)
 */
export const PAYMENT_METHODS = [
  { value: "cod", label: "Cash on Delivery" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
] as const;

/*
 * ---------------------------------------------------------
 * FORMATTERS
 * ---------------------------------------------------------
 */

/* Shared with the storefront so both render prices identically. */
export { formatCurrency } from "@/src/app/lib/utils";

export const formatDate = (value: string | null): string => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/*
 * Orders are identified by a UUID. The admin only ever needs
 * the readable prefix.
 */
/*
 * The same number the customer was given on their confirmation
 * and types into /track-order. Support reading a different
 * string off the admin than the one in front of the customer is
 * how a five-minute call becomes a twenty-minute one.
 */
export { toOrderNumber as formatOrderId } from "@/src/app/lib/order-number";

export const titleCase = (value: string): string =>
  value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "An unexpected error occurred.";
};

/*
 * Lives in lib/utils so non-React code (the bulk importer's
 * parser) can slugify without pulling in this component file.
 */
export { generateSlug } from "@/src/app/lib/utils";

/*
 * ---------------------------------------------------------
 * PAGE HEADER
 * ---------------------------------------------------------
 */

interface PageHeaderProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">{title}</h1>

        <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
      </div>

      {children ? (
        <div className="flex items-center gap-3 self-start sm:self-auto">{children}</div>
      ) : null}
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * REFRESH BUTTON
 * ---------------------------------------------------------
 */

interface RefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function RefreshButton({ onClick, loading = false }: RefreshButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 border-neutral-300 text-neutral-600 hover:bg-neutral-50"
    >
      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      Refresh
    </Button>
  );
}

/*
 * ---------------------------------------------------------
 * TABLE
 * ---------------------------------------------------------
 */

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  className?: string;
}

interface AdminTableProps {
  columns: TableColumn[];
  children: React.ReactNode;
}

export function AdminTable({ columns, children }: AdminTableProps) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-neutral-100 bg-neutral-50/60">
          {columns.map((column) => (
            <th
              key={column.key}
              className={cn(
                "px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400",
                column.align === "right" && "text-right",
                column.className
              )}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-neutral-100 text-sm">{children}</tbody>
    </table>
  );
}

/*
 * ---------------------------------------------------------
 * TABLE SKELETON
 * ---------------------------------------------------------
 */

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  const widths = ["w-24", "w-40", "w-20", "w-28", "w-16", "w-24", "w-20"];

  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-6">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn("h-4", widths[columnIndex % widths.length])}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * EMPTY STATE
 * ---------------------------------------------------------
 */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  bordered?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  bordered = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center",
        bordered && "rounded-xl border border-dashed border-neutral-200 bg-white"
      )}
    >
      <Icon className="mb-3 h-12 w-12 text-neutral-300" />

      <p className="text-sm font-semibold text-neutral-500">{title}</p>

      <p className="mt-1 text-xs text-neutral-400">{description}</p>

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * BADGES
 * ---------------------------------------------------------
 *
 * One badge implementation per concept so the Dashboard and
 * the Orders table never disagree about what "shipped" looks
 * like.
 */

const BADGE_BASE =
  "flex w-fit items-center gap-1 border text-[10px] font-bold uppercase tracking-wide";

const ORDER_STATUS_STYLES: Record<string, string> = {
  delivered: "border-green-200 bg-green-50 text-green-700 hover:bg-green-50",
  shipped: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50",
  processing: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
  pending: "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-50",
  cancelled: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
};

export function StatusBadge({ status }: { status: string | null }) {
  const value = (status ?? "pending").toLowerCase();

  const style = ORDER_STATUS_STYLES[value] ?? ORDER_STATUS_STYLES.pending;

  const label = ORDER_STATUSES.find((option) => option.value === value)?.label ?? titleCase(value);

  return <Badge className={cn(BADGE_BASE, style)}>{label}</Badge>;
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  refunded: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
  failed: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
  pending: "border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-50",
};

export function PaymentBadge({ status }: { status: string | null }) {
  const value = (status ?? "pending").toLowerCase();

  const style = PAYMENT_STATUS_STYLES[value] ?? PAYMENT_STATUS_STYLES.pending;

  const label = value === "pending" ? "Unpaid" : titleCase(value);

  return <Badge className={cn(BADGE_BASE, style)}>{label}</Badge>;
}

/*
 * Stock thresholds are shared with the Products stock filter.
 */
export const LOW_STOCK_THRESHOLD = 10;

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <Badge className={cn(BADGE_BASE, "border-red-200 bg-red-50 text-red-700 hover:bg-red-50")}>
        <XCircle className="h-3 w-3 text-red-500" />
        Out of Stock
      </Badge>
    );
  }

  if (stock < LOW_STOCK_THRESHOLD) {
    return (
      <Badge
        className={cn(BADGE_BASE, "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50")}
      >
        <AlertTriangle className="h-3 w-3 text-amber-500" />
        Low Stock ({stock})
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(BADGE_BASE, "border-green-200 bg-green-50 text-green-700 hover:bg-green-50")}
    >
      <CheckCircle className="h-3 w-3 text-green-500" />
      In Stock ({stock})
    </Badge>
  );
}

/*
 * ---------------------------------------------------------
 * SHEET FORM FOOTER
 * ---------------------------------------------------------
 */

interface FormActionsProps {
  saving: boolean;
  submitLabel: string;
  savingLabel: string;
  onCancel: () => void;
}

export function FormActions({ saving, submitLabel, savingLabel, onCancel }: FormActionsProps) {
  return (
    <div className="mt-8 flex gap-3 border-t border-neutral-100 pt-6">
      <Button
        type="button"
        variant="outline"
        disabled={saving}
        onClick={onCancel}
        className="flex-1 border-neutral-300 text-neutral-600"
      >
        Cancel
      </Button>

      <Button type="submit" disabled={saving} className={cn("flex-1", PRIMARY_BUTTON_CLASS)}>
        {saving ? savingLabel : submitLabel}
      </Button>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * FILTER BAR CONTROLS
 * ---------------------------------------------------------
 *
 * Products, Orders and Categories all render the same
 * "search box + a couple of dropdowns" bar, so the bar and
 * its controls live here rather than three times over.
 */

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />

      <Input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(INPUT_CLASS, "pl-9")}
      />
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  /* Label for the catch-all "all" entry prepended to the list. */
  allLabel: string;
  options: readonly SelectOption[];
}

export function FilterSelect({ value, onChange, allLabel, options }: FilterSelectProps) {
  return (
    <div className="w-full md:w-48">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={INPUT_CLASS}>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>

          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * FORM FIELD
 * ---------------------------------------------------------
 *
 * Label + control + the red asterisk, so every field in every
 * admin sheet gets the same spacing and type treatment.
 */

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function FormField({ id, label, required = false, icon: Icon, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn(LABEL_CLASS, Icon && "flex items-center gap-1")}>
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>

      {children}
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * FORM SHEET
 * ---------------------------------------------------------
 *
 * The slide-over used by every create/edit flow in the admin.
 */

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: string;
  /* Order management needs a wider panel than the CRUD forms. */
  wide?: boolean;
  children: React.ReactNode;
}

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  wide = false,
  children,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn("w-full overflow-y-auto bg-white", wide ? "sm:max-w-xl" : "sm:max-w-lg")}
      >
        <SheetHeader className="mb-6 border-b border-neutral-100 pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg font-bold text-neutral-900">
            {title}
          </SheetTitle>

          <SheetDescription className="text-xs text-neutral-400">{description}</SheetDescription>
        </SheetHeader>

        {children}
      </SheetContent>
    </Sheet>
  );
}

/*
 * ---------------------------------------------------------
 * PANEL / TABLE STATES
 * ---------------------------------------------------------
 *
 * Loading skeleton, empty state and table share one wrapper so
 * a page body reads as data rather than as three branches of
 * near-identical markup.
 */

interface DataPanelProps<T> {
  loading: boolean;
  rows: T[];
  /* Distinguishes "nothing here yet" from "nothing matched". */
  totalRows: number;
  columns: TableColumn[];
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  filteredTitle: string;
  filteredDescription: string;
  renderRow: (row: T) => React.ReactNode;
}

export function DataPanel<T>({
  loading,
  rows,
  totalRows,
  columns,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  filteredTitle,
  filteredDescription,
  renderRow,
}: DataPanelProps<T>) {
  return (
    <div className={PANEL_CLASS}>
      <div className="overflow-x-auto">
        {loading ? (
          <TableSkeleton rows={5} columns={columns.length} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title={totalRows === 0 ? emptyTitle : filteredTitle}
            description={totalRows === 0 ? emptyDescription : filteredDescription}
          />
        ) : (
          <AdminTable columns={columns}>{rows.map(renderRow)}</AdminTable>
        )}
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * CONFIRM DIALOG
 * ---------------------------------------------------------
 *
 * Deletes used to go through window.confirm, which the browser
 * silently suppresses once the user ticks "prevent this page
 * from creating additional dialogs" - the click then does
 * nothing at all. This is the same modal primitive the sheets
 * are built on, so it cannot be switched off.
 */

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmingLabel: string;
  /* True while the action runs: the dialog locks open. */
  confirming: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmingLabel,
  confirming,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (confirming) {
          return;
        }

        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-200 bg-white p-6 shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-50 p-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>

            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-bold text-neutral-900">
                {title}
              </DialogPrimitive.Title>

              <DialogPrimitive.Description className="mt-1 text-sm text-neutral-500">
                {description}
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={confirming}
              onClick={() => onOpenChange(false)}
              className="flex-1 border-neutral-300 text-neutral-600"
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={confirming}
              onClick={onConfirm}
              className="flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {confirming ? confirmingLabel : confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/*
 * ---------------------------------------------------------
 * SUPABASE RELATIONS
 * ---------------------------------------------------------
 *
 * Embedded relations come back as an object or, for some query
 * shapes, a single-element array.
 */

export const firstRelation = <T,>(relation: T | T[] | null | undefined): T | null => {
  if (!relation) {
    return null;
  }

  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
};
