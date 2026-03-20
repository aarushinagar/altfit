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
      // Validate cache: must have looks with at least 1 item each
      const hasValidLooks = Array.isArray(outfit?.looks) &&
        outfit.looks.length > 0 &&
        outfit.looks.every((l: any) => Array.isArray(l.items) && l.items.length > 0)
      if (hasValidLooks) {
        console.log(`[ALTFIT] Cache HIT — returning in ${Date.now() - t0}ms`)
        return NextResponse.json(
          { outfit, cached: true },
          { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } },
        )
      }
      // Stale/broken cache — delete it and regenerate fresh
      console.warn('[ALTFIT] Cache entry invalid (empty items) — deleting and regenerating')
      await prisma.dailyCuration.delete({ where: { id: dailyCuration.id } }).catch(() => {})
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
    // Use short stable indices W1-W20 instead of raw 19-digit Snowflake IDs.
    // Snowflake IDs exceed JS float precision (2^53) so Claude may round them,
    // which breaks ID matching after JSON.parse. Short indices are safe.
    const wardrobeShuffled = shuffle(wardrobe).slice(0, 20)

    // Build index → real ID map for reverse lookup after Claude responds
    const idxToRealId = new Map<string, string>()
    wardrobeShuffled.forEach((w: any, i: number) => {
      idxToRealId.set(`W${i + 1}`, String(w.id))
    })

    const wardrobeContext = wardrobeShuffled
      .map((w: any, i: number) => `W${i + 1}|${w.name}|${w.category}|${w.colorNames?.[0] ?? 'unknown'}`)
      .join('\n')

    const recentNames = history.length > 0
      ? history.map((h: any) => h.outfitName).filter(Boolean).slice(0, 3).join(', ')
      : ''

    console.log(`[ALTFIT] Items filtered: ${Date.now() - t0}ms — ${wardrobeShuffled.length} items sent to Claude`)

    // ── 4. Call Claude ──────────────────────────────────────────────────────
    console.log('[ALTFIT] Calling Claude...')
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

WARDROBE (use the W-codes as IDs exactly — do NOT change them):
${wardrobeContext}
${recentNames ? `\nAvoid repeating: ${recentNames}` : ''}
Context: Mumbai, 31°C humid, ${new Date().toLocaleDateString('en-IN', { weekday: 'long' })}, seed:${Date.now()}

Build: MORNING (casual/relaxed) · DAYTIME (smart/practical) · EVENING (elevated/polished)

Return ONLY this JSON:
{"looks":[{"lookType":"MORNING","outfitName":"2-4 words","mood":"1 word","formality":"RELAXED","items":[{"id":"W1","reason":"8 words"}],"stylingNote":"2 sentences","occasionTags":["tag"],"tip":"1 sentence"},{"lookType":"DAYTIME",...},{"lookType":"EVENING",...}]}`

    // Helper to call Claude with a per-attempt timeout
    const callClaude = () => anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 700,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    // 15-second hard timeout — allow for Render cold-start + network latency
    async function callClaudeWithTimeout(ms: number) {
      return Promise.race([
        callClaude(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), ms),
        ),
      ])
    }

    let response: any
    try {
      response = await callClaudeWithTimeout(15000)
    } catch (firstErr: any) {
      if ((firstErr as Error).message === 'TIMEOUT') {
        console.warn(`[ALTFIT] ⚠️ Claude attempt 1 timed out at 15s — retrying once...`)
        try {
          response = await callClaudeWithTimeout(15000)
          console.log(`[ALTFIT] ✅ Claude succeeded on retry at ${Date.now() - t0}ms`)
        } catch {
          console.error(`[ALTFIT] ❌ Claude timed out on both attempts (${Date.now() - t0}ms total)`)
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
      } else {
        throw firstErr
      }
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

    // ── 5b. Translate W-indices → real Snowflake IDs ─────────────────────────
    // Claude returns W1, W2, ... — map back to real DB IDs before enriching.
    let unmatchedCount = 0
    outfit.looks = outfit.looks.map((look: any) => ({
      ...look,
      items: (look.items ?? []).map((item: any) => {
        const realId = idxToRealId.get(item.id)
        if (!realId) {
          console.warn(`[ALTFIT] ⚠️ No mapping for Claude ID: "${item.id}"`)
          unmatchedCount++
          return null
        }
        return { ...item, id: realId }
      }).filter(Boolean),
    }))
    console.log(`[ALTFIT] ID translation complete: ${unmatchedCount} unmatched items`)

    // ── 6. Enrich all looks with real wardrobe data ─────────────────────────
    // NOTE: Enrich BEFORE styling rules — Claude only returns {id, reason},
    // categories come from the wardrobe DB. Rules need category to be present.
    outfit.looks = enrichLooks(outfit.looks, wardrobe)

    console.log(`[ALTFIT] Enriched: ${Date.now() - t0}ms`)
    outfit.looks.forEach((look: any) => {
      const withPhotos = look.items.filter((i: any) => i.imageUrl).length
      console.log(`  ${look.lookType}: ${look.items.length} items, ${withPhotos} with photos`)
    })

    // Drop looks where enrichment found zero matching wardrobe items
    outfit.looks = outfit.looks.filter((look: any) => {
      if (look.items.length < 1) {
        console.warn(`[ALTFIT] ⚠️ Dropped look '${look.outfitName}' — zero items matched wardrobe`)
        return false
      }
      return true
    })

    if (outfit.looks.length === 0) {
      console.error('[ALTFIT] ❌ All looks dropped after enrichment — IDs from Claude do not match wardrobe')
      return NextResponse.json(
        { error: 'Could not match outfit items to your wardrobe. Please retry.' },
        { status: 500 },
      )
    }

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
