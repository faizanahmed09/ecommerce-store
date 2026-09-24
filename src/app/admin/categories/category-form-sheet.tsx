"use client";

/*
 * ---------------------------------------------------------
 * CATEGORY FORM SHEET
 * ---------------------------------------------------------
 *
 * Owns the form's values; validation lives in category-form.
 */

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
import { Textarea } from "@/src/app/components/ui/textarea";
import type { CategoryRecord } from "@/src/app/lib/categories";
import { cn, safeImageSrc } from "@/src/app/lib/utils";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormActions, getErrorMessage, INPUT_CLASS, LABEL_CLASS } from "../components/admin-ui";
import {
  formatBytes,
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  uploadImage,
  validateImageFile,
} from "../lib/storage";
import {
  availableParents,
  categoryFormValues,
  emptyCategoryForm,
  generateSlug,
  NO_PARENT,
  validateCategoryForm,
  type CategoryFormValues,
  type ValidationError,
} from "./category-form";
import type { CategoryPayload } from "@/src/app/lib/categories";

interface CategoryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /* Null creates; a record edits. */
  editing: CategoryRecord | null;
  /* Pre-selected parent when opened via "Add Subcategory". */
  presetParentId: string | null;
  categories: CategoryRecord[];
  saving: boolean;
  onInvalid: (error: ValidationError) => void;
  onSubmit: (payload: CategoryPayload) => void;
}

