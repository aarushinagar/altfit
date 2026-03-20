/**
 * GET /api/wardrobe
 * Fetch authenticated user's wardrobe items
 *
 * POST /api/wardrobe
 * Upload and analyze a new wardrobe item
 * - Accepts: multipart/form-data with 'image' field
 * - Max file: 10MB
 * - Uses Claude to: analyze pieces, generate bounding boxes
 * - Returns: array of saved items
 *
 * NOTE: All DB operations use Prisma (not the Supabase PostgREST client)
 * because the Prisma schema uses PascalCase model names ("WardrobeItem"),
 * which PostgREST cannot resolve via the supabase.from('wardrobe_items') API.
 * Supabase client is kept only for Storage (file upload/delete).
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase'
import { cropToPersonOnly, isValidPersonBox, precisionCropItem, resizeProductPhoto } from '@/lib/imageCropper'
import { uploadItemImage } from '@/lib/storageEngine'
import { validateEnv } from '@/lib/env'
import { requireAuth } from '@/backend/database/auth-middleware'
import prisma from '@/backend/database/prisma'
import { generateSnowflakeId } from '@/backend/database/snowflake'
import type { Prisma } from '@prisma/client'

interface DetectedPiece {
  name: string
  category: string
  color: string
  fit: string
  season: string
  formality: number
  confidence?: number
  boundingBox: {
    top: number
    left: number
    width: number
    height: number
  } | null
}

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
    // ── 1. VALIDATE ENV
    console.log('[Wardrobe] ── POST start')
    validateEnv()
    console.log('[Wardrobe] ── ENV ok')

    // ── 2. PARSE FILE
    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file || file.size === 0) {
      console.error('[Wardrobe] ── No image provided')
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      console.error('[Wardrobe] ── File too large')
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!validTypes.includes(file.type)) {
      console.error('[Wardrobe] ── Invalid file type:', file.type)
      return NextResponse.json(
        { error: 'Invalid file type. Please use JPG, PNG, or WEBP.' },
        { status: 400 }
      )
    }

    console.log(`[Wardrobe] ── File received: ${file.name}, ${file.size} bytes`)

    // ── 3. AUTHENTICATE
    const auth = requireAuth(req)
    if (!auth.ok) {
      console.error('[Wardrobe] ── Auth failed')
      return auth.response
    }
    const userId = auth.userId
    console.log(`[Wardrobe] ── User authenticated: ${userId}`)

    // ── 4. CONVERT TO BUFFER + auto-rotate via EXIF + normalise to JPEG
    // Always output JPEG so Claude always gets a supported media type (fixes HEIC uploads)
    const rawBuffer = Buffer.from(await file.arrayBuffer())
    const originalBuffer = await sharp(rawBuffer).rotate().jpeg({ quality: 92 }).toBuffer()
    console.log(`[Wardrobe] ── Buffer ready (EXIF-corrected JPEG): ${originalBuffer.length} bytes`)

    // ── 4b. Downsized copy for Claude — max 1200px on longest side (~5-10× faster API calls)
    const analysisMeta = await sharp(originalBuffer).metadata()
    const needsDownscale = (analysisMeta.width ?? 0) > 1200 || (analysisMeta.height ?? 0) > 1200
    const analysisBuffer = needsDownscale
      ? await sharp(originalBuffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer()
      : originalBuffer
    const base64Image = analysisBuffer.toString('base64')
    const mediaType = 'image/jpeg' as const
    console.log(`[Wardrobe] ── Analysis image: ${analysisBuffer.length} bytes (${needsDownscale ? 'downscaled' : 'original size'})`)

    // ── 5. CALL CLAUDE FOR ANALYSIS
    let pieces: DetectedPiece[] = []
    let personBox: { top: number; left: number; width: number; height: number } | null = null
    let personBuffer: Buffer = originalBuffer
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    try {

      // ── PASS 1: Detect person + clothing in a single Claude call ──────────
      try {
        const p1Promise = anthropic.messages.create({
          model: 'claude-haiku-3-5',
          max_tokens: 1200,
          system: `Vision AI for fashion app. Detect clothing in photos (person wearing OR flat-lay/product). Raw JSON only — never markdown.`,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
              {
                type: 'text',
                text: `Analyze this image. It may show a person wearing clothes OR a product/flat-lay photo with no person.

Return a single JSON object with:
1. "hasPerson": true if a person is clearly visible
2. "personBox": bounding box around the entire person as { "top", "left", "width", "height" } in % of image dimensions — null if no person
3. "pieces": array of ALL clearly visible clothing items (worn by a person OR laid flat / on a hanger / on a mannequin)

STRICT RULES:
- Only detect items from: TOP, BOTTOM, DRESS, OUTERWEAR, FOOTWEAR, BAG, FULL_OUTFIT
- For person photos: detect items worn on the body
- For product/flat-lay photos: detect the garment(s) shown
- Skip items where < 40% of the item is visible
- Skip ALL jewelry, accessories, hair accessories
- Skip background objects: walls, furniture, art, mirrors, plants
- Set confidence based on how clearly identifiable the item is

For each piece:
{
  "name": "string",
  "category": "TOP|BOTTOM|DRESS|OUTERWEAR|FOOTWEAR|BAG|FULL_OUTFIT",
  "color": "string",
  "fit": "relaxed|regular|fitted|oversized",
  "season": "springsummer|fallwinter|allseason",
  "formality": 1-10,
  "confidence": 0.0-1.0,
  "boundingBox": { "top": number, "left": number, "width": number, "height": number }
}

Return ONLY: { "hasPerson": bool, "personBox": {...}|null, "pieces": [...] }
No markdown. Raw JSON only.`,
              },
            ],
          }],
        })

        // 15-second timeout on Pass 1
        const combinedResponse = await Promise.race([
          p1Promise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('ANALYSIS_TIMEOUT')), 15000),
          ),
        ])

        const combinedText = combinedResponse.content[0].type === 'text' ? combinedResponse.content[0].text.trim() : '{}'
        // Strip markdown fences in any form (```json, ```, etc.)
        const cleanedCombined = combinedText.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim()
        const combinedData = JSON.parse(cleanedCombined)

        if (combinedData.hasPerson && combinedData.personBox) {
          personBox = combinedData.personBox
          console.log(`[Wardrobe] ── Person located:`, personBox)
        }

        if (Array.isArray(combinedData.pieces)) {
          pieces = combinedData.pieces
        }
      } catch (pass1Err) {
        // Rethrow so the outer catch creates the fallback item — do NOT silently eat this
        console.error('[Wardrobe] ── Pass 1 failed:', pass1Err instanceof Error ? pass1Err.message : String(pass1Err))
        throw pass1Err
      }

      // Crop to person-only immediately after the combined call
      if (personBox && isValidPersonBox(personBox)) {
        try {
          personBuffer = await cropToPersonOnly(originalBuffer, personBox)
          console.log('[Wardrobe] ── Person cropped ✅')
        } catch {
          console.warn('[Wardrobe] ── Person crop failed, using original')
        }
      }

      // Filter: remove any low-confidence or bad-keyword items
      const BAD_KEYWORDS = [
        'earring', 'necklace', 'bracelet', 'watch', 'ring',
        'jewelry', 'jewellery', 'chain', 'pendant', 'choker',
        'stud', 'hoop', 'bangle', 'cuff', 'anklet',
        'hair clip', 'hair band', 'scrunchie',
        'painting', 'art', 'wall', 'background', 'furniture',
        'floor', 'ceiling', 'lamp', 'plant', 'frame', 'mirror',
        'sign', 'text', 'door', 'window', 'pillar', 'column',
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pieces = pieces.filter((piece: any) => {
        const name = (piece.name ?? '').toLowerCase()
        if (BAD_KEYWORDS.some(kw => name.includes(kw))) {
          console.log('[Wardrobe] ❌ Skipped bad keyword:', piece.name)
          return false
        }
        // Lower threshold to 0.55 — Claude is conservative on product/flat-lay photos
        if ((piece.confidence ?? 1) < 0.55) {
          console.log('[Wardrobe] ❌ Low confidence:', piece.name, piece.confidence)
          return false
        }
        return true
      })

      if (pieces.length === 0) {
        return NextResponse.json(
          { error: 'No clothing items detected. Please upload a photo of an outfit or clothing piece.' },
          { status: 400 }
        )
      }

      // ── PASS 2: Precise bounding boxes on person-only image ─────────────
      // Only runs for outfit photos (person detected, multiple pieces)
      if (personBox && isValidPersonBox(personBox) && pieces.length > 1) {
        try {
          console.log('[Wardrobe] ── Calling Claude (pass 2: precise bboxes on person-only)...')
          const personJpeg = await sharp(personBuffer).jpeg({ quality: 92 }).toBuffer()
          const personBase64 = personJpeg.toString('base64')

          const bboxResponse = await anthropic.messages.create({
            model: 'claude-haiku-3-5',
            max_tokens: 800,
            system: `CV specialist: draw precise bounding boxes around clothing items. Raw JSON array only.`,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: personBase64 } },
                {
                  type: 'text',
                  text: `Draw PRECISE bounding boxes around each clothing item listed below.

RULES (strictly enforced):
- Wrap TIGHTLY around the item — include 8% padding only
- TOP: shoulders to waist/hem — NEVER include the face
- BOTTOM: waist to ankle/hem — NEVER include the torso
- DRESS: shoulders to hem — NEVER include the face
- FOOTWEAR: ankle to sole — start below 50% of image height
- BAG: the bag only — not the arm holding it
- Set visible: false if item is not clearly visible

Items to locate:
${pieces.map(p => `- ${p.name} (${p.category})`).join('\n')}

Return ONLY:
[{
  "name": "exact name from list",
  "category": "category",
  "boundingBox": { "top": 0-100, "left": 0-100, "width": 1-100, "height": 1-100 },
  "confidence": 0.0-1.0,
  "visible": true/false
}]

Coordinates as % of THIS image dimensions. No markdown.`,
                },
              ],
            }],
          })

          const bboxText = bboxResponse.content[0].type === 'text' ? bboxResponse.content[0].text.trim() : '[]'
          const bboxData = JSON.parse(bboxText.replace(/```json|```/g, '').trim())

          if (Array.isArray(bboxData)) {
            for (const entry of bboxData) {
              if (!entry.visible || (entry.confidence ?? 0) < 0.7) continue
              const match = pieces.find(p => p.name.toLowerCase() === (entry.name ?? '').toLowerCase())
                ?? pieces.find(p => p.category.toUpperCase() === (entry.category ?? '').toUpperCase())
              if (match && entry.boundingBox) {
                match.boundingBox = entry.boundingBox
                console.log(`[Wardrobe] ── Precise bbox for ${match.name}:`, entry.boundingBox)
              }
            }
          }
        } catch (bboxErr) {
          console.warn('[Wardrobe] ── Pass 2 bbox failed (non-fatal):', bboxErr instanceof Error ? bboxErr.message : String(bboxErr))
        }
      }
    } catch (claudeErr: unknown) {
      const msg = claudeErr instanceof Error ? claudeErr.message : String(claudeErr)
      console.error('[Wardrobe] ── Claude failed:', msg)
      if (msg === 'ANALYSIS_TIMEOUT') {
        return NextResponse.json(
          { error: 'Analysis took too long. Please try again with a clearer, well-lit photo.' },
          { status: 504 }
        )
      }
      return NextResponse.json(
        { error: 'Could not identify clothing in this photo. Try a well-lit photo with clear clothing visible.' },
        { status: 400 }
      )
    }

    console.log(`[Wardrobe] ── Claude analysis complete: ${pieces.length} pieces`)

    // ── 6. INIT STORAGE CLIENT
    const adminClient = createAdminClient()
    console.log('[Wardrobe] ── Bucket ready')

    // ── 7. PROCESS EACH PIECE
    const savedItems: ReturnType<typeof serializeItem>[] = []
    const failedItems: { name: string; error: string }[] = []

    // isProductPhoto: flat lay or single-item photo → resize only; outfit → precision crop per piece
    const isProductPhoto = !personBox || pieces.length <= 1

    for (const piece of pieces) {
      let itemId: string | null = null

      try {
        console.log(`[Wardrobe] ── Processing: ${piece.name}`)

        // 7a. CREATE DB ROW
        const newId = generateSnowflakeId()
        const createData: Prisma.WardrobeItemUncheckedCreateInput = {
          id: newId,
          userId: BigInt(userId),
          name: piece.name ?? 'Unnamed piece',
          category: piece.category ?? 'TOP',
          colors: { set: piece.color ? [piece.color] : [] },
          fit: piece.fit ?? 'regular',
          season: { set: piece.season ? [piece.season] : [] },
          formality: piece.formality ?? 5,
        }

        const item = await prisma.wardrobeItem.create({ data: createData })
        itemId = item.id.toString()
        console.log(`[Wardrobe] ── DB row created: ${itemId}`)

        // 7b. BUILD IMAGE BUFFER
        let imageBuffer: Buffer
        if (isProductPhoto) {
          console.log('[Wardrobe] Product photo — resizing for:', piece.name)
          imageBuffer = await resizeProductPhoto(originalBuffer, piece.category)
        } else {
          console.log('[Wardrobe] Outfit photo — precision crop for:', piece.name, piece.category)
          imageBuffer = await precisionCropItem(
            personBuffer,
            piece.boundingBox ?? null,
            piece.category,
            piece.confidence ?? 0.8
          )
        }

        // 7c. UPLOAD IMAGE
        console.log('[Wardrobe] Uploading image for:', piece.name)
        let publicUrl: string
        try {
          publicUrl = await uploadItemImage(
            adminClient,
            userId,
            itemId,
            imageBuffer
          )
          console.log(`[Wardrobe] ── Uploaded: ${publicUrl}`)
        } catch (uploadErr: unknown) {
          const msg =
            uploadErr instanceof Error
              ? uploadErr.message
              : String(uploadErr)
          console.error('[Wardrobe] ── Upload failed:', msg)
          throw uploadErr
        }

        // 7d. UPDATE DB WITH IMAGE URL
        const storagePath = `${userId}/${itemId}.jpg`
        const updated = await prisma.wardrobeItem.update({
          where: { id: item.id },
          data: { imageUrl: publicUrl, storagePath },
        })

        savedItems.push(
          serializeItem(updated as unknown as Record<string, unknown>)
        )
        console.log(`[Wardrobe] ✅ Done: ${piece.name}`)
      } catch (pieceErr: unknown) {
        const errMsg =
          pieceErr instanceof Error ? pieceErr.message : String(pieceErr)
        console.error(`[Wardrobe] ❌ Failed: ${piece.name}: ${errMsg}`)

        // ROLLBACK DB ROW
        if (itemId) {
          try {
            await prisma.wardrobeItem.delete({
              where: { id: BigInt(itemId) },
            })
          } catch {
            // Silently ignore rollback failures
          }
        }

        failedItems.push({ name: piece.name, error: errMsg })
      }
    }

    console.log(
      `[Wardrobe] ── Completed in ${Date.now() - startTime}ms: ${savedItems.length} saved, ${failedItems.length} failed`
    )

    if (savedItems.length === 0) {
      console.error('[Wardrobe] ❌ No items saved')
      return NextResponse.json(
        { error: "Couldn't save your photo. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      items: savedItems,
      saved: savedItems.length,
      failed: failedItems.length,
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : undefined
    console.error(`[Wardrobe] ❌ FATAL ERROR: ${errMsg}`)
    if (errStack) console.error(`[Wardrobe] Stack:`, errStack)
    return NextResponse.json(
      {
        error: errMsg,
        detail: 'Check server logs for stack trace',
      },
      { status: 500 }
    )
  }
}

