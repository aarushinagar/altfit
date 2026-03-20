/**
 * Storage Engine for Supabase
 *
 * Handles bucket creation, file uploads, and public URL generation.
 * Requires admin client (service role key) for privileged operations.
 */

import { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'wardrobe-images'

/**
 * Ensure the wardrobe storage bucket exists.
 * Idempotent — safe to call multiple times.
 */
export async function ensureBucket(adminClient: SupabaseClient): Promise<void> {
  try {
    const { data } = await adminClient.storage.getBucket(BUCKET)
    if (!data) {
      const { error } = await adminClient.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      })

      if (error && !error.message.toLowerCase().includes('already exist')) {
        throw new Error(`Cannot create bucket: ${error.message}`)
      }

      console.log('[Storage] ✅ Created wardrobe-images bucket')
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!msg.includes('already exist')) {
      throw error
    }
  }
}

/**
 * Upload a cropped/processed image to Supabase Storage.
 * Returns a permanent public CDN URL.
 */
export async function uploadItemImage(
  adminClient: SupabaseClient,
  userId: string,
  itemId: string,
  imageBuffer: Buffer
): Promise<string> {
  await ensureBucket(adminClient)

  const storagePath = `${userId}/${itemId}.jpg`

  const { error } = await adminClient.storage.from(BUCKET).upload(storagePath, imageBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '31536000', // 1 year cache
  })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data } = adminClient.storage.from(BUCKET).getPublicUrl(storagePath)

  if (!data.publicUrl || !data.publicUrl.startsWith('https://')) {
    throw new Error(`Invalid public URL: ${data.publicUrl}`)
  }

  // Return clean, permanent CDN URL — no cache-busters in the DB
  return data.publicUrl
}

/**
 * Delete an item's image from storage.
 * Silently ignores missing files (idempotent).
 */
export async function deleteItemImage(
  adminClient: SupabaseClient,
  userId: string,
  itemId: string
): Promise<void> {
  try {
    await adminClient.storage.from(BUCKET).remove([`${userId}/${itemId}.jpg`])
  } catch (error) {
    // Silently ignore — file may not exist
    console.warn('[Storage] Delete warning (ignored):', error)
  }
}
