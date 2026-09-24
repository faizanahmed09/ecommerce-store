/*
 * ---------------------------------------------------------
 * CATALOGUE IMAGE STORAGE
 * ---------------------------------------------------------
 *
 * Product and category art is uploaded straight to the public
 * Supabase bucket instead of being pasted in as a third-party
 * URL, so the storefront serves images we own from a host
 * next.config already allow-lists.
 *
 * The bucket is created with a 2 MB limit in schema.sql; the
 * same limit is checked here so the admin gets a readable
 * message instead of a raw storage error.
 */

import { createClient } from "@/src/app/lib/supabase/client";

export const IMAGE_BUCKET = "Lamees-images";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/* Kept in sync with the bucket's allowed_mime_types. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

/* The `accept` attribute for the file input. */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

export const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/* Returns a human-readable reason, or null when the file is fine. */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "Please choose a JPEG, PNG, WebP, AVIF or GIF image.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return `Image must be 2 MB or smaller (this one is ${formatBytes(file.size)}).`;
  }

  return null;
}

const extensionOf = (file: File): string => {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) {
    return fromName;
  }

  return file.type.split("/")[1] ?? "jpg";
};

/*
 * How long a stored object may be cached, in seconds.
 *
 * A year, because of the invariant below: a key is never
 * reused, so an object's bytes never change once written.
 * Replacing a product's photograph writes a new key and yields
 * a new URL, which nothing has cached yet - so there is no
 * stale copy for a short TTL to protect against.
 *
 * It was 3600. That asked every CDN and browser to re-check an
 * immutable file once an hour, forever.
 */
const CACHE_ONE_YEAR = "31536000";

/*
 * Object keys are never reused: a fresh key per upload keeps
 * the CDN from serving a stale cached copy after a replace.
 */
const objectKey = (file: File, folder: string, slug: string): string => {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "image";

  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return `${folder}/${safeSlug}-${unique}.${extensionOf(file)}`;
};

/*
 * Uploads the file under `folder` and returns its public URL.
 * Throws on failure.
 */
export async function uploadImage(
  file: File,
  folder: "products" | "categories",
  slug: string
): Promise<string> {
  const reason = validateImageFile(file);

  if (reason) {
    throw new Error(reason);
  }

  const supabase = createClient();
  const key = objectKey(file, folder, slug);

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(key, file, { cacheControl: CACHE_ONE_YEAR, contentType: file.type });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(key);

  if (!data?.publicUrl) {
    throw new Error("Image uploaded but no public URL was returned.");
  }

  return data.publicUrl;
}

/*
 * The object key inside our bucket, or null when the URL points
 * somewhere else (seed data, or a link typed in before uploads
 * existed) and must be left alone.
 */
export function storageKeyOf(imageUrl: string): string | null {
  let url: URL;

  try {
    url = new URL(imageUrl);
  } catch {
    return null;
  }

  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const index = url.pathname.indexOf(marker);

  if (index === -1) {
    return null;
  }

  const key = decodeURIComponent(url.pathname.slice(index + marker.length));

  return key || null;
}

/*
 * Best-effort cleanup of the file a row no longer points at.
 * The row is already saved by the time this runs, so a failed
 * delete leaves an orphaned object rather than failing the
 * save.
 */
export async function removeImage(imageUrl: string): Promise<void> {
  const key = storageKeyOf(imageUrl);

  if (!key) {
    return;
  }

  const { error } = await createClient().storage.from(IMAGE_BUCKET).remove([key]);

  if (error) {
    console.error("Failed to remove the replaced image:", error);
  }
}
