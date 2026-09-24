"use client";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/src/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/src/app/components/ui/card";
import { Skeleton } from "@/src/app/components/ui/skeleton";
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type CategoryPayload,
  type CategoryRecord,
} from "@/src/app/lib/categories";
import { cn } from "@/src/app/lib/utils";
import { FolderOpen, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ConfirmDialog,
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

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const [presetParentId, setPresetParentId] = useState<string | null>(null);

  /* The category the confirm dialog is open for, if any. */
  const [pendingDelete, setPendingDelete] = useState<CategoryRecord | null>(null);

  const parentCategories = useMemo(
    () => categories.filter((category) => !category.parent_id),
    [categories]
  );

  const childrenByParent = useMemo(() => {
    const groups = new Map<string, CategoryRecord[]>();

    for (const category of categories) {
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
  }, [categories]);

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

  /*
   * The card asks, the dialog confirms. Only the check that
   * would make the delete impossible runs here, so the admin is
   * not shown a modal for something that cannot happen.
   */
  const requestDelete = (category: CategoryRecord) => {
    if (deletingId) {
      return;
    }

    /*
     * Deleting a parent would orphan its children behind a
     * foreign key, so the admin has to empty it first.
     */
    if ((childrenByParent.get(category.id)?.length ?? 0) > 0) {
      toast({
        title: "Cannot delete category",
        description: `"${category.name}" contains subcategories. Delete or move them first.`,
        variant: "destructive",
      });

      return;
    }

    setPendingDelete(category);
  };

  const handleDelete = async () => {
    if (!pendingDelete || deletingId) {
      return;
    }

    const category = pendingDelete;

    setDeletingId(category.id);

    try {
      await deleteCategory(category.id);

      /* The row is gone, so its upload is dead weight. */
      if (category.image_url) {
        await removeImage(category.image_url);
      }

      toast({
        title: "Category deleted",
        description: `"${category.name}" has been deleted successfully.`,
      });

      loadCategories();
    } catch (error: unknown) {
      console.error("Category delete error:", error);

      toast({
        title: "Delete failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Structure your departments, parent categories, and product subcategories."
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

      {loading ? (
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
              deletingId={deletingId}
              onEdit={openEdit}
              onDelete={requestDelete}
              onAddSubcategory={openCreate}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setPendingDelete(null);
          }
        }}
        title="Delete category"
        description={`"${pendingDelete?.name ?? ""}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete category"
        confirmingLabel="Deleting..."
        confirming={deletingId !== null}
        onConfirm={handleDelete}
      />

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
