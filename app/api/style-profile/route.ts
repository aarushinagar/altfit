import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { validateEnv } from '@/lib/env'
import { requireAuth } from '@/backend/database/auth-middleware'

/**
 * GET /api/style-profile
 * Returns the authenticated user's style profile, or null if not created yet.
 */
export async function GET(req: NextRequest) {
  validateEnv()
  const auth = requireAuth(req)
  // Return null for unauthenticated — never 401 for GET profile
  if (!auth.ok) {
    return NextResponse.json({ profile: null })
  }
  const { userId } = auth

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('user_style_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json({ profile: profile ?? null })
}

/**
 * POST /api/style-profile
 * Upserts the user's style profile with onboarding answers or updated preferences.
 *
 * Body (all optional — only provided fields are updated):
 * {
 *   preferredAesthetics?: string[]
 *   avoidCombinations?: string[]
 *   favoriteColors?: string[]
 *   occasions?: string[]
 *   fitPreference?: string
 * }
 */
export async function POST(req: NextRequest) {
  validateEnv()
  const auth = requireAuth(req)
  if (!auth.ok) return auth.response
  const { userId } = auth

  const supabase = createAdminClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('user_style_profile')
    .upsert({
      user_id: userId,
      ...body,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
