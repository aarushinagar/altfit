/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/curate-outfit
 * Generates 3 curated outfit looks (MORNING, DAYTIME, EVENING) from the user's wardrobe.
 * Uses Claude claude-sonnet-4-6. Cached by local date in DailyCuration.slot1.
 *
 * NOTE: The app uses Prisma ORM (PascalCase models, camelCase fields).
 * Supabase PostgREST cannot resolve WardrobeItem via 'wardrobe_items' — use Prisma only.
 *
 * CRITICAL ID MATCHING: Prisma returns BigInt IDs; Claude returns them as JSON strings.
 * Always use String(w.id) as map key so lookups work correctly.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/backend/database/prisma'
import { requireAuth } from '@/backend/database/auth-middleware'
import { generateSnowflakeId } from '@/backend/database/snowflake'

const DEFAULT_TIMEZONE = 'Asia/Kolkata'

/** Fisher-Yates shuffle — ensures different wardrobe ordering each call → different Claude picks */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Enrich look items with real wardrobe data (name, category, imageUrl, etc.).
 * Wardrobe IDs are BigInt from Prisma; Claude returns them as strings in JSON.
 * We use String(w.id) as map keys so the lookup always succeeds.
 */
function enrichLooks(looks: any[], wardrobe: any[]): any[] {
  // KEY FIX: String(w.id) converts BigInt → string so map.get(string_id) works
  const map = new Map(wardrobe.map((w: any) => [String(w.id), w]))

  return looks.map((look: any) => ({
    ...look,
    items: (look.items ?? [])
      .map((item: any) => {
        const real = map.get(String(item.id))
        if (!real) {
          console.log('[Enrich] ❌ No match:', item.id, '| reason:', item.reason?.slice(0, 30))
          return null
        }
        console.log('[Enrich] ✅', real.name, '| photo:', !!real.imageUrl)
        return {
          id:        String(real.id),
          name:      real.name,
          category:  real.category,
          color:     real.colorNames?.[0] ?? 'unknown',
          imageUrl:  real.imageUrl ?? null,
          formality: real.formality,
          fit:       real.fit,
          reason:    item.reason,
        }
      })
      .filter(Boolean),
  }))
}

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  console.log('[Curation] ── START')

  try {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const userIdBigInt = BigInt(userId)
    console.log('[Curation] ── User:', userId)

    const tz        = DEFAULT_TIMEZONE
    const localDate = new Date().toLocaleDateString('sv-SE') // "YYYY-MM-DD"

    // ── 1. Cache check ──────────────────────────────────────────────────────
    const dailyCuration = await prisma.dailyCuration.findFirst({
      where: { userId: userIdBigInt, localDate },
    })

    if (dailyCuration?.slot1) {
      const outfit = dailyCuration.slot1 as any
      if (Array.isArray(outfit?.looks) && outfit.looks.length > 0) {
        // Re-enrich to get latest imageUrl values
        const wardrobe = await prisma.wardrobeItem.findMany({
          where: { userId: userIdBigInt, isActive: true },
          select: { id: true, name: true, category: true, colorNames: true, imageUrl: true, formality: true, fit: true },
        })
        outfit.looks = enrichLooks(outfit.looks, wardrobe)
        console.log('[Curation] ── Cache HIT — serving enriched')
        return NextResponse.json(
          { outfit, cached: true },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } },
        )
      }
    }
    console.log('[Curation] ── Cache MISS — generating')

    // ── 2. Fetch data in parallel ───────────────────────────────────────────
    const [wardrobe, history, _profile] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where: { userId: userIdBigInt, isActive: true },
        select: { id: true, name: true, category: true, colorNames: true, imageUrl: true, formality: true, fit: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.outfitHistory.findMany({
        where: { userId: userIdBigInt },
        select: { outfitName: true, itemNames: true },
        orderBy: { curatedAt: 'desc' },
        take: 7,
      }),
      prisma.userStyleProfile.findUnique({
        where: { userId: userIdBigInt },
      }),
    ])

    console.log('[Curation] Total wardrobe items:', wardrobe.length)
    console.log('[Curation] Items with photos:', wardrobe.filter((w: any) => w.imageUrl).length)

    if (wardrobe.length === 0) {
      return NextResponse.json(
        { error: 'Add some clothing pieces to your wardrobe first.' },
        { status: 400 },
      )
    }

    // ── 3. Build prompt context ─────────────────────────────────────────────
    // 15 items max, shuffled — fewer tokens = faster response
    const wardrobeShuffled = shuffle(wardrobe).slice(0, 15)
    const wardrobeContext  = wardrobeShuffled
      .map((w: any) => `${w.id}|${w.name}|${w.category}|${w.colorNames?.[0] ?? 'unknown'}`)
      .join('\n')

    const recentNames = history.length > 0
      ? history.map((h: any) => h.outfitName).filter(Boolean).slice(0, 3).join(', ')
      : 'nothing yet'

    console.log('[Curation] ── Wardrobe:', wardrobeShuffled.length, 'items (shuffled)')

    // ── 4. Call Claude ──────────────────────────────────────────────────────
    console.log('[Curation] ── Calling Claude...')
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `You are ALT FIT, a personal stylist.
Build 3 complete outfit suggestions from the user's wardrobe.
Be specific. Be cohesive. Be fast.`

    const userPrompt = `Wardrobe (use exact IDs):
${wardrobeContext}

Avoid repeating: ${recentNames}
City: Mumbai, 31°C humid. Date: ${localDate}
Seed: ${Date.now()}

Return 3 looks: MORNING, DAYTIME, EVENING.
Each look: 2-3 pieces max. Different pieces per look.

JSON only, no markdown:
{"looks":[
  {"lookType":"MORNING","outfitName":"2-3 words","mood":"word","formality":"RELAXED","items":[{"id":"exact-id","reason":"10 words max"}],"stylingNote":"2 sentences","occasionTags":["tag1","tag2"],"tip":"1 sentence"},
  {"lookType":"DAYTIME","outfitName":"2-3 words","mood":"word","formality":"SMART","items":[{"id":"exact-id","reason":"10 words max"}],"stylingNote":"2 sentences","occasionTags":["tag1","tag2"],"tip":"1 sentence"},
  {"lookType":"EVENING","outfitName":"2-3 words","mood":"word","formality":"ELEVATED","items":[{"id":"exact-id","reason":"10 words max"}],"stylingNote":"2 sentences","occasionTags":["tag1","tag2"],"tip":"1 sentence"}
]}`

    const claudePromise = anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    // Hard 20s timeout — never hang forever
    let response: any
    try {
      response = await Promise.race([
        claudePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 20000),
        ),
      ])
    } catch (err: any) {
      if ((err as Error).message === 'TIMEOUT') {
        console.error('[Curation] ❌ Claude timed out after 20s')
        return NextResponse.json(
          { error: 'Taking too long. Please tap Retry.' },
          { status: 504 },
        )
      }
      throw err
    }

    console.log('[Curation] ── Claude responded ✅')

    // ── 5. Parse response ───────────────────────────────────────────────────
    const raw = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '{}'

    let outfit: any
    try {
      outfit = JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      console.error('[Curation] Parse failed:', raw.substring(0, 300))
      return NextResponse.json(
        { error: 'Could not generate your outfit. Please try again.' },
        { status: 500 },
      )
    }

    if (!Array.isArray(outfit?.looks) || outfit.looks.length === 0) {
      console.error('[Curation] No valid looks in response:', JSON.stringify(outfit).substring(0, 200))
      return NextResponse.json(
        { error: 'Could not generate your outfit. Please try again.' },
        { status: 500 },
      )
    }

    console.log(
      '[Curation] ── Raw looks:', outfit.looks.length,
      '| items per look:', outfit.looks.map((l: any) => l.items?.length ?? 0).join(', '),
    )

    // ── 6. Enrich all looks with real wardrobe data ─────────────────────────
    outfit.looks = enrichLooks(outfit.looks, wardrobe)

    console.log('[Curation] Looks enriched:')
    outfit.looks.forEach((look: any) => {
      console.log(
        `  ${look.lookType}: ${look.items.length} items,`,
        `${look.items.filter((i: any) => i.imageUrl).length} with photos`,
      )
    })

    // ── 7. Save to cache + history (non-blocking) ───────────────────────────
    Promise.allSettled([
      // Cache: store as slot1 in DailyCuration
      (async () => {
        if (!dailyCuration) {
          await prisma.dailyCuration.create({
            data: {
              id:                generateSnowflakeId(),
              userId:            userIdBigInt,
              localDate,
              userTimezone:      tz,
              weatherTempC:      31,
              weatherFeelsLikeC: 35,
              weatherCondition:  'humid',
              weatherLocation:   'Mumbai',
              slot1:             outfit,
            },
          })
        } else {
          await prisma.dailyCuration.update({
            where: { id: dailyCuration.id },
            data:  { slot1: outfit },
          })
        }
      })(),
      // History: one record per look
      ...outfit.looks.map((look: any) =>
        prisma.outfitHistory.create({
          data: {
            id:          generateSnowflakeId(),
            userId:      userIdBigInt,
            outfitName:  look.outfitName,
            itemIds:     look.items.map((i: any) => String(i.id)),
            itemNames:   look.items.map((i: any) => i.name),
            stylingNote: look.stylingNote,
            vibe:        look.mood,
            occasionTags: look.occasionTags ?? [],
          },
        }),
      ),
    ]).then(() => {
      console.log('[Curation] ── Saved to cache + history')
    })

    console.log(`[Curation] ── DONE in ${Date.now() - t0}ms`)
    return NextResponse.json(
      { outfit, cached: false },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } },
    )

  } catch (err: any) {
    console.error('[Curation] ❌ Fatal:', (err as Error).message)
    return NextResponse.json(
      { error: 'Could not generate your outfit. Please try again.' },
      { status: 500 },
    )
  }
}
