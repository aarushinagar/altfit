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
  console.log('[ALTFIT] Starting outfit generation')

  try {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const userIdBigInt = BigInt(userId)
    console.log(`[ALTFIT] Auth: ${Date.now() - t0}ms`)

    const tz        = DEFAULT_TIMEZONE
    const localDate = new Date().toLocaleDateString('sv-SE') // "YYYY-MM-DD"

    // ── 1. Cache check ──────────────────────────────────────────────────────
    const dailyCuration = await prisma.dailyCuration.findFirst({
      where: { userId: userIdBigInt, localDate },
    })
    console.log(`[ALTFIT] Cache check: ${Date.now() - t0}ms — ${dailyCuration?.slot1 ? 'HIT' : 'MISS'}`)

    if (dailyCuration?.slot1) {
      const outfit = dailyCuration.slot1 as any
      if (Array.isArray(outfit?.looks) && outfit.looks.length > 0) {
        // Cache hit — outfit is already fully enriched (name, imageUrl, etc.).
        // No wardrobe re-fetch needed — return instantly.
        console.log(`[ALTFIT] Cache HIT — returning in ${Date.now() - t0}ms`)
        return NextResponse.json(
          { outfit, cached: true },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } },
        )
      }
    }
    console.log('[ALTFIT] Cache MISS — generating fresh outfit')

    // ── 2. Fetch data in parallel ───────────────────────────────────────────
    const [wardrobe, history] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where: { userId: userIdBigInt, isActive: true },
        select: { id: true, name: true, category: true, colorNames: true, imageUrl: true, formality: true, fit: true },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.outfitHistory.findMany({
        where: { userId: userIdBigInt },
        select: { outfitName: true },
        orderBy: { curatedAt: 'desc' },
        take: 5,
      }),
    ])

    console.log(`[ALTFIT] Wardrobe fetched: ${Date.now() - t0}ms — ${wardrobe.length} items (${wardrobe.filter((w: any) => w.imageUrl).length} with photos)`)

    if (wardrobe.length === 0) {
      return NextResponse.json(
        { error: 'Add some clothing pieces to your wardrobe first.' },
        { status: 400 },
      )
    }

    // ── 3. Build prompt context ─────────────────────────────────────────────
    // 20 items max, shuffled — fewer tokens = faster Haiku response
    const wardrobeShuffled = shuffle(wardrobe).slice(0, 20)
    const wardrobeContext  = wardrobeShuffled
      .map((w: any) => `${w.id}|${w.name}|${w.category}|${w.colorNames?.[0] ?? 'unknown'}`)
      .join('\n')

    const recentNames = history.length > 0
      ? history.map((h: any) => h.outfitName).filter(Boolean).slice(0, 3).join(', ')
      : ''

    console.log(`[ALTFIT] Items filtered: ${Date.now() - t0}ms — ${wardrobeShuffled.length} items sent to Claude`)

    // ── 4. Call Claude ──────────────────────────────────────────────────────
    console.log('[ALTFIT] Calling Claude...')
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Compact system prompt — Haiku performs best with tight, unambiguous instructions
    const systemPrompt = `You are ALT FIT, an expert personal stylist. Build cohesive, wearable outfits from the wardrobe provided.

HARD RULES (never break):
- Max 4 items per look, min 2
- Exactly 1 TOP or 1 DRESS (never both, never DRESS + BOTTOM)
- Max 1 FOOTWEAR, 1 BAG, 1 OUTERWEAR per look
- Formality consistent across all items (±2 points)
- Colors must work together: tonal, neutral base + accent, or monochrome
- Every item must suit the same occasion
- Return raw JSON only — no markdown, no prose`

    const userPrompt = `Build 3 outfit suggestions from this wardrobe.

WARDROBE (copy IDs exactly):
${wardrobeContext}
${recentNames ? `\nAvoid repeating: ${recentNames}` : ''}
Context: Mumbai, 31°C humid, ${new Date().toLocaleDateString('en-IN', { weekday: 'long' })}, seed:${Date.now()}

Build: MORNING (casual/relaxed) · DAYTIME (smart/practical) · EVENING (elevated/polished)

Return ONLY this JSON:
{"looks":[{"lookType":"MORNING","outfitName":"2-4 words","mood":"1 word","formality":"RELAXED","items":[{"id":"exact-id","reason":"8 words"}],"stylingNote":"2 sentences","occasionTags":["tag"],"tip":"1 sentence"},{"lookType":"DAYTIME",...},{"lookType":"EVENING",...}]}`

    const claudePromise = anthropic.messages.create({
      model:      'claude-haiku-3-5',
      max_tokens: 700,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    // 5-second hard timeout — never leave user waiting indefinitely
    let response: any
    try {
      response = await Promise.race([
        claudePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 5000),
        ),
      ])
    } catch (err: any) {
      if ((err as Error).message === 'TIMEOUT') {
        console.error(`[ALTFIT] ❌ Claude timed out after 5s (${Date.now() - t0}ms total)`)
        // Fallback: return yesterday's cached outfit rather than an error
        const fallback = await prisma.dailyCuration.findFirst({
          where: { userId: userIdBigInt, NOT: { localDate } },
          orderBy: { localDate: 'desc' },
        })
        if (fallback?.slot1) {
          console.log('[ALTFIT] Returning fallback from previous day')
          return NextResponse.json(
            { outfit: fallback.slot1, cached: true, fallback: true },
            { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
          )
        }
        return NextResponse.json(
          { error: 'Taking too long. Please tap Retry.' },
          { status: 504 },
        )
      }
      throw err
    }

    console.log(`[ALTFIT] Claude responded: ${Date.now() - t0}ms`)

    // ── 5. Parse response ───────────────────────────────────────────────────
    const raw = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '{}'

    let outfit: any
    try {
      outfit = JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      console.error(`[ALTFIT] Parse failed (${Date.now() - t0}ms):`, raw.substring(0, 300))
      // Fallback to yesterday's outfit rather than showing an error
      const fallback = await prisma.dailyCuration.findFirst({
        where: { userId: userIdBigInt, NOT: { localDate } },
        orderBy: { localDate: 'desc' },
      })
      if (fallback?.slot1) {
        return NextResponse.json(
          { outfit: fallback.slot1, cached: true, fallback: true },
          { headers: { 'Cache-Control': 'no-store' } },
        )
      }
      return NextResponse.json(
        { error: 'Could not generate your outfit. Please try again.' },
        { status: 500 },
      )
    }

    if (!Array.isArray(outfit?.looks) || outfit.looks.length === 0) {
      console.error(`[ALTFIT] No valid looks in response (${Date.now() - t0}ms):`, JSON.stringify(outfit).substring(0, 200))
      return NextResponse.json(
        { error: 'Could not generate your outfit. Please try again.' },
        { status: 500 },
      )
    }

    console.log(
      '[Curation] ── Raw looks:', outfit.looks.length,
      '| items per look:', outfit.looks.map((l: any) => l.items?.length ?? 0).join(', '),
    )

    // ── 5b. Deduplicate + validate looks (before enriching) ─────────────────
    // BULLETPROOF VALIDATION: enforce hard limits on all categories
    function enforceStylingRules(looks: any[]): any[] {
      return looks.map((look: any) => {
        const items: any[] = look.items ?? []
        const seen: Record<string, number> = {}
        
        // Hard category limits
        const limits: Record<string, number> = {
          FOOTWEAR:   1,
          BAG:        1,
          OUTERWEAR:  1,
          BOTTOM:     1,
          DRESS:      1,
          TOP:        1,  // Changed from 2 to 1 for strict enforcement
        }

        // Filter duplicates within category
        const deduped = items.filter((item: any) => {
          const cat = (item.category ?? '').toUpperCase()
          seen[cat] = (seen[cat] ?? 0) + 1
          const limit = limits[cat] ?? 1
          if (seen[cat] > limit) {
            console.log(`[Style] ❌ Removed duplicate ${cat}:`, item.name ?? item.id)
            return false
          }
          return true
        })

        // Remove BOTTOM if DRESS present (dress replaces top+bottom)
        const hasDress = deduped.some((i: any) =>
          (i.category ?? '').toUpperCase() === 'DRESS'
        )
        const final = hasDress
          ? deduped.filter((i: any) => {
              const cat = (i.category ?? '').toUpperCase()
              return cat !== 'BOTTOM' && cat !== 'TOP'
            })
          : deduped

        // Log final look composition
        const composition = final.map((i: any) => i.category).join(' + ')
        console.log(`[Style] ${look.lookType}: ${composition}`)

        return { ...look, items: final }
      }).filter((look: any) => {
        const items: any[] = look.items ?? []
        
        // Must have at least clothing base
        const hasClothing = items.some((i: any) =>
          ['TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'FULL_OUTFIT']
            .includes((i.category ?? '').toUpperCase())
        )
        
        // Must have 2+ items and valid clothing
        if (items.length < 2 || !hasClothing) {
          console.log(`[Style] ❌ Rejected ${look.outfitName}: incomplete (${items.length} items, clothing=${hasClothing})`)
          return false
        }
        return true
      })
    }

    outfit.looks = enforceStylingRules(outfit.looks)

    if (outfit.looks.length === 0) {
      console.error('[Curation] All looks rejected after deduplication')
      return NextResponse.json(
        { error: 'Could not generate a valid outfit. Please try again.' },
        { status: 500 },
      )
    }

    // ── 6. Enrich all looks with real wardrobe data ─────────────────────────
    outfit.looks = enrichLooks(outfit.looks, wardrobe)

    console.log(`[ALTFIT] Enriched: ${Date.now() - t0}ms`)
    outfit.looks.forEach((look: any) => {
      const withPhotos = look.items.filter((i: any) => i.imageUrl).length
      console.log(`  ${look.lookType}: ${look.items.length} items, ${withPhotos} with photos`)
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
      console.log(`[ALTFIT] Saved to cache + history`)
    })

    console.log(`[ALTFIT] Total time: ${Date.now() - t0}ms`)
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
