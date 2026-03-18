/**
 * Supabase Client Architecture
 *
 * THREE distinct clients for different contexts:
 *
 * 1. createClient() — Browser client
 *    - Uses anon key
 *    - Session from browser cookies
 *    - Respects RLS policies
 *    - Use in: React components, client-side
 *
 * 2. createServerSupabaseClient() — Server client
 *    - Uses anon key
 *    - Session from request cookies
 *    - Respects RLS policies
 *    - Use in: Server Components, API routes for authenticated operations
 *
 * 3. createAdminClient() — Admin client
 *    - Uses service_role key
 *    - BYPASSES RLS
 *    - Use ONLY for: privileged operations like file storage, bucket setup
 *    - NEVER import in client components
 */

import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { validateEnv } from '../env'

// ──────────────────────────────────────────────────────────────
// CLIENT 1: Browser Client
// ──────────────────────────────────────────────────────────────
export function createClient() {
  // Browser client only needs public keys (NEXT_PUBLIC_*)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    throw new Error(
      'Missing Supabase public keys:\n' +
      '  - NEXT_PUBLIC_SUPABASE_URL\n' +
      '  - NEXT_PUBLIC_SUPABASE_ANON_KEY\n\n' +
      'Add them to .env.local and restart the server.\n' +
      'Get them from: Supabase Dashboard → Settings → API'
    )
  }
  
  return createBrowserClient(url, key)
}

// ──────────────────────────────────────────────────────────────
// CLIENT 2: Server Client (for API routes and Server Components)
// ──────────────────────────────────────────────────────────────
export async function createServerSupabaseClient() {
  const env = validateEnv()
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => {
          try {
            c.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch (error) {
            console.warn('[Supabase] Failed to set cookie:', error)
          }
        },
      },
    }
  )
}

// ──────────────────────────────────────────────────────────────
// CLIENT 3: Admin Client (service role key, bypasses RLS)
// ──────────────────────────────────────────────────────────────
export function createAdminClient() {
  const env = validateEnv()
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
