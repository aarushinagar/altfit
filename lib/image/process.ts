/**
 * Server-side image processing utility.
 *
 * Converts uploaded files to WebP Q80, max 1200px on the long edge,
 * strips EXIF, flattens transparency, then writes to Supabase Storage.
 *
 * Only import this from API route files — sharp is a server-only module.
 */

import sharp from "sharp";
import { supabaseAdmin } from "@/backend/database/supabase";

const MAX_PX = 1200;
const WEBP_QUALITY = 80;
const WEBP_EFFORT = 4;
const BUCKET = "wardrobe-images";
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export interface ProcessedImage {
  storagePath: string;
  publicUrl: string;
  widthPx: number;
  heightPx: number;
  byteSize: number;
}

/**
 * Process a raw uploaded File/Buffer to WebP and upload to Supabase Storage.
 *
 * @param source  - File object from formData.get("image") OR a Buffer
 * @param userId  - Authenticated user ID (used for storage path scoping)
 * @param itemId  - Snowflake ID string for the wardrobe item (determines filename)
 */
export async function processAndUploadImage(
  source: File | Buffer,
  userId: string,
  itemId: string,
): Promise<ProcessedImage> {
  // Convert File → Buffer
  const inputBuffer =
    source instanceof Buffer
      ? source
      : Buffer.from(await (source as File).arrayBuffer());

  if (inputBuffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(
      `Image exceeds the 8 MB size limit (${(inputBuffer.byteLength / 1024 / 1024).toFixed(1)} MB uploaded)`,
    );
  }

  // Process with Sharp
  const pipeline = sharp(inputBuffer)
    .rotate() // auto-orient via EXIF
    .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }) // flatten PNG transparency
    .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT });

  const { data: processedBuffer, info } = await pipeline.toBuffer({
    resolveWithObject: true,
  });

  // Upload to Supabase Storage under users/{userId}/{itemId}.webp
  const storagePath = `users/${userId}/${itemId}.webp`;

  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not initialized");
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, processedBuffer, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl,
    widthPx: info.width,
    heightPx: info.height,
    byteSize: info.size,
  };
}