export function CategoryFormSheet({
  open,
  onOpenChange,
  editing,
  presetParentId,
  categories,
  saving,
  onInvalid,
  onSubmit,
}: CategoryFormSheetProps) {
  const [values, setValues] = useState<CategoryFormValues>(emptyCategoryForm());
  const [uploading, setUploading] = useState(false);

  /* Clearing the input by hand is what lets the same file be re-picked. */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* The upload runs here, the save runs in the page above. */
  const busy = saving || uploading;

  /*
   * Reload the form whenever the sheet opens on a new target.
   *
   * Done by comparing a key during render rather than from an
   * effect: an effect would paint the previous category's
   * values for one frame before replacing them, and cost a
   * second render every time the sheet opened.
   */
  const targetKey = open ? (editing?.id ?? `new:${presetParentId ?? NO_PARENT}`) : null;

  const [loadedKey, setLoadedKey] = useState(targetKey);

  if (targetKey !== loadedKey) {
    setLoadedKey(targetKey);

    if (targetKey !== null) {
      setValues(
        editing ? categoryFormValues(editing) : emptyCategoryForm(presetParentId ?? NO_PARENT)
      );
    }
  }

  /* Clearing the file input is a DOM write, not state. */
  useEffect(() => {
    if (open && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [open, targetKey]);

  /*
   * A picked file is previewed from an object URL, which has to
   * be revoked or the blob is held until the tab closes.
   */
  const filePreview = useMemo(
    () => (values.imageFile ? URL.createObjectURL(values.imageFile) : null),
    [values.imageFile]
  );

  useEffect(() => {
    if (!filePreview) {
      return;
    }

    return () => URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  /* A pending file wins over whatever is already saved. */
  const previewSrc = filePreview ?? (values.imageUrl ? safeImageSrc(values.imageUrl) : null);

  const setField = (field: keyof CategoryFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  /*
   * The file is only held in state here; it is uploaded on
   * submit so an abandoned sheet leaves nothing in the bucket.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const reason = validateImageFile(file);

    if (reason) {
      onInvalid({ title: "Invalid image", description: reason });
      event.target.value = "";
      return;
    }

    setValues((prev) => ({ ...prev, imageFile: file }));
  };

  /* Drops both the pending file and the image already saved. */
  const handleClearImage = () => {
    setValues((prev) => ({ ...prev, imageFile: null, imageUrl: "" }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /*
   * A new category's slug follows its name. An existing one's
   * does not: the admin may have changed it deliberately, and
   * the slug is in URLs the store has already published.
   */
  const handleNameChange = (name: string) => {
    setValues((prev) => ({
      ...prev,
      name,
      slug: editing ? prev.slug : generateSlug(name),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    const result = validateCategoryForm(values, categories, editing?.id ?? null);

    if (result.error) {
      onInvalid(result.error);
      return;
    }

    let imageUrl = values.imageUrl.trim();

    if (values.imageFile) {
      setUploading(true);

      try {
        imageUrl = await uploadImage(values.imageFile, "categories", result.payload.slug);

        /*
         * The file is in the bucket now. Folding it into the
         * form means a failed save can be retried without
         * uploading a second copy.
         */
        setValues((prev) => ({ ...prev, imageUrl, imageFile: null }));

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (caught: unknown) {
        console.error("Category image upload error:", caught);

        onInvalid({
          title: "Image upload failed",
          description: getErrorMessage(caught),
        });

        return;
      } finally {
        setUploading(false);
      }
    }

    onSubmit({ ...result.payload, image_url: imageUrl || null });
  };

  const parents = availableParents(categories, editing?.id ?? null);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (uploading) {
          return;
        }

        onOpenChange(next);
      }}
    >
      <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-md">
        <SheetHeader className="mb-6 border-b border-neutral-100 pb-4">
          <SheetTitle className="text-lg font-bold text-neutral-900">
            {editing ? `Edit Category: ${editing.name}` : "Create Category"}
          </SheetTitle>

          <SheetDescription className="text-xs text-neutral-400">
            Set the category details and place it within your storefront hierarchy.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" className={LABEL_CLASS}>
              Category Name <span className="text-red-500">*</span>
            </Label>

            <Input
              id="cat-name"
              value={values.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Shirts, Blazers"
              required
              disabled={busy}
              className={INPUT_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-slug" className={LABEL_CLASS}>
              Slug <span className="text-red-500">*</span>
            </Label>

            <Input
              id="cat-slug"
              value={values.slug}
              onChange={(e) => setField("slug", generateSlug(e.target.value))}
              placeholder="e.g. men-shirts"
              required
              disabled={busy}
              className={cn(INPUT_CLASS, "font-mono text-xs")}
            />

            <p className="text-[10px] text-neutral-400">
              Used in the URL. A top-level category is served at /{values.slug || "category"}; a
              child at /parent/
              {values.slug || "category"}.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-parent" className={LABEL_CLASS}>
              Parent Category (Optional)
            </Label>

            <Select
              value={values.parentId}
              onValueChange={(value) => setField("parentId", value)}
              disabled={busy}
            >
              <SelectTrigger className={INPUT_CLASS}>
                <SelectValue placeholder="Select parent category" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value={NO_PARENT}>None (Top-Level Category)</SelectItem>

                {parents.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-image" className={LABEL_CLASS}>
              Banner / Image
            </Label>

            <div className="flex items-start gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                {previewSrc ? (
                  /*
                   * A pending file is previewed from a blob: URL,
                   * which next/image cannot take, so both the
                   * saved and the pending state use plain img.
                   */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewSrc}
                    alt="Category image preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-7 w-7 text-neutral-300" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  id="cat-image"
                  type="file"
                  accept={IMAGE_ACCEPT}
                  onChange={handleFileChange}
                  disabled={busy}
                  className="block w-full cursor-pointer text-xs text-neutral-500 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-neutral-200 file:bg-neutral-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-700 hover:file:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                />

                {values.imageFile ? (
                  <p className="flex items-center gap-1 truncate text-[11px] text-neutral-600">
                    <Upload className="h-3 w-3 shrink-0" />
                    {values.imageFile.name} ({formatBytes(values.imageFile.size)}) — uploads on save
                  </p>
                ) : (
                  <p className="text-[11px] text-neutral-400">
                    JPEG, PNG, WebP, AVIF or GIF — up to {formatBytes(MAX_IMAGE_BYTES)}.
                  </p>
                )}

                {previewSrc ? (
                  <button
                    type="button"
                    onClick={handleClearImage}
                    disabled={busy}
                    className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove image
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc" className={LABEL_CLASS}>
              Description
            </Label>

            <Textarea
              id="cat-desc"
              value={values.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Brief summary of items in this category..."
              rows={3}
              disabled={busy}
              className={INPUT_CLASS}
            />
          </div>

          <FormActions
            saving={busy}
            submitLabel={editing ? "Save Changes" : "Create Category"}
            savingLabel={uploading ? "Uploading image..." : editing ? "Saving..." : "Creating..."}
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </SheetContent>
    </Sheet>
  );
}
