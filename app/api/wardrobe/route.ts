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
import { cropToPersonOnly, isValidPersonBox, smartCropByCategory } from '@/lib/imageCropper'
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

    const [items, total] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where: { userId: BigInt(userId), isActive: true },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.wardrobeItem.count({
        where: { userId: BigInt(userId), isActive: true },
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

    // ── 4. CONVERT TO BUFFER
    const originalBuffer = Buffer.from(await file.arrayBuffer())
    console.log(`[Wardrobe] ── Buffer ready: ${originalBuffer.length} bytes`)

    // ── 5. CALL CLAUDE FOR ANALYSIS
    console.log('[Wardrobe] ── Calling Claude (pass 1: locate person)...')
    let pieces: DetectedPiece[] = []
    let personBox: { top: number; left: number; width: number; height: number } | null = null

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const base64Image = originalBuffer.toString('base64')
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

      // ── PASS 1: Locate the person ──────────────────────────────────────
      try {
        const personResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
              { type: 'text', text: `Where is the person in this image?\nReturn ONLY JSON: { "personBox": { "top": number, "left": number, "width": number, "height": number }, "hasPerson": true/false }\nCoordinates are % of image dimensions. No markdown.` }
            ]
          }]
        })
        const personText = personResponse.content[0].type === 'text' ? personResponse.content[0].text.trim() : '{}'
        const personData = JSON.parse(personText.replace(/```json|```/g, '').trim())
        if (personData.hasPerson && personData.personBox) {
          personBox = personData.personBox
          console.log(`[Wardrobe] ── Person located:`, personBox)
        }
      } catch (personErr) {
        console.warn('[Wardrobe] ── Pass 1 failed (non-fatal):', personErr instanceof Error ? personErr.message : String(personErr))
      }

      // ── PASS 2: Detect clothing items ──────────────────────────────────
      console.log('[Wardrobe] ── Calling Claude (pass 2: detect items)...')
      const personContext = personBox
        ? `The person in this image is located at:\nTop: ${personBox.top}%, Left: ${personBox.left}%, Width: ${personBox.width}%, Height: ${personBox.height}%\n\nIdentify ONLY clothing items worn ON this person's body.\nNEVER detect jewelry, accessories, earrings, necklaces, bracelets, rings, watches, or hair accessories.\nThe large painting/artwork in the background is NOT a clothing item — ignore it completely.\nBackground objects, walls, mirrors, and furniture are NOT clothing items.\n\nFor each worn clothing item, provide a bounding box that:\n- Falls WITHIN or near the person's region above\n- Tightly wraps ONLY that specific item on the person's body\n- For dress/top: crop the torso/body area\n- For shoes: crop just the feet area\n- For bag: crop just the bag being held`
        : `Identify ONLY clothing items WORN by the person in this photo.\nNever detect background objects, art, furniture, walls, or jewelry of any kind.`

      const analysisResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
            {
              type: 'text',
              text: `${personContext}

VISIBILITY RULES — Only detect items that are CLEARLY and FULLY VISIBLE:
- Skip items mostly hidden behind other objects or the person's body
- Skip items where less than 50% of the item is visible
- Skip items obscured by outerwear or other clothing
- Skip items barely visible in the background
- If a bag is mostly hidden behind the person's body → skip it
- If shoes are cut off at the bottom edge → skip them
- If a top is mostly covered by a jacket → skip it
Set confidence below 0.6 for anything you are not sure about. Only include items where confidence >= 0.75.

STRICT RULES — NEVER detect or return these item types, skip them completely:
- Earrings of any kind (studs, hoops, dangles)
- Necklaces of any kind (chains, pendants, chokers)
- Bracelets of any kind
- Watches of any kind
- Rings of any kind
- Any jewelry whatsoever
- Hair accessories (clips, bands, pins)

ONLY detect and return items from these categories:
- TOP (shirts, blouses, crop tops, bodysuits, tube tops, corsets)
- BOTTOM (trousers, jeans, skirts, shorts)
- DRESS (any one-piece dress or jumpsuit)
- OUTERWEAR (jackets, coats, blazers)
- FOOTWEAR (shoes, sandals, heels, boots, sneakers)
- BAG (handbags, clutches, shoulder bags, totes, crossbody)
- FULL_OUTFIT (when shooting the complete look)

If the image contains ONLY jewelry with no clothing → return []

BOUNDING BOX RULES:
- top: y-coordinate of TOP EDGE (0=top, 100=bottom)
- left: x-coordinate of LEFT EDGE (0=left, 100=right)
- width/height: span of item only, as % of image dimensions
- confidence must reflect certainty of BOTH item identity AND location

Return ONLY valid JSON array. No markdown. Raw JSON only.
[{
  "name": "string",
  "category": "TOP|BOTTOM|DRESS|OUTERWEAR|FOOTWEAR|BAG|FULL_OUTFIT",
  "color": "string",
  "fit": "relaxed|regular|fitted|oversized",
  "season": "springsummer|fallwinter|allseason",
  "formality": 1-10,
  "confidence": 0.0-1.0,
  "boundingBox": { "top": number, "left": number, "width": number, "height": number }
}]`,
            },
          ],
        }]
      })

      const rawText =
        analysisResponse.content[0].type === 'text'
          ? analysisResponse.content[0].text.trim()
          : '[]'

      try {
        const cleaned = rawText.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        pieces = Array.isArray(parsed) ? parsed : [parsed]

        // ── FILTERING ──
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
          const isBad = BAD_KEYWORDS.some(kw => name.includes(kw))
          if (isBad) {
            console.log('[Wardrobe] ❌ Skipped:', piece.name)
            return false
          }
          if ((piece.confidence ?? 1) < 0.75) {
            console.log('[Wardrobe] ❌ Low confidence:', piece.name, piece.confidence)
            return false
          }
          return true
        })

        if (pieces.length === 0) {
          return NextResponse.json(
            {
              error:
                'No clothing items detected. Please upload a photo of an outfit or clothing piece.',
            },
            { status: 400 }
          )
        }
      } catch (_parseErr: unknown) {
        console.warn('[Wardrobe] ── Claude parse failed, using fallback')
        pieces = [
          {
            name: 'Clothing item',
            category: 'TOP',
            color: 'unknown',
            fit: 'regular',
            season: 'allseason',
            formality: 5,
            boundingBox: null,
          },
        ]
      }
    } catch (claudeErr: unknown) {
      const msg =
        claudeErr instanceof Error ? claudeErr.message : String(claudeErr)
      console.error('[Wardrobe] ── Claude failed:', msg)
      // Even if Claude fails, create a generic item
      pieces = [
        {
          name: 'Clothing item',
          category: 'TOP',
          color: 'unknown',
          fit: 'regular',
          season: 'allseason',
          formality: 5,
          boundingBox: null,
        },
      ]
    }

    console.log(`[Wardrobe] ── Claude analysis complete: ${pieces.length} pieces`)

    // ── 6. INIT STORAGE CLIENT
    const adminClient = createAdminClient()
    console.log('[Wardrobe] ── Bucket ready')

    // ── 7. PROCESS EACH PIECE
    const savedItems: ReturnType<typeof serializeItem>[] = []
    const failedItems: { name: string; error: string }[] = []

    // Pre-crop to person region once — all per-piece crops operate on this
    const isProductPhoto = !personBox || pieces.length === 1
    let personBuffer: Buffer
    try {
      personBuffer = personBox && isValidPersonBox(personBox)
        ? await cropToPersonOnly(originalBuffer, personBox)
        : originalBuffer
    } catch {
      personBuffer = originalBuffer
    }

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

        // 7b. BUILD IMAGE BUFFER — product photo: full image; outfit: smart crop by category
        let imageBuffer: Buffer
        if (isProductPhoto) {
          console.log('[Wardrobe] Product photo — full image for:', piece.name)
          imageBuffer = await sharp(originalBuffer)
            .resize(600, 750, {
              fit: 'contain',
              background: { r: 248, g: 246, b: 242, alpha: 1 },
            })
            .jpeg({ quality: 90 })
            .toBuffer()
        } else {
          console.log('[Wardrobe] Outfit photo — smart crop for:', piece.name, piece.category)
          imageBuffer = await smartCropByCategory(personBuffer, piece.category)
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

