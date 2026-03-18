/**
 * POST /api/wardrobe/[id]/photo
 * Re-attach or update a photo for an existing wardrobe item
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { uploadItemImage } from '@/lib/storageEngine'
import { validateEnv } from '@/lib/env'
import { requireAuth } from '@/backend/database/auth-middleware'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  validateEnv()

  const auth = requireAuth(req)
  if (!auth.ok) return auth.response
  const userId = auth.userId

  const supabase = createAdminClient()

  const { id } = await params

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No image' }, { status: 400 })
  }

  // Verify item belongs to this user
  const { data: item } = await supabase
    .from('wardrobe_items')
    .select('id, category')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const adminClient = createAdminClient()

  const publicUrl = await uploadItemImage(adminClient, userId, item.id, buffer)

  await supabase.from('wardrobe_items').update({ image_url: publicUrl }).eq('id', item.id)

  return NextResponse.json({ success: true, imageUrl: publicUrl })
}
