import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/backend/database/auth-middleware'
import prisma from '@/backend/database/prisma'
import { generateSnowflakeId } from '@/backend/database/snowflake'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const { userId } = auth

    console.log('[SaveOutfit] Auth userId:', userId)

    // Parse body
    const look = await req.json()
    if (!look?.outfitName) {
      return NextResponse.json({ error: 'Missing outfit name' }, { status: 400 })
    }

    const userIdBig = BigInt(userId)

    console.log('[SaveOutfit] Saving:', look.outfitName, 'user:', userId)

    // Check duplicate
    const existing = await prisma.savedOutfit.findFirst({
      where: { userId: userIdBig, outfitName: look.outfitName },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ success: true, alreadySaved: true })
    }

    // Save
    await prisma.savedOutfit.create({
      data: {
        id:           generateSnowflakeId(),
        userId:       userIdBig,
        outfitName:   look.outfitName,
        lookType:     look.lookType ?? null,
        mood:         look.mood ?? null,
        formality:    look.formality ?? null,
        items:        look.items ?? [],
        stylingNote:  look.stylingNote ?? null,
        occasionTags: look.occasionTags ?? [],
        tip:          look.tip ?? null,
      },
    })

    console.log('[SaveOutfit] ✅ Saved:', look.outfitName)
    return NextResponse.json({ success: true, saved: true })

  } catch (err: any) {
    console.error('[SaveOutfit] Fatal:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const { userId } = auth

    const outfits = await prisma.savedOutfit.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { savedAt: 'desc' },
    })

    // Serialize BigInt fields for JSON
    const serialized = outfits.map(o => ({
      ...o,
      id: String(o.id),
      userId: String(o.userId),
    }))

    return NextResponse.json({ outfits: serialized })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    if (!auth.ok) return auth.response
    const { userId } = auth

    const { id } = await req.json()

    // Ensure the record belongs to the authenticated user before deleting
    await prisma.savedOutfit.deleteMany({
      where: { id: BigInt(id), userId: BigInt(userId) },
    })

    return NextResponse.json({ success: true })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

