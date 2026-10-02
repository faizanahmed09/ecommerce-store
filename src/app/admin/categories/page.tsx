"use client";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/src/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/src/app/components/ui/card";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import {
  createCategory,
  setCategoryEnabled,
  updateCategory,
  type CategoryPayload,
  type CategoryRecord,
} from "@/src/app/lib/categories";
import { cn } from "@/src/app/lib/utils";
import { useInvalidateProducts } from "@/src/app/lib/use-product-list";
import { FolderOpen, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  EmptyState,
  getErrorMessage,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  RefreshButton,
} from "../components/admin-ui";
import { useCategories } from "../lib/use-categories";
import { removeImage } from "../lib/storage";
import { CategoryCard } from "./category-card";
import { CategoryFormSheet } from "./category-form-sheet";
import type { ValidationError } from "./category-form";

export default function AdminCategoriesPage() {
  const { toast } = useToast();

  const { categories, loading, reload: loadCategories } = useCategories();
  const invalidateProducts = useInvalidateProducts();

  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const [presetParentId, setPresetParentId] = useState<string | null>(null);

  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => Number(b.is_enabled) - Number(a.is_enabled)),
    [categories]
  );

  const parentCategories = useMemo(
    () => orderedCategories.filter((category) => !category.parent_id),
    [orderedCategories]
  );

  const childrenByParent = useMemo(() => {
    const groups = new Map<string, CategoryRecord[]>();

    for (const category of orderedCategories) {
      if (!category.parent_id) {
        continue;
      }

      const siblings = groups.get(category.parent_id);

      if (siblings) {
        siblings.push(category);
      } else {
        groups.set(category.parent_id, [category]);
      }
    }

    return groups;
  }, [orderedCategories]);

  const openCreate = (parentId: string | null = null) => {
    setEditing(null);
    setPresetParentId(parentId);
    setIsFormOpen(true);
  };

  const openEdit = (category: CategoryRecord) => {
    setEditing(category);
    setPresetParentId(null);
    setIsFormOpen(true);
  };

  /* A save in flight must not be interrupted by a stray close. */
  const handleOpenChange = (open: boolean) => {
    if (saving) {
      return;
    }

    setIsFormOpen(open);
  };

  const handleInvalid = (error: ValidationError) => {
    toast({
      title: error.title,
      description: error.description,
      variant: "destructive",
    });
  };

  const handleSubmit = async (payload: CategoryPayload) => {
    setSaving(true);

    try {
      if (editing) {
        await updateCategory(editing.id, payload);
      } else {
        await createCategory(payload);
      }

      /*
       * The row points elsewhere now, so the file it replaced is
       * dead weight. Cleanup never fails the save.
       */
      if (editing?.image_url && editing.image_url !== payload.image_url) {
        await removeImage(editing.image_url);
      }

      toast({
        title: editing ? "Category updated" : "Category created",
        description: `"${payload.name}" has been saved successfully.`,
      });

      loadCategories();

      /* Close only on success, so a failure keeps the input. */
      setIsFormOpen(false);
    } catch (error: unknown) {
      console.error("Category save error:", error);

      toast({
        title: editing ? "Update failed" : "Creation failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (category: CategoryRecord) => {
    if (togglingId) {
      return;
    }

    const nextEnabled = !category.is_enabled;
    setTogglingId(category.id);

    try {
      await setCategoryEnabled(category.id, nextEnabled);
      await invalidateProducts();

      toast({
        title: nextEnabled ? "Category enabled" : "Category disabled",
        description: nextEnabled
          ? `"${category.name}" is visible again. Re-enable its subcategories separately if needed.`
          : `"${category.name}", its subcategories, and their products are hidden from shoppers.`,
      });

      loadCategories();
    } catch (error: unknown) {
      console.error("Category visibility error:", error);

      toast({
        title: "Visibility update failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organize categories and enable or disable them without deleting their products."
      >
        <RefreshButton onClick={loadCategories} loading={loading} />

        <Button
          type="button"
          onClick={() => openCreate()}
          disabled={saving}
          className={cn("flex items-center gap-2", PRIMARY_BUTTON_CLASS)}
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </PageHeader>

      {loading && categories.length === 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="border-neutral-200 shadow-sm">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-24" />
              </CardHeader>

              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : parentCategories.length === 0 ? (
        <EmptyState
          bordered
          icon={FolderOpen}
          title="No categories defined yet."
          description="Get started by creating a top-level category."
          action={
            <Button type="button" onClick={() => openCreate()} className={PRIMARY_BUTTON_CLASS}>
              <Plus className="mr-2 h-4 w-4" />
              Create Category
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {parentCategories.map((parent) => (
            <CategoryCard
              key={parent.id}
              category={parent}
              subcategories={childrenByParent.get(parent.id) ?? []}
              togglingId={togglingId}
              onEdit={openEdit}
              onToggle={handleToggle}
              onAddSubcategory={openCreate}
            />
          ))}
        </div>
      )}

      <CategoryFormSheet
        open={isFormOpen}
        onOpenChange={handleOpenChange}
        editing={editing}
        presetParentId={presetParentId}
        categories={categories}
        saving={saving}
        onInvalid={handleInvalid}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
