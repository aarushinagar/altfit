/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/curate-outfit/single
 * Regenerates ONE look (MORNING | DAYTIME | EVENING) without touching the other two.
 *
 * Body: { lookType: string, existingItemIds: string[] }
 * - existingItemIds: IDs already used in the OTHER two looks (avoid duplicates)
 *
 * Uses Prisma (not Supabase REST — PostgREST can't resolve WardrobeItem).
 * CRITICAL: String(w.id) as map key — Prisma returns BigInt, Claude returns string.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/backend/database/prisma'
import { requireAuth } from '@/backend/database/auth-middleware'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.response
  const { userId } = auth
  const userIdBigInt = BigInt(userId)

  let lookType: string
  let existingItemIds: string[]
  try {
    const body = await req.json()
    lookType = body.lookType ?? 'MORNING'
    existingItemIds = body.existingItemIds ?? []
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  console.log(`[Single] ── Regenerating ${lookType} for user ${userId}`)

  // ── 1. Fetch wardrobe via Prisma ───────────────────────────────────────────
  const wardrobe = await prisma.wardrobeItem.findMany({
    where: { userId: userIdBigInt, isActive: true },
    select: {
      id: true, name: true, category: true,
      colorNames: true, imageUrl: true, formality: true, fit: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  if (wardrobe.length === 0) {
    return NextResponse.json({ error: 'No wardrobe items found.' }, { status: 400 })
  }

  const shuffled = shuffle(wardrobe).slice(0, 15)
  const wardrobeContext = shuffled
    .map((w: any) => `${w.id}|${w.name}|${w.category}|${w.colorNames?.[0] ?? 'unknown'}`)
    .join('\n')

  // Names already used in the other two looks — ask Claude to avoid them
  const avoidedNames = wardrobe
    .filter((w: any) => existingItemIds.includes(String(w.id)))
    .map((w: any) => w.name)
    .join(', ')

  // ── 2. Call Claude ─────────────────────────────────────────────────────────
  console.log(`[Single] ── Calling Claude for ${lookType}...`)
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const claudePromise = anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: `You are ALT FIT, a personal stylist.
Build ONE complete outfit suggestion from the user's wardrobe.
Be specific. Be cohesive. Be fast.`,
    messages: [{
      role: 'user',
      content: `Wardrobe (use exact IDs):
${wardrobeContext}

Build a ${lookType} look.
${avoidedNames ? `Avoid these (used in other looks today): ${avoidedNames}` : ''}
Seed: ${Date.now()}
City: Mumbai, 31°C humid.

JSON only, no markdown:
{"lookType":"${lookType}","outfitName":"2-3 words","mood":"word","formality":"RELAXED|SMART|ELEVATED","items":[{"id":"exact-id","reason":"10 words max"}],"stylingNote":"2 sentences","occasionTags":["tag1","tag2"],"tip":"1 sentence"}`,
    }],
  })

  let claudeRes: any
  try {
    claudeRes = await Promise.race([
      claudePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 20000),
      ),
    ])
  } catch (err: any) {
    if ((err as Error).message === 'TIMEOUT') {
      console.error('[Single] ❌ Claude timed out')
      return NextResponse.json({ error: 'Taking too long. Try again.' }, { status: 504 })
    }
    throw err
  }

  console.log(`[Single] ── Claude responded ✅`)

  // ── 3. Parse ───────────────────────────────────────────────────────────────
  const raw = claudeRes.content[0].type === 'text'
    ? claudeRes.content[0].text.trim()
    : '{}'

  let look: any
  try {
    look = JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return NextResponse.json({ error: 'Could not generate look.' }, { status: 500 })
  }

  // ── 4. Enrich with real wardrobe data ──────────────────────────────────────
  // String(w.id) is CRITICAL — Prisma BigInt vs Claude's string JSON output
  const map = new Map(wardrobe.map((w: any) => [String(w.id), w]))
  look.items = (look.items ?? [])
    .map((item: any) => {
      const real = map.get(String(item.id))
      if (!real) {
        console.log(`[Single] ❌ No match for id: ${item.id}`)
        return null
      }
      console.log(`[Single] ✅ ${real.name} | photo: ${!!real.imageUrl}`)
      return {
        id:       String(real.id),
        name:     real.name,
        category: real.category,
        color:    real.colorNames?.[0] ?? 'unknown',
        imageUrl: real.imageUrl ?? null,
        formality: real.formality,
        fit:      real.fit,
        reason:   item.reason,
      }
    })
    .filter(Boolean)

  // ── 5. Update cache: replace only this look in DailyCuration.slot1 ─────────
  const localDate = new Date().toLocaleDateString('sv-SE')
  prisma.dailyCuration.findFirst({
    where: { userId: userIdBigInt, localDate },
  }).then(async (dailyCuration) => {
    if (!dailyCuration?.slot1) return
    const existing = dailyCuration.slot1 as any
    if (!Array.isArray(existing?.looks)) return
    const updatedLooks = existing.looks.map((l: any) =>
      l.lookType === lookType ? look : l,
    )
    await prisma.dailyCuration.update({
      where: { id: dailyCuration.id },
      data: { slot1: { ...existing, looks: updatedLooks } },
    })
    console.log(`[Single] ✅ Cache updated: slot1.${lookType} replaced`)
  }).catch((e: Error) => console.error('[Single] Cache update error:', e.message))

  return NextResponse.json(
    { look },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
