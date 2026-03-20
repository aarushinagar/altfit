/**
 * POST /api/generate-outfit-batch
 * Cron endpoint — pre-generates DailyCuration for all active users.
 * Called by Render Cron (or any scheduler) once per day.
 * Authorization: Bearer ${CRON_SECRET}
 *
 * Logic per user:
 *   1. Check if DailyCuration already exists for today → skip if yes
 *   2. Fetch wardrobe (top 25 items with analysisStatus = "done")
 *   3. Call Claude claude-haiku-3-5 with same prompt as /api/curate-outfit
 *   4. Enrich looks with wardrobe data
 *   5. Save to DailyCuration.slot1
 *
 * Runs in batches of 5 with 2s delay to avoid rate limits.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/backend/database/prisma'
import { generateSnowflakeId } from '@/backend/database/snowflake'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function enrichLooks(looks: any[], wardrobe: any[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map(wardrobe.map((w: any) => [String(w.id), w]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return looks.map((look: any) => ({
    ...look,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (look.items ?? []).map((item: any) => {
      const real = map.get(String(item.id))
      if (!real) return null
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).filter((x: any) => x !== null),
  }))
}

async function generateOutfitForUser(userId: bigint): Promise<'generated' | 'skipped' | 'failed'> {
  const localDate = new Date().toLocaleDateString('sv-SE')

  // Skip if already generated today
  const existing = await prisma.dailyCuration.findFirst({
    where: { userId, localDate },
    select: { id: true, slot1: true },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (existing?.slot1 && Array.isArray((existing.slot1 as any)?.looks)) {
    return 'skipped'
  }

  // Fetch wardrobe — only analyzed items
  const wardrobe = await prisma.wardrobeItem.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { userId, isActive: true, analysisStatus: 'done' } as any,
    select: { id: true, name: true, category: true, colorNames: true, imageUrl: true, formality: true, fit: true },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })

  if (wardrobe.length === 0) return 'skipped'

  const wardrobeShuffled = shuffle(wardrobe).slice(0, 20)
  const wardrobeContext = wardrobeShuffled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((w: any) => `${w.id}|${w.name}|${w.category}|${w.colorNames?.[0] ?? 'unknown'}`)
    .join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are ALT FIT, an expert personal stylist. Build cohesive, wearable outfits from the wardrobe provided.

HARD RULES (never break):
- Max 4 items per look, min 2
- Exactly 1 TOP or 1 DRESS (never both, never DRESS + BOTTOM)
- Max 1 FOOTWEAR, 1 BAG, 1 OUTERWEAR per look
- Formality consistent across all items (±2 points)
- Colors must work together: tonal, neutral base + accent, or monochrome
- Return raw JSON only — no markdown, no prose`

  const userPrompt = `Build 3 outfit suggestions from this wardrobe.

WARDROBE (copy IDs exactly):
${wardrobeContext}

Context: ${new Date().toLocaleDateString('en-IN', { weekday: 'long' })}, seed:${Date.now()}

Build: MORNING (casual/relaxed) · DAYTIME (smart/practical) · EVENING (elevated/polished)

Return ONLY this JSON:
{"looks":[{"lookType":"MORNING","outfitName":"2-4 words","mood":"1 word","formality":"RELAXED","items":[{"id":"exact-id","reason":"8 words"}],"stylingNote":"2 sentences","occasionTags":["tag"],"tip":"1 sentence"},{"lookType":"DAYTIME",...},{"lookType":"EVENING",...}]}`

  let outfitRaw: string
  try {
    const response = await Promise.race([
      anthropic.messages.create({
        model: 'claude-haiku-3-5',
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 10000),
      ),
    ])
    outfitRaw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  } catch {
    return 'failed'
  }

  let outfit: { looks: unknown[] }
  try {
    outfit = JSON.parse(outfitRaw.replace(/```json|```/g, '').trim())
    if (!Array.isArray(outfit?.looks) || outfit.looks.length === 0) return 'failed'
  } catch {
    return 'failed'
  }

  outfit.looks = enrichLooks(outfit.looks, wardrobe)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outfitJson = outfit as any

  // Save or update DailyCuration
  if (!existing) {
    await prisma.dailyCuration.create({
      data: {
        id:               generateSnowflakeId(),
        userId,
        localDate,
        userTimezone:     'UTC',
        weatherTempC:     25,
        weatherCondition: 'clear',
        weatherLocation:  'home',
        slot1:            outfitJson,
      },
    })
  } else {
    await prisma.dailyCuration.update({
      where: { id: existing.id },
      data: { slot1: outfitJson },
    })
  }

  return 'generated'
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? ''
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  // Find users active in the last 7 days (had a DailyCuration)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentLocalDate = sevenDaysAgo.toLocaleDateString('sv-SE')

  const activeUserIds = await prisma.dailyCuration.findMany({
    where: { localDate: { gte: recentLocalDate } },
    select: { userId: true },
    distinct: ['userId'],
    take: 200,
  })

  const userIds = activeUserIds.map(r => r.userId)
  console.log(`[BatchGen] Processing ${userIds.length} active users`)

  const results = { generated: 0, skipped: 0, failed: 0 }
  const BATCH_SIZE = 5
  const DELAY_MS = 2000

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.allSettled(
      batch.map(uid => generateOutfitForUser(uid))
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results[result.value]++
      } else {
        results.failed++
        console.error('[BatchGen] User failed:', result.reason)
      }
    }

    if (i + BATCH_SIZE < userIds.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  console.log(`[BatchGen] Done in ${Date.now() - startTime}ms:`, results)

  return NextResponse.json({
    success: true,
    duration: Date.now() - startTime,
    ...results,
  })
}
