/**
 * POST /api/upload/image
 * Upload a raw image file to Supabase Storage and return the public URL.
 * Used by the wardrobe re-upload flow in WardrobePage.handleReupload.
 */

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase'
import { requireAuth } from '@/backend/database/auth-middleware'
import { validateEnv } from '@/lib/env'
import { generateSnowflakeId } from '@/backend/database/snowflake'

const BUCKET = 'wardrobe-images'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    validateEnv()

    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const { userId } = auth

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 },
      )
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(heic|heif|jpg|jpeg|png|webp)$/i)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please use JPG, PNG, or WEBP.' },
        { status: 400 },
      )
    }

    // Convert to JPEG, auto-rotate via EXIF, resize to max 1200px
    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const imageBuffer = await sharp(rawBuffer)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer()

    const adminClient = createAdminClient()

    // Ensure bucket exists
    const { data: bucket } = await adminClient.storage.getBucket(BUCKET)
    if (!bucket) {
      const { error: bucketErr } = await adminClient.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      })
      if (bucketErr && !bucketErr.message.toLowerCase().includes('already exist')) {
        throw new Error(`Cannot create bucket: ${bucketErr.message}`)
      }
    }

    // Use a unique path so re-uploads don't collide with the original
    const uploadId = generateSnowflakeId().toString()
    const storagePath = `${userId}/${uploadId}.jpg`

    const { error: uploadErr } = await adminClient.storage
      .from(BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '31536000',
      })

    if (uploadErr) {
      throw new Error(`Upload failed: ${uploadErr.message}`)
    }

    const { data } = adminClient.storage.from(BUCKET).getPublicUrl(storagePath)

    if (!data.publicUrl || !data.publicUrl.startsWith('https://')) {
      throw new Error(`Invalid public URL: ${data.publicUrl}`)
    }

    return NextResponse.json({
      success: true,
      data: {
        url: data.publicUrl,
        path: storagePath,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Upload Image] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
