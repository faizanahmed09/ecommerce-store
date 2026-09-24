"use client";

/*
 * ---------------------------------------------------------
 * ADMIN DATA TABLE
 * ---------------------------------------------------------
 *
 * DataPanel renders every row it is given, which is fine for a
 * short list and unusable once the catalogue grows: a thousand
 * products meant a thousand <tr> and no way to sort them.
 *
 * This is the same panel driven by TanStack Table (v9), which
 * owns sorting, pagination, column visibility and row
 * selection. It is headless - it computes which rows to show
 * and this file renders them - so the markup and the styling
 * stay the admin's own.
 *
 * The page above still owns searching and filtering, because
 * those are shared with the filter bar and the URL; whatever
 * rows it passes in are what this paginates.
 */

import { Button } from "@/src/app/components/ui/button";
import { Checkbox } from "@/src/app/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/app/components/ui/dropdown-menu";
import { cn } from "@/src/app/lib/utils";
import {
  columnVisibilityFeature,
  createCoreRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  useTable,
  type CellData,
  type ColumnDef,
  type RowData,
  type TableFeatures,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { EmptyState, PANEL_CLASS, TableSkeleton } from "./admin-ui";

/*
 * The feature set is explicit in v9: a table only carries the
 * state and the APIs for the features registered here, and the
 * row models are the pipeline those features run.
 */
const FEATURES = {
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
};

/*
 * ColumnMeta ships empty for exactly this: per-column knobs the
 * library does not define. `align` is the only one the admin
 * needs - the actions column sits right.
 */
/*
 * The three parameters are not optional, and cannot be renamed
 * to the underscore convention either: TypeScript requires a
 * merged interface to declare *identical* type parameters,
 * names included, even though `align` uses none of them.
 *
 * Disabled as a block rather than with a next-line comment,
 * which sat on the `interface` line until a reformat split the
 * generics onto their own lines and left it pointing at
 * nothing.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
declare module "@tanstack/react-table" {
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    align?: "left" | "right";
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export const PAGE_SIZES = [10, 25, 50, 100];

/*
 * Columns are always defined against this feature set, so call
 * sites name the row type and nothing else.
 */
export type AdminColumnDef<TData extends RowData> = ColumnDef<typeof FEATURES, TData>;

interface DataTableProps<TData extends RowData> {
  columns: AdminColumnDef<TData>[];
  rows: TData[];
  loading: boolean;
  /* Rows before the page's own search and filters ran. */
  totalRows: number;

  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  filteredTitle: string;
  filteredDescription: string;

  /* Stable row identity, so selection survives a re-sort. */
  getRowId: (row: TData) => string;
  initialPageSize?: number;
  /* Column to sort by before the admin touches a header. */
  initialSorting?: { id: string; desc: boolean }[];
  /* Rendered beside the row count when rows are selected. */
  renderSelectionActions?: (rows: TData[], clear: () => void) => React.ReactNode;
}

export function DataTable<TData extends RowData>({
  columns,
  rows,
  loading,
  totalRows,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  filteredTitle,
  filteredDescription,
  getRowId,
  initialPageSize = PAGE_SIZES[0],
  initialSorting,
  renderSelectionActions,
}: DataTableProps<TData>) {
  const table = useTable({
    features: FEATURES,
    data: rows,
    columns,
    getRowId,
    initialState: {
      pagination: { pageIndex: 0, pageSize: initialPageSize },
      sorting: initialSorting,
    },
    /*
     * Filtering happens above this component, so a change to
     * `rows` is a new result set - page 1 is where it belongs.
     */
    autoResetPageIndex: true,
  });

  const { pageIndex, pageSize } = table.state.pagination;

  const selectedRows = useMemo(
    () => table.getSelectedRowModel().rows.map((row) => row.original),
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the selection, which the table re-derives */
    [table, table.state.rowSelection]
  );

  const rowCount = table.getRowCount();
  const firstOnPage = rowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastOnPage = Math.min((pageIndex + 1) * pageSize, rowCount);

  if (loading) {
    return (
      <div className={PANEL_CLASS}>
        <TableSkeleton rows={5} columns={columns.length} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={PANEL_CLASS}>
        <EmptyState
          icon={emptyIcon}
          title={totalRows === 0 ? emptyTitle : filteredTitle}
          description={totalRows === 0 ? emptyDescription : filteredDescription}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: selection actions on the left, columns on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          {selectedRows.length > 0 ? (
            <>
              <span className="font-semibold text-neutral-700">{selectedRows.length} selected</span>

              {renderSelectionActions?.(selectedRows, () => table.resetRowSelection())}
            </>
          ) : (
            <span>
              Showing {firstOnPage}-{lastOnPage} of {rowCount}
            </span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-2 border-neutral-300 text-xs text-neutral-700"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs">Toggle columns</DropdownMenuLabel>

            <DropdownMenuSeparator />

            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="text-xs capitalize"
                  checked={column.getIsVisible()}
                  /* Radix would close the menu on every toggle. */
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={PANEL_CLASS}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-neutral-100 bg-neutral-50/60">
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();

                    return (
                      <th
                        key={header.id}
                        className={cn(
                          "px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400",
                          header.column.columnDef.meta?.align === "right" && "text-right"
                        )}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-neutral-700"
                          >
                            <table.FlexRender header={header} />

                            {sorted === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-neutral-100 text-sm">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="transition-colors hover:bg-neutral-50/50 data-[state=selected]:bg-[#FF3D6E]/5"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-6 py-4 align-middle",
                        cell.column.columnDef.meta?.align === "right" && "text-right"
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>

          <select
            value={pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-700 outline-none focus:border-neutral-400"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span>
            Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>

          <div className="flex items-center gap-1">
            <PageButton
              label="First page"
              icon={ChevronsLeft}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.firstPage()}
            />
            <PageButton
              label="Previous page"
              icon={ChevronLeft}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            />
            <PageButton
              label="Next page"
              icon={ChevronRight}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            />
            <PageButton
              label="Last page"
              icon={ChevronsRight}
              disabled={!table.getCanNextPage()}
              onClick={() => table.lastPage()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PageButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 border-neutral-200 text-neutral-600 disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

/*
 * The leading checkbox column, identical wherever selection is
 * on, so no page has to hand-roll it.
 */
export function selectionColumn<TData extends RowData>(): AdminColumnDef<TData> {
  return {
    id: "select",
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all rows on this page"
        className="translate-y-[1px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={`Select row`}
        className="translate-y-[1px]"
      />
    ),
  };
}
