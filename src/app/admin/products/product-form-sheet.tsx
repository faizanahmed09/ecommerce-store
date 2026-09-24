"use client";

/*
 * ---------------------------------------------------------
 * PRODUCT CREATE / EDIT SHEET
 * ---------------------------------------------------------
 */

import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/src/app/components/ui/checkbox";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/app/components/ui/select";
import { Textarea } from "@/src/app/components/ui/textarea";
import { cn, safeImageSrc } from "@/src/app/lib/utils";
import { ChevronDown, ChevronUp, ImageIcon, Plus, Star, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FormActions,
  FormField,
  FormSheet,
  getErrorMessage,
  INPUT_CLASS,
} from "../components/admin-ui";
import {
  formatBytes,
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  removeImage,
  uploadImage,
  validateImageFile,
} from "../lib/storage";
import {
  emptyFormImage,
  emptyFormVariant,
  emptyProductForm,
  generateSlug,
  productFormValues,
  validateProductForm,
  type ProductFormImage,
  type ProductFormValues,
  type ProductFormVariant,
} from "./product-form";
import { createProduct, updateProduct } from "./queries";
import type { Category, Product } from "./types";

interface ProductFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /* null = create, otherwise the product being edited. */
  product: Product | null;
  categories: Category[];
  /* The full list, so a duplicate slug is caught before saving. */
  existingProducts: Product[];
  onSaved: () => Promise<void> | void;
}

