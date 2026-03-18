/**
 * Supabase Storage & Admin Client Helper
 *
 * Server-side only — never import on the frontend.
 *
 * IMPORTANT: Set SUPABASE_SERVICE_KEY to your project's service_role key
 * (Supabase Dashboard → Settings → API → service_role).
 * Using the anon key here will cause uploads to fail with RLS errors.
 * Run setup/supabase-storage-policies.sql in your Supabase SQL editor to
 * configure the wardrobe-images bucket policies.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
// Check both SUPABASE_SERVICE_ROLE_KEY (preferred) and SUPABASE_SERVICE_KEY (fallback)
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. " +
    "Image uploads will fail. Set both variables in .env.local.",
  );
}

/**
 * Server-side Supabase client.
 * Uses service_role key to bypass RLS for server-side file operations.
 * Falls back to anon key if service_role is not set — uploads will only
 * succeed if the bucket has permissive INSERT/UPDATE policies.
 */
export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

// Hard guard: never start production without a configured Supabase client.
if (process.env.NODE_ENV === "production" && !supabaseAdmin) {
  throw new Error(
    "[Supabase] FATAL: Running in production without SUPABASE_URL / SUPABASE_SERVICE_KEY. " +
    "Set both variables in your deployment environment.",
  );
}

/**
 * Upload an image buffer to Supabase Storage (wardrobe-images bucket).
 *
 * @param buffer       Raw image bytes
 * @param storagePath  Path inside the bucket, e.g. "users/123/item.webp"
 * @param contentType  MIME type, e.g. "image/webp"
 * @returns            Permanent public CDN URL (always starts with https://)
 */
export async function uploadImage(
  buffer: Buffer,
  storagePath: string,
  contentType: string,
): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error(
      "[Supabase] Client not initialised — check SUPABASE_URL and SUPABASE_SERVICE_KEY",
    );
  }

  console.log(`[Upload] Uploading to Supabase Storage: ${storagePath}`);

  // Ensure bucket exists — idempotent, no-op if already present.
  // With service_role key this creates the bucket on first run.
  // With anon key it will fail silently (bucket must be created manually in Dashboard).
  const { error: bucketErr } = await supabaseAdmin.storage.createBucket(
    "wardrobe-images",
    {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"],
    },
  );
  if (
    bucketErr &&
    !bucketErr.message.toLowerCase().includes("already exist") &&
    !bucketErr.message.toLowerCase().includes("duplicate")
  ) {
    console.warn(
      `[Upload] Bucket ensure failed (anon key or other): ${bucketErr.message}. ` +
      "The bucket must be created manually in the Supabase Dashboard → Storage.",
    );
  }

  const { error } = await supabaseAdmin.storage
    .from("wardrobe-images")
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,   // allow re-uploading the same path (crop fixes, re-attaches)
      cacheControl: "3600",
    });

  if (error) {
    console.error(`[Upload] Supabase Storage error: ${error.message}`);
    const msg = error.message;
    const isSetup =
      msg.toLowerCase().includes("bucket") ||
      msg.toLowerCase().includes("not found") ||
      msg.toLowerCase().includes("row-level security") ||
      msg.toLowerCase().includes("unauthorized");
    throw new Error(
      isSetup
        ? `Storage not configured: ${msg}. Create the "wardrobe-images" bucket in Supabase Dashboard → Storage and set SUPABASE_SERVICE_KEY to your service_role key.`
        : `Storage upload failed: ${msg}`,
    );
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("wardrobe-images")
    .getPublicUrl(storagePath);

  // Hard validation — publicUrl must be an absolute Supabase CDN URL
  if (!publicUrl.startsWith("https://")) {
    throw new Error(
      `[Upload] Unexpected public URL format: "${publicUrl}". Expected https://...supabase.co/...`,
    );
  }

  console.log(`[Upload] Saved to Supabase: ${publicUrl}`);
  return publicUrl;
}

/**
 * Delete an image from Supabase Storage.
 */
export async function deleteImage(storagePath: string): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error("[Supabase] Client not initialised");
  }

  console.log(`[Supabase] Deleting: ${storagePath}`);
  const { error } = await supabaseAdmin.storage
    .from("wardrobe-images")
    .remove([storagePath]);

  if (error) {
    console.error(`[Supabase] Deletion error: ${error.message}`);
    throw new Error(`Failed to delete image: ${error.message}`);
  }

  console.log(`[Supabase] Deleted: ${storagePath}`);
}

/**
 * Upload a profile avatar to Supabase Storage (profile-avatars bucket).
 */
export async function uploadAvatar(
  buffer: Buffer,
  userId: string,
  contentType: string,
): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error("[Supabase] Client not initialised");
  }

  const storagePath = `profile-avatars/${userId}/avatar-${Date.now()}`;
  console.log(`[Supabase] Uploading avatar → ${storagePath}`);

  const { error } = await supabaseAdmin.storage
    .from("profile-avatars")
    .upload(storagePath, buffer, { contentType, upsert: true, cacheControl: "3600" });

  if (error) {
    console.error(`[Supabase] Avatar upload error: ${error.message}`);
    throw new Error(`Failed to upload avatar: ${error.message}`);
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("profile-avatars")
    .getPublicUrl(storagePath);

  console.log(`[Supabase] Avatar uploaded: ${publicUrl}`);
  return publicUrl;
}

/**
 * Generate a scoped, unique storage path for a wardrobe image.
 * Path format: users/{userId}/{randomId}.{ext}
 */
export function generateUserStoragePath(userId: string, fileName: string): string {
  const ext = fileName.split(".").pop() || "jpg";
  const id =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  return `users/${userId}/${id}.${ext}`;
}

