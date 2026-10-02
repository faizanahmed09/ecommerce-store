"use client";

/*
 * ---------------------------------------------------------
 * CATEGORY CARD
 * ---------------------------------------------------------
 *
 * One top-level category and its children. Presentation only:
 * every action is handed up to the screen.
 */

import { Button } from "@/src/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/app/components/ui/card";
import type { CategoryRecord } from "@/src/app/lib/categories";
import { ChevronRight, Edit2, FolderTree, Plus } from "lucide-react";

interface CategoryCardProps {
  category: CategoryRecord;
  subcategories: CategoryRecord[];
  togglingId: string | null;
  onEdit: (category: CategoryRecord) => void;
  onToggle: (category: CategoryRecord) => void;
  onAddSubcategory: (parentId: string) => void;
}

function VisibilitySwitch({
  category,
  togglingId,
  onToggle,
}: Pick<CategoryCardProps, "category" | "togglingId" | "onToggle">) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={category.is_enabled}
      aria-label={`Show ${category.name} on storefront`}
      disabled={togglingId !== null}
      onClick={() => onToggle(category)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${category.is_enabled ? "bg-emerald-600" : "bg-neutral-300"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${category.is_enabled ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

export function CategoryCard({
  category,
  subcategories,
  togglingId,
  onEdit,
  onToggle,
  onAddSubcategory,
}: CategoryCardProps) {
  return (
    <Card className="flex flex-col justify-between overflow-hidden border-neutral-200 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md">
      <div>
        <CardHeader className="flex flex-row items-center justify-between border-b border-neutral-100 bg-neutral-50/50 pb-3">
          <div className="flex items-center gap-2">
            <FolderTree className="h-[18px] w-[18px] text-brand-strong" />

            <div>
              <CardTitle className="text-sm font-bold text-neutral-800">{category.name}</CardTitle>
              <span
                className={
                  category.is_enabled
                    ? "text-[10px] text-emerald-700"
                    : "text-[10px] text-neutral-500"
                }
              >
                {category.is_enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          <div className="flex gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onEdit(category)}
              className="h-7 w-7 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              title="Edit category"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span className="sr-only">Edit {category.name}</span>
            </Button>

            <VisibilitySwitch category={category} togglingId={togglingId} onToggle={onToggle} />
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="mb-4">
            <span className="rounded border bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
              /{category.slug}
            </span>

            {category.description && (
              <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{category.description}</p>
            )}
          </div>

          <div className="mt-4 border-t border-neutral-100 pt-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Subcategories ({subcategories.length})
            </span>

            {subcategories.length === 0 ? (
              <p className="mt-1.5 text-xs italic text-neutral-400">No subcategories linked</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {subcategories.map((sub) => (
                  <div
                    key={sub.id}
                    className="group flex items-center justify-between rounded border border-transparent p-1.5 transition-all hover:border-neutral-100 hover:bg-neutral-50"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" />

                      <span className="truncate text-xs font-semibold text-neutral-700">
                        {sub.name}
                      </span>

                      {!sub.is_enabled || !category.is_enabled ? (
                        <span className="text-[10px] text-neutral-500">
                          {!category.is_enabled && sub.is_enabled ? "Hidden by parent" : "Disabled"}
                        </span>
                      ) : null}

                      <span className="hidden truncate font-mono text-[9px] text-neutral-400 sm:inline">
                        ({sub.slug})
                      </span>
                    </div>

                    <div className="flex gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(sub)}
                        className="h-6 w-6 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                        title="Edit subcategory"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span className="sr-only">Edit {sub.name}</span>
                      </Button>

                      <VisibilitySwitch category={sub} togglingId={togglingId} onToggle={onToggle} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </div>

      <div className="border-t border-neutral-100 bg-neutral-50/40 p-3 text-center">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onAddSubcategory(category.id)}
          className="h-7 w-full gap-1 text-xs font-bold text-neutral-500 hover:bg-neutral-50 hover:text-brand-strong"
        >
          <Plus className="h-3 w-3" />
          Add Subcategory
        </Button>
      </div>
    </Card>
  );
}
