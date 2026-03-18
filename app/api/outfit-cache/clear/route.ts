/**
 * DELETE /api/outfit-cache/clear
 *
 * Clears the outfit cache for the authenticated user for today.
 * Called before regenerating an outfit to force a fresh curation.
 * Clears both the Prisma dailyCuration cache and the Supabase outfit_cache table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/backend/database/auth-middleware'
import prisma from '@/backend/database/prisma'

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const { userId } = auth

    // IMPORTANT: Use same date format as curate-outfit/route.ts (sv-SE locale → YYYY-MM-DD)
    // Do NOT use userTimezone filter — server timezone ≠ user timezone (Asia/Kolkata)
    // The DELETE must match on userId + localDate only, regardless of stored timezone.
    const localDate = new Date().toLocaleDateString('sv-SE')

    const result = await prisma.dailyCuration.deleteMany({
      where: { userId: BigInt(userId), localDate },
    })

    console.log(`[Cache] ✅ Cleared ${result.count} DailyCuration entries for user ${userId} on ${localDate}`)
    return NextResponse.json({ success: true, cleared: result.count }, { status: 200 })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Cache] ❌ Clear failed:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
