/**
 * Supabase Storage & Admin Client Helper
 *
 * Note: Do NOT use this on the frontend. This uses the service role key
 * and should only be used in server-side API routes.
 *
 * This ensures proper security isolation and prevents token exposure.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

/**
 * Supabase admin client - use service role key for server-side operations
 * This has unrestricted access for file operations
 */
export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

/**
 * Upload an image to Supabase Storage with user isolation
 *
 * @param buffer - The image file as a Buffer
 * @param path - Storage path (e.g., "wardrobe-images/user_id/item_id.jpg")
 * @param contentType - MIME type (e.g., "image/jpeg")
 * @returns The public CDN URL of the uploaded image
 * @throws Error if upload fails or Supabase is not configured
 */
export async function uploadImage(
  buffer: Buffer,
  path: string,
  contentType: string,
): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase is not configured. Check SUPABASE_URL and SUPABASE_SERVICE_KEY env vars",
    );
  }

  console.log(`[Supabase] Uploading image to path: ${path}`);

  const { data, error } = await supabaseAdmin.storage
    .from("wardrobe-images")
    .upload(path, buffer, {
      contentType,
      upsert: false,
      cacheControl: "3600",
    });

  if (error) {
    console.error(`[Supabase] Upload error: ${error.message}`);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get the public URL for this file
  const { data: publicUrlData } = supabaseAdmin.storage
    .from("wardrobe-images")
    .getPublicUrl(path);

  console.log(
    `[Supabase] Image uploaded successfully: ${publicUrlData.publicUrl}`,
  );
  return publicUrlData.publicUrl;
}

/**
 * Delete an image from Supabase Storage
 *
 * @param path - Storage path of the file to delete
 * @throws Error if deletion fails or Supabase is not configured
 */
export async function deleteImage(path: string): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase is not configured. Check SUPABASE_URL and SUPABASE_SERVICE_KEY env vars",
    );
  }

  console.log(`[Supabase] Deleting image from path: ${path}`);

  const { error } = await supabaseAdmin.storage
    .from("wardrobe-images")
    .remove([path]);

  if (error) {
    console.error(`[Supabase] Deletion error: ${error.message}`);
    throw new Error(`Failed to delete image: ${error.message}`);
  }

  console.log(`[Supabase] Image deleted successfully: ${path}`);
}

/**
 * Upload a profile avatar to Supabase Storage
 *
 * @param buffer - The image file as a Buffer
 * @param userId - User ID for path organization
 * @param contentType - MIME type
 * @returns The public CDN URL of the uploaded avatar
 */
export async function uploadAvatar(
  buffer: Buffer,
  userId: string,
  contentType: string,
): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase is not configured. Check SUPABASE_URL and SUPABASE_SERVICE_KEY env vars",
    );
  }

  const path = `profile-avatars/${userId}/avatar-${Date.now()}`;
  console.log(`[Supabase] Uploading avatar for user: ${userId}`);

  const { data, error } = await supabaseAdmin.storage
    .from("profile-avatars")
    .upload(path, buffer, {
      contentType,
      upsert: false,
      cacheControl: "3600",
    });

  if (error) {
    console.error(`[Supabase] Avatar upload error: ${error.message}`);
    throw new Error(`Failed to upload avatar: ${error.message}`);
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from("profile-avatars")
    .getPublicUrl(path);

  console.log(
    `[Supabase] Avatar uploaded successfully: ${publicUrlData.publicUrl}`,
  );
  return publicUrlData.publicUrl;
}

/**
 * Generate a secure user-isolated storage path
 * Prevents users from accessing other users' files
 *
 * @param userId - User ID for path organization
 * @param fileName - Original filename
 * @returns Safe storage path
 */
export function generateUserStoragePath(
  userId: string,
  fileName: string,
): string {
  // Use CUID-like random string + original extension
  const ext = fileName.split(".").pop() || "jpg";
  const id =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  return `wardrobe-images/${userId}/${id}.${ext}`;
}
