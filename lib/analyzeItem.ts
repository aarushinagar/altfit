/**
 * Background wardrobe item analyzer.
 * analyzeWardrobeItem — fetches a single item, calls Claude, updates DB.
 * processAnalysisQueue — picks up pending jobs and processes them.
 *
 * Called fire-and-forget from the POST /api/wardrobe upload handler.
 * The user gets their item card back instantly; analysis happens here silently.
 */

import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import prisma from '@/backend/database/prisma'

// ── Types ─────────────────────────────────────────────────────
interface ClaudeAnalysis {
  name?: string
  category?: string
  colors?: string[]
  fit?: string
  season?: string[]
  formality?: number
  pattern?: string
}

// ── Single-item analyser ────────────────────────────────────────
async function analyzeWardrobeItem(wardrobeItemId: bigint): Promise<void> {
  const item = await prisma.wardrobeItem.findUnique({
    where: { id: wardrobeItemId },
  })

  if (!item) {
    console.warn(`[analyzeItem] Item ${wardrobeItemId} not found — skipping`)
    return
  }

  if (!item.imageUrl) {
    console.warn(`[analyzeItem] Item ${wardrobeItemId} has no image — marking done`)
    await prisma.wardrobeItem.update({
      where: { id: wardrobeItemId },
      data: { analysisStatus: 'done' },
    })
    return
  }

  // Fetch the image
  const imageRes = await fetch(item.imageUrl)
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image: ${imageRes.status}`)
  }
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

  // Downscale to max 1000px for efficient analysis
  const meta = await sharp(imageBuffer).metadata()
  const needsScale = (meta.width ?? 0) > 1000 || (meta.height ?? 0) > 1000
  const analysisBuffer = needsScale
    ? await sharp(imageBuffer)
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
    : imageBuffer

  const base64 = analysisBuffer.toString('base64')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-3-5',
    max_tokens: 600,
    system: 'Fashion item analyzer. Return raw JSON only — no markdown.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          },
          {
            type: 'text',
            text: `Analyze this clothing item precisely.

Return ONLY this JSON object:
{
  "name": "concise item name (e.g. 'White linen shirt')",
  "category": "TOP|BOTTOM|DRESS|OUTERWEAR|FOOTWEAR|BAG|FULL_OUTFIT",
  "colors": ["primary color", "secondary color if present"],
  "fit": "relaxed|regular|fitted|oversized",
  "season": ["springsummer"|"fallwinter"|"allseason"],
  "formality": 1-10,
  "pattern": "solid|stripes|plaid|floral|graphic|abstract|animal_print|none"
}

Current item data for context: category=${item.category}, name=${item.name}
Raw JSON only. No markdown.`,
          },
        ],
      },
    ],
  })

  const rawText =
    response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  const cleaned = rawText.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim()
  const analysis: ClaudeAnalysis = JSON.parse(cleaned)

  // Update the wardrobe item with enriched data
  await prisma.wardrobeItem.update({
    where: { id: wardrobeItemId },
    data: {
      ...(analysis.name ? { name: analysis.name } : {}),
      ...(analysis.category ? { category: analysis.category } : {}),
      ...(analysis.colors?.length ? { colors: { set: analysis.colors } } : {}),
      ...(analysis.fit ? { fit: analysis.fit } : {}),
      ...(analysis.season?.length ? { season: { set: analysis.season } } : {}),
      ...(analysis.formality ? { formality: analysis.formality } : {}),
      ...(analysis.pattern ? { pattern: analysis.pattern } : {}),
      analysisStatus: 'done',
    },
  })

  // Invalidate today's DailyCuration cache so tonight's cron regenerates with accurate data
  const todayStr = new Date().toISOString().split('T')[0] // "YYYY-MM-DD"
  await prisma.dailyCuration.deleteMany({
    where: {
      userId: item.userId,
      localDate: todayStr,
    },
  })

  console.log(`[analyzeItem] ✅ Item ${wardrobeItemId} analyzed: ${analysis.name ?? item.name}`)
}

// ── Queue processor ────────────────────────────────────────────
export async function processAnalysisQueue(): Promise<void> {
  // Claim up to 3 pending jobs atomically (mark as processing first)
  const jobs = await prisma.analysisQueue.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 3,
  })

  if (jobs.length === 0) return

  // Mark all as processing
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[analyzeItem] ❌ Job ${job.id} failed: ${msg}`)

      await prisma.analysisQueue.update({
        where: { id: job.id },
        data: {
          status: job.attempts + 1 >= 3 ? 'failed' : 'pending',
          attempts: { increment: 1 },
        },
      })

      // Mark item as done (with original data) so it doesn't stay in "Analyzing..." forever
      if (job.attempts + 1 >= 3) {
        await prisma.wardrobeItem.update({
          where: { id: job.wardrobeItemId },
          data: { analysisStatus: 'done' },
        })
      }
    }
  }
}
