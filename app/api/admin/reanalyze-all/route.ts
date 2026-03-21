import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/backend/database/prisma'
import { analyzeWardrobeItem } from '@/lib/analyzeItem'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stuck = await prisma.wardrobeItem.findMany({
    where: {
      OR: [
        { analysisStatus: 'pending' },
        { name: 'Analyzing\u2026' },
      ],
    },
    select: { id: true },
    take: 50,
  })

  console.log(`[REANALYZE] Found ${stuck.length} items to reanalyze`)

  let success = 0
  let failed = 0

  for (const item of stuck) {
    try {
      await analyzeWardrobeItem(item.id)
      success++
    } catch {
      failed++
    }
    // Small delay to avoid rate-limiting
    await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({ success, failed, total: stuck.length })
}
