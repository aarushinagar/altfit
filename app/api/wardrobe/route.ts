/**
 * GET /api/wardrobe
 * Fetch authenticated user's wardrobe items
 *
 * POST /api/wardrobe
 * Upload and analyze a new wardrobe item
 * - Accepts: multipart/form-data with 'image' field
 * - Max file: 10MB
 * Instant upload — returns immediately with analysisStatus: "pending".
 * Claude enrichment runs in background via AnalysisQueue.
 * - Returns: array of saved items (one per upload)
 *
 * NOTE: All DB operations use Prisma (not the Supabase PostgREST client)
 * because the Prisma schema uses PascalCase model names ("WardrobeItem"),
 * which PostgREST cannot resolve via the supabase.from('wardrobe_items') API.
 * Supabase client is kept only for Storage (file upload/delete).
 */

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase'
import { resizeProductPhoto } from '@/lib/imageCropper'
import { uploadItemImage } from '@/lib/storageEngine'
import { validateEnv } from '@/lib/env'
import { requireAuth } from '@/backend/database/auth-middleware'
import prisma from '@/backend/database/prisma'
import { generateSnowflakeId } from '@/backend/database/snowflake'
import { processAnalysisQueue } from '@/lib/analyzeItem'
import type { Prisma } from '@prisma/client'

/** Serialize a Prisma WardrobeItem (BigInt ids) to a plain JSON-safe object */
function serializeItem(item: Record<string, unknown>) {
  return {
    ...item,
    id: String(item.id),
    userId: String(item.userId),
  }
}

export async function GET(req: NextRequest) {
  try {
    validateEnv()

    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const { userId } = auth

    console.log('[Wardrobe GET] Fetching items for user')

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const category = url.searchParams.get('category') || undefined

    const whereClause = {
      userId: BigInt(userId),
      isActive: true,
      ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.wardrobeItem.count({
        where: whereClause,
      }),
    ])

    console.log(`[Wardrobe GET] Returning ${items.length} of ${total} items`)

    // Drain analysis backlog in background (fire-and-forget — no await)
    processAnalysisQueue().catch(err =>
      console.error('[Wardrobe GET] Queue drain error:', err)
    )

    return NextResponse.json({
      success: true,
      data: {
        items: items.map(serializeItem),
        total,
      },
      limit,
      offset,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[Wardrobe GET] Error:', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    // ── 1. VALIDATE ENV ─────────────────────────────────────────────────────
    validateEnv()

    // ── 2. PARSE FILE ────────────────────────────────────────────────────────
    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please use JPG, PNG, or WEBP.' },
        { status: 400 }
      )
    }

    // ── 3. AUTHENTICATE ──────────────────────────────────────────────────────
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const { userId } = auth

    // ── 4. CONVERT TO JPEG + auto-rotate EXIF ────────────────────────────────
    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const imageBuffer = await sharp(rawBuffer).rotate().jpeg({ quality: 88 }).toBuffer()

    // ── 5. CREATE PLACEHOLDER DB ROW ─────────────────────────────────────────
    const newId = generateSnowflakeId()
    const createData: Prisma.WardrobeItemUncheckedCreateInput = {
      id: newId,
      userId: BigInt(userId),
      name: 'Analyzing…',
      category: 'TOP',
      analysisStatus: 'pending',
    }
    const item = await prisma.wardrobeItem.create({ data: createData })
    const itemId = item.id.toString()

    // ── 6. UPLOAD IMAGE ───────────────────────────────────────────────────────
    const adminClient = createAdminClient()
    // Resize to max 1400px (keeps quality for display while saving storage)
    const displayBuffer = await resizeProductPhoto(imageBuffer, 'TOP')
    const publicUrl = await uploadItemImage(adminClient, userId, itemId, displayBuffer)
    const storagePath = `${userId}/${itemId}.jpg`

    const updated = await prisma.wardrobeItem.update({
      where: { id: item.id },
      data: { imageUrl: publicUrl, storagePath },
    })

    // ── 7. ENQUEUE BACKGROUND ANALYSIS ────────────────────────────────────────
    const queueId = generateSnowflakeId()
    await prisma.analysisQueue.create({
      data: {
        id: queueId,
        wardrobeItemId: item.id,
        userId: BigInt(userId),
        status: 'pending',
      },
    })

    // Fire-and-forget: do NOT await — this is the whole point
    processAnalysisQueue().catch(err =>
      console.error('[Wardrobe] Background analysis trigger failed:', err instanceof Error ? err.message : String(err))
    )

    console.log(`[Wardrobe] ✅ Item ${itemId} queued for analysis in ${Date.now() - startTime}ms`)

    return NextResponse.json({
      success: true,
      items: [serializeItem(updated as unknown as Record<string, unknown>)],
      saved: 1,
      failed: 0,
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Wardrobe] ❌ FATAL ERROR: ${errMsg}`)
    return NextResponse.json(
      { error: errMsg, detail: 'Check server logs for stack trace' },
      { status: 500 }
    )
  }
}

