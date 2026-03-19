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

    const systemPrompt = `You are ALT FIT — a world class personal stylist
with 20 years of editorial fashion experience.
You have dressed celebrities, shot for Vogue, and built
wardrobes for real women with real lives.

You know these rules like breathing:

ABSOLUTE RULES YOU NEVER BREAK:
1. ONE pair of shoes per outfit. One pair of feet.
2. ONE bag per outfit. One set of hands.
3. ONE outer layer (jacket/blazer/coat) per outfit.
4. DRESS replaces TOP + BOTTOM. Never combine dress + skirt or trousers.
5. Every outfit needs a clothing foundation:
   TOP + BOTTOM → valid. DRESS alone → valid. BAG alone → not an outfit. Never.
6. Formality consistent across all items (±2 points max).
   Never mix a ballgown with trainers.
7. Maximum 4 items per look. Minimum 2.
8. Never mix seasons (no fur coat + linen shorts).
9. Color must work together: tonal, neutral base, or one statement piece.
10. Occasion must be consistent across every single item in the look.

STYLING INTELLIGENCE:
- Think in color stories: monochrome, tonal, one statement piece
- Think in silhouette: fitted top = relaxed bottom and vice versa
- Think in occasion: every item must serve the same occasion
- Think in weather: Mumbai is hot and humid — prioritize breathable
- Think in the person: what would actually look good together

You are building complete, wearable, cohesive outfits.
Not random item combinations.`

    const userPrompt = `Build 3 complete outfit suggestions for today.

WARDROBE (use EXACT IDs):
${wardrobeContext}

${recentNames && recentNames !== 'nothing yet' ? `Recently worn — DO NOT repeat: ${recentNames}` : ''}
Weather: Mumbai, 31°C humid, ${new Date().toLocaleDateString('en-IN', { weekday: 'long' })}
Variety seed: ${Date.now()}

BUILD EXACTLY:
MORNING → relaxed, effortless, casual
DAYTIME → smart, put-together, practical
EVENING → elevated, intentional, polished

FOR EACH LOOK YOU MUST:
✓ Choose 1 TOP or 1 DRESS (not both)
✓ If TOP chosen: choose 1 BOTTOM
✓ Optionally add 1 FOOTWEAR (max one pair)
✓ Optionally add 1 BAG (max one bag)
✓ Total: 2-4 items maximum

YOU MUST NEVER:
✗ Include 2 pairs of shoes
✗ Include 2 bags
✗ Include DRESS + BOTTOM together
✗ Mix items more than 2 formality points apart
✗ Repeat exact combinations from recently worn list
✗ Include more than 4 items in one look

Return ONLY valid JSON:
{"looks":[
  {"lookType":"MORNING","outfitName":"2-4 word editorial name","mood":"one word","formality":"RELAXED|SMART|ELEVATED","items":[{"id":"exact-uuid","reason":"specific why in 8 words"}],"stylingNote":"2 sentences explaining color + silhouette logic","occasionTags":["tag1","tag2"],"tip":"one specific actionable tip"},
  {"lookType":"DAYTIME","outfitName":"...","mood":"...","formality":"...","items":[...],"stylingNote":"...","occasionTags":[...],"tip":"..."},
  {"lookType":"EVENING","outfitName":"...","mood":"...","formality":"...","items":[...],"stylingNote":"...","occasionTags":[...],"tip":"..."}
]}

CRITICAL: Copy UUIDs EXACTLY from the wardrobe list.
Each look must pass: has clothing + no duplicates + cohesive.`

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
