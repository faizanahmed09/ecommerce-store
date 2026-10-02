"use client";

/*
 * ---------------------------------------------------------
 * PRODUCTS TABLE COLUMNS
 * ---------------------------------------------------------
 *
 * The same cells product-row.tsx rendered, as column
 * definitions instead of a hand-written <tr>. Stating them
 * this way is what lets the table sort, hide and paginate
 * them: a header is no longer a string in a list somewhere
 * else that has to be kept in step with the row's markup.
 *
 * `sortingFn` is spelled out where the display value is not
 * what you would sort by - the price column shows the sale
 * price but has to sort on what a customer actually pays.
 */

import { Badge } from "@/src/app/components/ui/badge";
import { Button } from "@/src/app/components/ui/button";
import { safeImageSrc } from "@/src/app/lib/utils";
import { Edit2, Image as ImageIcon, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { selectionColumn, type AdminColumnDef } from "../components/data-table";
import { formatCurrency, StockBadge } from "../components/admin-ui";
import { primaryImageOf, type Product } from "./types";

/* Thumbnails that 404 fall back to the placeholder icon. */
function ProductThumbnail({ product }: { product: Product }) {
  const [broken, setBroken] = useState(false);

  const image = primaryImageOf(product);

  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50">
      {image && !broken ? (
        <Image
          src={safeImageSrc(image.image_url)}
          alt={product.name}
          fill
          sizes="44px"
          className="object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <ImageIcon className="h-5 w-5 text-neutral-300" />
      )}
    </div>
  );
}

/* What a customer pays, which is what the price column sorts on. */
const effectivePrice = (product: Product): number =>
  product.sale_price !== null ? product.sale_price : product.price;

interface ProductColumnActions {
  deletingId: string | null;
  togglingId: string | null;
  onEdit: (product: Product) => void;
  onDelete: (id: string, name: string) => void;
  onToggle: (product: Product) => void;
}

export function productColumns({
  deletingId,
  togglingId,
  onEdit,
  onDelete,
  onToggle,
}: ProductColumnActions): AdminColumnDef<Product>[] {
  return [
    selectionColumn<Product>(),

    {
      id: "product",
      accessorFn: (product) => product.name,
      header: "Product",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <ProductThumbnail product={row.original} />

          <div>
            <div className="font-bold leading-tight text-neutral-800">{row.original.name}</div>

            <div className="mt-0.5 font-mono text-[10px] text-neutral-400">{row.original.slug}</div>
            {!row.original.is_enabled && (
              <div className="mt-0.5 text-[10px] text-neutral-500">Disabled</div>
            )}
          </div>
        </div>
      ),
    },

    {
      id: "category",
      accessorFn: (product) => product.categories?.name ?? "Uncategorized",
      header: "Category",
      cell: ({ getValue }) => <span className="text-neutral-600">{getValue<string>()}</span>,
    },

    {
      id: "price",
      accessorFn: effectivePrice,
      header: "Price",
      cell: ({ row }) =>
        row.original.sale_price !== null ? (
          <div className="flex flex-col">
            <span className="font-bold text-brand-strong">
              {formatCurrency(row.original.sale_price)}
            </span>

            <span className="text-[10px] text-neutral-400 line-through">
              {formatCurrency(row.original.price)}
            </span>
          </div>
        ) : (
          <span className="font-bold text-neutral-800">{formatCurrency(row.original.price)}</span>
        ),
    },

    {
      id: "stock",
      accessorFn: (product) => product.stock_quantity,
      header: "Stock",
      cell: ({ row }) => <StockBadge stock={row.original.stock_quantity} />,
    },

    {
      id: "featured",
      accessorFn: (product) => product.featured,
      header: "Featured",
      cell: ({ row }) =>
        row.original.featured ? (
          <Badge className="border-none bg-brand/10 text-[9px] font-bold text-brand-strong hover:bg-brand/15">
            FEATURED
          </Badge>
        ) : (
          <span className="text-xs text-neutral-300">-</span>
        ),
    },

    {
      id: "visibility",
      accessorFn: (product) => product.is_enabled,
      header: "Visible",
      cell: ({ row }) => (
        <button
          type="button"
          role="switch"
          aria-checked={row.original.is_enabled}
          aria-label={`Show ${row.original.name} on storefront`}
          disabled={togglingId !== null}
          onClick={() => onToggle(row.original)}
          className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${row.original.is_enabled ? "bg-emerald-600" : "bg-neutral-300"}`}
        >
          <span
            aria-hidden="true"
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${row.original.is_enabled ? "translate-x-4" : "translate-x-0"}`}
          />
        </button>
      ),
    },

    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      enableHiding: false,
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="space-x-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEdit(row.original)}
            className="h-8 w-8 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Edit2 className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={deletingId === row.original.id}
            onClick={() => onDelete(row.original.id, row.original.name)}
            className="h-8 w-8 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      ),
    },
  ];
}