export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  categories,
  existingProducts,
  onSaved,
}: ProductFormSheetProps) {
  const { toast } = useToast();

  const [values, setValues] = useState<ProductFormValues>(emptyProductForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  /* Clearing the input by hand is what lets the same file be re-picked. */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /*
   * Read through a ref so a background refresh of the category
   * list cannot wipe fields the admin is part-way through.
   */
  const categoriesRef = useRef(categories);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  /* Seed the fields each time the sheet opens. */
  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(
      product ? productFormValues(product) : emptyProductForm(categoriesRef.current[0]?.id ?? "")
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [open, product]);

  /*
   * A picked file is previewed from an object URL, which has to be revoked or
   * the blob is held until the tab closes. One entry per gallery row, so the
   * list can mix saved urls with files that have not been uploaded yet.
   */
  const previews = useMemo(
    () =>
      values.images.map((image) =>
        image.file ? URL.createObjectURL(image.file) : image.url ? safeImageSrc(image.url) : null
      ),
    [values.images]
  );

  useEffect(() => {
    const objectUrls = previews.filter(
      (preview): preview is string => preview !== null && preview.startsWith("blob:")
    );

    if (objectUrls.length === 0) {
      return;
    }

    return () => {
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [previews]);

  /* Both save paths are blocking, so the whole form locks. */
  const busy = saving || uploading;

  const setValue = <K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K]
  ): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  /* While creating, the slug tracks the name until it is edited by hand. */
  const handleNameChange = (name: string): void => {
    setValues((current) => ({
      ...current,
      name,
      slug: product ? current.slug : generateSlug(name),
    }));
  };

  /*
   * Files are only held in state here; they are uploaded on submit so an
   * abandoned sheet leaves nothing in the bucket. Several can be picked at
   * once - each becomes one gallery row.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const picked = Array.from(event.target.files ?? []);

    if (picked.length === 0) {
      return;
    }

    const accepted: ProductFormImage[] = [];

    for (const file of picked) {
      const reason = validateImageFile(file);

      if (reason) {
        toast({
          title: `Skipped ${file.name}`,
          description: reason,
          variant: "destructive",
        });

        continue;
      }

      accepted.push({ ...emptyFormImage(), file });
    }

    if (accepted.length > 0) {
      setValues((current) => ({
        ...current,
        images: [...current.images, ...accepted].map((image, index) => ({
          ...image,
          /* First image in becomes the primary when none is set yet. */
          isPrimary: current.images.some((existing) => existing.isPrimary)
            ? image.isPrimary
            : index === 0,
        })),
      }));
    }

    /* Clearing by hand is what lets the same file be re-picked. */
    event.target.value = "";
  };

  const handleRemoveImage = (key: string): void => {
    setValues((current) => {
      const images = current.images.filter((image) => image.key !== key);

      /* Removing the primary promotes whatever is now first. */
      return {
        ...current,
        images: images.some((image) => image.isPrimary)
          ? images
          : images.map((image, index) => ({ ...image, isPrimary: index === 0 })),
      };
    });
  };

  const handleSetPrimary = (key: string): void => {
    setValues((current) => ({
      ...current,
      images: current.images.map((image) => ({ ...image, isPrimary: image.key === key })),
    }));
  };

  /* Position in the list is display_order, so moving a row reorders the gallery. */
  const handleMoveImage = (index: number, direction: -1 | 1): void => {
    setValues((current) => {
      const target = index + direction;

      if (target < 0 || target >= current.images.length) {
        return current;
      }

      const images = [...current.images];
      [images[index], images[target]] = [images[target], images[index]];

      return { ...current, images };
    });
  };

  const handleAddVariant = (): void => {
    setValues((current) => ({
      ...current,
      variants: [...current.variants, emptyFormVariant()],
    }));
  };

  const handleVariantChange = <K extends keyof ProductFormVariant>(
    key: string,
    field: K,
    value: ProductFormVariant[K]
  ): void => {
    setValues((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.key === key ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const handleRemoveVariant = (key: string): void => {
    setValues((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.key !== key),
    }));
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (busy) {
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (busy) {
      return;
    }

    const { payload, images, variants, error } = validateProductForm(
      values,
      existingProducts,
      product?.id ?? null
    );

    if (error) {
      toast({ ...error, variant: "destructive" });
      return;
    }

    /* Resolved gallery: every pending file replaced by its uploaded url. */
    let uploaded = images;

    if (images.some((image) => image.file)) {
      setUploading(true);

      try {
        uploaded = await Promise.all(
          images.map(async (image) =>
            image.file
              ? {
                  ...image,
                  image_url: await uploadImage(image.file, "products", payload.slug),
                  file: null,
                }
              : image
          )
        );

        /*
         * The files are in the bucket now. Folding them back into the form
         * means a failed save can be retried without uploading a second copy.
         */
        setValues((current) => ({
          ...current,
          images: current.images.map((image, index) => ({
            ...image,
            url: uploaded[index]?.image_url ?? image.url,
            file: null,
          })),
        }));

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (caught: unknown) {
        console.error("Product image upload error:", caught);

        toast({
          title: "Image upload failed",
          description: getErrorMessage(caught),
          variant: "destructive",
        });

        return;
      } finally {
        setUploading(false);
      }
    }

    setSaving(true);

    try {
      /* Rows the admin dropped, so their files can leave the bucket too. */
      let orphanedUrls: string[] = [];

      if (product) {
        orphanedUrls = await updateProduct(product.id, payload, uploaded, variants);
      } else {
        await createProduct(payload, uploaded, variants);
      }

      /*
       * Nothing points at these files now, so they are dead weight. Cleanup
       * never fails the save.
       */
      for (const orphanedUrl of orphanedUrls) {
        await removeImage(orphanedUrl);
      }

      toast({
        title: product ? "Product updated" : "Product created",
        description: `"${payload.name}" has been ${product ? "updated" : "created"} successfully.`,
      });

      await onSaved();

      /* Only close once the write actually landed. */
      onOpenChange(false);
    } catch (caught: unknown) {
      console.error("Product save error:", caught);

      toast({
        title: product ? "Update failed" : "Creation failed",
        description: getErrorMessage(caught),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={product ? `Edit Product: ${product.name}` : "Create New Product"}
      description="Add the product information below."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pr-1">
        <FormField id="form-name" label="Product Name" required>
          <Input
            id="form-name"
            value={values.name}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="e.g. Men's Casual Polo"
            required
            disabled={busy}
            className={INPUT_CLASS}
          />
        </FormField>

        <FormField id="form-slug" label="Product Slug" required>
          <Input
            id="form-slug"
            value={values.slug}
            onChange={(event) => setValue("slug", generateSlug(event.target.value))}
            placeholder="mens-casual-polo"
            required
            disabled={busy}
            className={cn(INPUT_CLASS, "font-mono text-xs")}
          />
        </FormField>

        <FormField id="form-category" label="Category" required>
          <Select
            value={values.categoryId}
            onValueChange={(value) => setValue("categoryId", value)}
            disabled={busy}
          >
            <SelectTrigger id="form-category" className={INPUT_CLASS}>
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>

            <SelectContent
              position="popper"
              className="max-h-60 w-[var(--radix-select-trigger-width)]"
            >
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id} className="cursor-pointer">
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField id="form-price" label="Price (Rs.)" required>
            <Input
              id="form-price"
              type="number"
              min="0"
              step="0.01"
              value={values.price}
              onChange={(event) => setValue("price", event.target.value)}
              placeholder="2500"
              required
              disabled={busy}
              className={INPUT_CLASS}
            />
          </FormField>

          <FormField id="form-sale-price" label="Sale Price">
            <Input
              id="form-sale-price"
              type="number"
              min="0"
              step="0.01"
              value={values.salePrice}
              onChange={(event) => setValue("salePrice", event.target.value)}
              placeholder="Optional"
              disabled={busy}
              className={INPUT_CLASS}
            />
          </FormField>
        </div>

        <FormField id="form-stock" label="Stock Quantity" required>
          <Input
            id="form-stock"
            type="number"
            min="0"
            step="1"
            value={values.stock}
            onChange={(event) => setValue("stock", event.target.value)}
            placeholder="50"
            required
            disabled={busy}
            className={INPUT_CLASS}
          />
        </FormField>

        <FormField id="form-image" label="Images">
          <div className="space-y-2">
            {values.images.length > 0 ? (
              <ul className="space-y-2">
                {values.images.map((image, index) => (
                  <li
                    key={image.key}
                    className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2"
                  >
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                      {previews[index] ? (
                        /*
                         * A pending file is previewed from a blob: URL, which
                         * next/image cannot take, so both the saved and the
                         * pending state render through plain img.
                         */
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={previews[index]}
                          alt={`Product image ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-neutral-300" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {image.file ? (
                        <p className="flex items-center gap-1 truncate text-[11px] text-neutral-600">
                          <Upload className="h-3 w-3 shrink-0" />
                          {image.file.name} ({formatBytes(image.file.size)}) — uploads on save
                        </p>
                      ) : (
                        <p className="truncate font-mono text-[11px] text-neutral-500">
                          {image.url}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSetPrimary(image.key)}
                        disabled={busy || image.isPrimary}
                        className={cn(
                          "mt-1 flex items-center gap-1 text-[11px] font-semibold disabled:cursor-default",
                          image.isPrimary
                            ? "text-brand-strong disabled:opacity-100"
                            : "text-neutral-500 hover:text-neutral-800 disabled:opacity-60"
                        )}
                      >
                        <Star
                          className={cn("h-3 w-3", image.isPrimary && "fill-current")}
                          aria-hidden
                        />
                        {image.isPrimary ? "Primary image" : "Make primary"}
                      </button>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveImage(index, -1)}
                        disabled={busy || index === 0}
                        aria-label="Move image up"
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveImage(index, 1)}
                        disabled={busy || index === values.images.length - 1}
                        aria-label="Move image down"
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(image.key)}
                        disabled={busy}
                        aria-label="Remove image"
                        className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <input
              ref={fileInputRef}
              id="form-image"
              type="file"
              multiple
              accept={IMAGE_ACCEPT}
              onChange={handleFileChange}
              disabled={busy}
              className="block w-full cursor-pointer text-xs text-neutral-500 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-neutral-200 file:bg-neutral-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-neutral-700 hover:file:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <p className="text-[11px] text-neutral-400">
              JPEG, PNG, WebP, AVIF or GIF — up to {formatBytes(MAX_IMAGE_BYTES)} each. The primary
              image is what listings show; the rest become the gallery, in this order.
            </p>
          </div>
        </FormField>

        <FormField id="form-variants" label="Variants">
          <div className="space-y-2">
            {values.variants.length > 0 ? (
              <>
                <div className="grid grid-cols-[1fr_1fr_5rem_5rem_2rem] gap-2 px-1">
                  <span className="text-[11px] font-semibold text-neutral-500">Option</span>
                  <span className="text-[11px] font-semibold text-neutral-500">Value</span>
                  <span className="text-[11px] font-semibold text-neutral-500">+/- Rs.</span>
                  <span className="text-[11px] font-semibold text-neutral-500">Stock</span>
                  <span />
                </div>

                <ul className="space-y-2">
                  {values.variants.map((variant) => (
                    <li
                      key={variant.key}
                      className="grid grid-cols-[1fr_1fr_5rem_5rem_2rem] items-center gap-2"
                    >
                      <Input
                        value={variant.name}
                        onChange={(event) =>
                          handleVariantChange(variant.key, "name", event.target.value)
                        }
                        placeholder="Size"
                        aria-label="Option name"
                        disabled={busy}
                        className={INPUT_CLASS}
                      />

                      <Input
                        value={variant.value}
                        onChange={(event) =>
                          handleVariantChange(variant.key, "value", event.target.value)
                        }
                        placeholder="Medium"
                        aria-label="Option value"
                        disabled={busy}
                        className={INPUT_CLASS}
                      />

                      <Input
                        type="number"
                        step="0.01"
                        value={variant.priceAdjustment}
                        onChange={(event) =>
                          handleVariantChange(variant.key, "priceAdjustment", event.target.value)
                        }
                        aria-label="Price adjustment"
                        disabled={busy}
                        className={INPUT_CLASS}
                      />

                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={variant.stock}
                        onChange={(event) =>
                          handleVariantChange(variant.key, "stock", event.target.value)
                        }
                        aria-label="Variant stock"
                        disabled={busy}
                        className={INPUT_CLASS}
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(variant.key)}
                        disabled={busy}
                        aria-label="Remove variant"
                        className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <button
              type="button"
              onClick={handleAddVariant}
              disabled={busy}
              className="flex items-center gap-1 text-[11px] font-semibold text-neutral-700 hover:text-black disabled:opacity-60"
            >
              <Plus className="h-3 w-3" />
              Add variant
            </button>

            <p className="text-[11px] text-neutral-400">
              One row per choice — &ldquo;Size: S&rdquo;, &ldquo;Size: M&rdquo;. Rows sharing an
              option name become one picker on the product page. Leave empty for a product sold as a
              single option.
            </p>
          </div>
        </FormField>

        <FormField id="form-desc" label="Description">
          <Textarea
            id="form-desc"
            value={values.description}
            onChange={(event) => setValue("description", event.target.value)}
            placeholder="Describe the product..."
            rows={4}
            disabled={busy}
            className={INPUT_CLASS}
          />
        </FormField>

        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="form-featured"
            checked={values.featured}
            disabled={busy}
            onCheckedChange={(checked) => setValue("featured", checked === true)}
          />

          <Label
            htmlFor="form-featured"
            className="cursor-pointer select-none text-xs font-semibold text-neutral-700"
          >
            Feature this product
          </Label>
        </div>

        <FormActions
          saving={busy}
          submitLabel={product ? "Save Changes" : "Create Product"}
          savingLabel={uploading ? "Uploading image..." : product ? "Saving..." : "Creating..."}
          onCancel={() => handleOpenChange(false)}
        />
      </form>
    </FormSheet>
  );
}
