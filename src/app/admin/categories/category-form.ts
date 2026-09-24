/*
 * ---------------------------------------------------------
 * CATEGORY FORM VALUES + VALIDATION
 * ---------------------------------------------------------
 *
 * Pure form logic: no React, no network. The sheet holds the
 * values in state and calls validateCategoryForm on submit; a
 * picked file is checked against the same bucket rules the
 * uploader enforces.
 *
 * The hierarchy rules live here too, because "can X be the
 * parent of Y" is the one piece of this screen worth being
 * able to reason about on its own.
 */

import type { CategoryPayload, CategoryRecord } from "@/src/app/lib/categories";
import { generateSlug } from "@/src/app/lib/utils";
import { validateImageFile } from "../lib/storage";

export interface CategoryFormValues {
  name: string;
  slug: string;
  description: string;
  /* "none" rather than "" so the Select has a real value. */
  parentId: string;
  /* The image already saved for this category, "" once removed. */
  imageUrl: string;
  /* A file picked in the sheet, uploaded on submit. */
  imageFile: File | null;
}

export const NO_PARENT = "none";

export const emptyCategoryForm = (parentId: string = NO_PARENT): CategoryFormValues => ({
  name: "",
  slug: "",
  description: "",
  parentId,
  imageUrl: "",
  imageFile: null,
});

export const categoryFormValues = (category: CategoryRecord): CategoryFormValues => ({
  name: category.name,
  slug: category.slug,
  description: category.description ?? "",
  parentId: category.parent_id ?? NO_PARENT,
  imageUrl: category.image_url ?? "",
  imageFile: null,
});

/*
 * Is `possibleParentId` somewhere below `categoryId` in the
 * tree? Walking up from the candidate is cheaper than walking
 * down from the category, and terminates on the root.
 *
 *   Men
 *    └── Shirts
 *         └── Formal Shirts
 *
 * Men cannot take Shirts as its parent, which is what stops a
 * cycle that would otherwise hang every reader of the tree.
 */
export function isDescendant(
  categories: CategoryRecord[],
  categoryId: string,
  possibleParentId: string
): boolean {
  const parentOf = (id: string): string | null =>
    categories.find((category) => category.id === id)?.parent_id ?? null;

  let current = parentOf(possibleParentId);

  while (current) {
    if (current === categoryId) {
      return true;
    }

    current = parentOf(current);
  }

  return false;
}

/*
 * The categories offerable as a parent: top-level rows, minus
 * the category being edited and anything beneath it.
 */
export function availableParents(
  categories: CategoryRecord[],
  editingId: string | null
): CategoryRecord[] {
  const roots = categories.filter((category) => !category.parent_id);

  if (!editingId) {
    return roots;
  }

  return roots.filter(
    (category) => category.id !== editingId && !isDescendant(categories, editingId, category.id)
  );
}

export interface ValidationError {
  title: string;
  description: string;
}

type ValidationResult =
  { payload: CategoryPayload; error?: never } | { payload?: never; error: ValidationError };

const invalid = (title: string, description: string): ValidationResult => ({
  error: { title, description },
});

export function validateCategoryForm(
  values: CategoryFormValues,
  categories: CategoryRecord[],
  editingId: string | null
): ValidationResult {
  const name = values.name.trim();
  const slug = values.slug.trim().toLowerCase();

  if (!name) {
    return invalid("Category name required", "Please enter a category name.");
  }

  if (!slug) {
    return invalid("Slug required", "Please enter a category slug.");
  }

  const parentId = values.parentId === NO_PARENT ? null : values.parentId;

  if (editingId && parentId === editingId) {
    return invalid("Invalid parent", "A category cannot be its own parent.");
  }

  if (editingId && parentId && isDescendant(categories, editingId, parentId)) {
    return invalid(
      "Circular hierarchy",
      "You cannot select one of this category's subcategories as its parent."
    );
  }

  if (values.imageFile) {
    const imageError = validateImageFile(values.imageFile);

    if (imageError) {
      return invalid("Invalid image", imageError);
    }
  }

  const duplicateSlug = categories.some(
    (category) => category.slug.toLowerCase() === slug && category.id !== editingId
  );

  if (duplicateSlug) {
    return invalid("Slug already exists", "Please choose a different slug for this category.");
  }

  return {
    payload: {
      name,
      slug,
      description: values.description.trim() || null,
      parent_id: parentId,
      image_url: values.imageUrl.trim() || null,
    },
  };
}

export { generateSlug };
