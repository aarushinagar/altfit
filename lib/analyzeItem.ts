/**
 * Background wardrobe item analyzer.
 * analyzeWardrobeItem — calls Claude Vision on a single item, updates DB.
 * processAnalysisQueue — drains pending AnalysisQueue jobs.
 *
 * CRITICAL GUARANTEE: every code path eventually calls
 *   prisma.wardrobeItem.update({ data: { analysisStatus: 'done' } })
 * so items NEVER stay stuck in 'pending'.
 */

import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/backend/database/prisma'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Helpers ────────────────────────────────────────────────────
function log(itemId: bigint, msg: string, extra?: unknown) {
  console.log(`[ANALYZE item:${itemId}] ${msg}`, extra ?? '')
}

async function markDone(itemId: bigint, updates: Record<string, unknown> = {}) {
  try {
    await prisma.wardrobeItem.update({
      where: { id: itemId },
      data: { analysisStatus: 'done', ...updates },
    })
  } catch (err) {
    console.error(`[ANALYZE item:${itemId}] markDone failed:`, err)
  }
}

// ── Single-item analyser ────────────────────────────────────────
export async function analyzeWardrobeItem(wardrobeItemId: bigint): Promise<void> {
  log(wardrobeItemId, 'Starting')

  const item = await prisma.wardrobeItem.findUnique({
    where: { id: wardrobeItemId },
    select: { id: true, imageUrl: true, userId: true, name: true, category: true },
  })

  if (!item) {
    log(wardrobeItemId, 'SKIP: item not found')
    return
  }

  if (!item.imageUrl) {
    log(wardrobeItemId, 'SKIP: no imageUrl — marking done')
    await markDone(wardrobeItemId)
    return
  }

  // Validate URL before sending to Claude
  try {
    new URL(item.imageUrl)
  } catch {
    log(wardrobeItemId, 'SKIP: invalid imageUrl — marking done', item.imageUrl)
    await markDone(wardrobeItemId)
    return
  }

  log(wardrobeItemId, 'Calling Claude Vision', item.imageUrl)

  let rawText = ''
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: `Fashion item analyzer. Return raw JSON only — no markdown, no preamble.

Format:
{
  "name": "concise item name e.g. 'White Linen Shirt'",
  "category": "TOP|BOTTOM|DRESS|OUTERWEAR|FOOTWEAR|BAG|ACCESSORY|FULL_OUTFIT",
  "colors": ["primary color", "secondary color if present"],
  "colorNames": ["primary color name", "secondary if present"],
  "fit": "relaxed|regular|fitted|oversized",
  "season": ["springsummer"|"fallwinter"|"allseason"],
  "formality": 1-10,
  "pattern": "solid|stripes|plaid|floral|graphic|abstract|animal_print|none",
  "tags": ["tag1", "tag2", "tag3"],
  "occasion": ["casual", "work", "evening"]
}`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: item.imageUrl },
          },
          {
            type: 'text',
            text: `Analyze this clothing item. Current data: category=${item.category}, name=${item.name}. Return JSON only.`,
          },
        ],
      }],
    })

    rawText = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
    log(wardrobeItemId, 'Claude response received', rawText.slice(0, 120))
  } catch (claudeErr) {
    log(wardrobeItemId, 'FAIL: Claude error — marking done to unblock UI', claudeErr instanceof Error ? claudeErr.message : claudeErr)
    await markDone(wardrobeItemId)
    return
  }

  let analysis: Record<string, unknown> = {}
  try {
    const cleaned = rawText.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim()
    analysis = JSON.parse(cleaned)
  } catch {
    log(wardrobeItemId, 'FAIL: JSON parse failed — marking done', rawText.slice(0, 200))
    await markDone(wardrobeItemId)
    return
  }

  try {
    await prisma.wardrobeItem.update({
      where: { id: wardrobeItemId },
      data: {
        ...(analysis.name      ? { name: analysis.name as string }           : {}),
        ...(analysis.category  ? { category: analysis.category as string }   : {}),
        ...((analysis.colors as string[] | undefined)?.length ? { colors: { set: analysis.colors as string[] } }   : {}),
        ...((analysis.colorNames as string[] | undefined)?.length ? { colorNames: { set: analysis.colorNames as string[] } } : {}),
        ...(analysis.fit       ? { fit: analysis.fit as string }             : {}),
        ...((analysis.season as string[] | undefined)?.length   ? { season: { set: analysis.season as string[] } }     : {}),
        ...(analysis.formality ? { formality: analysis.formality as number } : {}),
        ...(analysis.pattern   ? { pattern: analysis.pattern as string }     : {}),
        ...((analysis.tags as string[] | undefined)?.length     ? { tags: { set: analysis.tags as string[] } }         : {}),
        ...((analysis.occasion as string[] | undefined)?.length ? { occasion: { set: analysis.occasion as string[] } } : {}),
        analysisStatus: 'done',
      },
    })
    log(wardrobeItemId, '✅ Done', { name: analysis.name, category: analysis.category })
  } catch (dbErr) {
    log(wardrobeItemId, 'FAIL: DB update failed — marking done minimally', dbErr instanceof Error ? dbErr.message : dbErr)
    await markDone(wardrobeItemId)
  }

  // Invalidate today's DailyCuration so cron regenerates with updated item data
  const todayStr = new Date().toISOString().split('T')[0]
  await prisma.dailyCuration.deleteMany({
    where: { userId: item.userId, localDate: todayStr },
  }).catch(() => {})
}

// ── Queue processor ────────────────────────────────────────────
export async function processAnalysisQueue(): Promise<void> {
  const jobs = await prisma.analysisQueue.findMany({
    where: { status: 'pending', attempts: { lt: 3 } },
    orderBy: { createdAt: 'asc' },
    take: 10,
  })

  if (jobs.length === 0) return
  console.log(`[QUEUE] Processing ${jobs.length} pending jobs`)

  const jobIds = jobs.map(j => j.id)
  await prisma.analysisQueue.updateMany({
    where: { id: { in: jobIds } },
    data: { status: 'processing' },
  })

  for (const job of jobs) {
    try {
      await analyzeWardrobeItem(job.wardrobeItemId)
      await prisma.analysisQueue.update({
        where: { id: job.id },
        data: { status: 'done', processedAt: new Date() },
      })
      console.log(`[QUEUE] Job ${job.id} ✅ done`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[QUEUE] Job ${job.id} ❌ failed:`, msg)

      const newAttempts = job.attempts + 1
      await prisma.analysisQueue.update({
        where: { id: job.id },
        data: { status: newAttempts >= 3 ? 'failed' : 'pending', attempts: { increment: 1 } },
      }).catch(() => {})

      // Always unblock the wardrobe item
      await markDone(job.wardrobeItemId)
    }
  }
}
