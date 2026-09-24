"use client";

/*
 * ---------------------------------------------------------
 * ADMIN / PRODUCTS
 * ---------------------------------------------------------
 *
 * Composition only. The data lives in use-products, the write
 * paths in queries.ts, and the sheets own their own state.
 */

import { Button } from "@/src/app/components/ui/button";
import { cn } from "@/src/app/lib/utils";
import { PackageOpen, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ConfirmDialog,
  FILTER_BAR_CLASS,
  FilterSelect,
  LOW_STOCK_THRESHOLD,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  RefreshButton,
  SearchInput,
} from "../components/admin-ui";
import { DataTable } from "../components/data-table";
import { productColumns } from "./columns";
import { ProductImportSheet } from "./import-sheet";
import { ProductFormSheet } from "./product-form-sheet";
import type { Product, StockFilter } from "./types";
import { useProducts } from "./use-products";

const STOCK_OPTIONS = [
  { value: "in", label: `In Stock (${LOW_STOCK_THRESHOLD}+)` },
  { value: "low", label: `Low Stock (<${LOW_STOCK_THRESHOLD})` },
  { value: "out", label: "Out of Stock (0)" },
];

export default function AdminProductsPage() {
  const {
    products,
    categories,
    filteredProducts,
    loading,
    deletingId,
    pendingDelete,
    loadData,
    requestDelete,
    confirmDelete,
    cancelDelete,
    pendingBulkDelete,
    bulkDeleting,
    requestBulkDelete,
    confirmBulkDelete,
    cancelBulkDelete,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    stockFilter,
    setStockFilter,
  } = useProducts();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const openForm = (product: Product | null): void => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const columns = useMemo(
    () =>
      productColumns({
        deletingId,
        onEdit: openForm,
        onDelete: requestDelete,
      }),
    [deletingId, requestDelete]
  );

  const handleFormOpenChange = (open: boolean): void => {
    setIsFormOpen(open);

    if (!open) {
      setEditingProduct(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description="Create, update, and manage your inventory items.">
        <RefreshButton onClick={loadData} loading={loading} />

        <Button
          type="button"
          variant="outline"
          onClick={() => setIsImportOpen(true)}
          disabled={loading}
          className="flex items-center gap-2 border-neutral-300 text-neutral-700"
        >
          <Upload className="h-4 w-4" />
          Bulk Import
        </Button>

        <Button
          type="button"
          onClick={() => openForm(null)}
          className={cn("flex items-center gap-2", PRIMARY_BUTTON_CLASS)}
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </PageHeader>

      <div className={FILTER_BAR_CLASS}>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name or slug..."
        />

        <FilterSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          allLabel="All Categories"
          options={categories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
        />

        <FilterSelect
          value={stockFilter}
          onChange={(value) => setStockFilter(value as StockFilter)}
          allLabel="All Stock Status"
          options={STOCK_OPTIONS}
        />
      </div>

      <DataTable
        loading={loading}
        rows={filteredProducts}
        totalRows={products.length}
        columns={columns}
        getRowId={(product) => product.id}
        emptyIcon={PackageOpen}
        emptyTitle="No products yet."
        emptyDescription="Create your first product to start selling."
        filteredTitle="No products match your filters."
        filteredDescription="Try changing your filters or create a new product."
        renderSelectionActions={(selected, clearSelection) => (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => requestBulkDelete(selected)}
              className="h-7 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected
            </Button>

            <button
              type="button"
              onClick={clearSelection}
              className="text-xs underline underline-offset-2 hover:text-neutral-700"
            >
              Clear
            </button>
          </>
        )}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            cancelDelete();
          }
        }}
        title="Delete product"
        description={`"${pendingDelete?.name ?? ""}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete product"
        confirmingLabel="Deleting..."
        confirming={deletingId !== null}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={pendingBulkDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            cancelBulkDelete();
          }
        }}
        title={`Delete ${pendingBulkDelete?.length ?? 0} products`}
        description={`${pendingBulkDelete?.length ?? 0} selected products will be permanently deleted, along with their images. This cannot be undone.`}
        confirmLabel="Delete selected"
        confirmingLabel="Deleting..."
        confirming={bulkDeleting}
        onConfirm={confirmBulkDelete}
      />

      <ProductImportSheet
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        categories={categories}
        existingProducts={products}
        onImported={loadData}
      />

      <ProductFormSheet
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        product={editingProduct}
        categories={categories}
        existingProducts={products}
        onSaved={loadData}
      />
    </div>
  );
}
