/**
 * Environment Variable Validator
 *
 * Call this at the top of every API route to catch missing keys immediately.
 * Throws with a clear, actionable error message if anything is misconfigured.
 *
 * Never silent failures. Never undefined keys in production.
 */

export interface RequiredEnv {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  ANTHROPIC_API_KEY: string
}

export function validateEnv(): RequiredEnv {
  const required: Record<keyof RequiredEnv, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  }

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    const missingList = missing.join('\n  - ')
    throw new Error(
      `Missing required environment variables:\n  - ${missingList}\n\n` +
      `Add them to .env.local and restart the server.\n` +
      `Service role key: Supabase Dashboard → Settings → API → service_role`
    )
  }

  // Validate format
  if (!required.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must start with https://')
  }

  if (!required.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith('eyJ')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY must be a valid JWT (starts with eyJ)')
  }

  if (!required.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be a valid JWT (starts with eyJ)')
  }

  if (!required.ANTHROPIC_API_KEY?.startsWith('sk-ant-')) {
    throw new Error('ANTHROPIC_API_KEY must start with sk-ant-')
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: required.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: required.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: required.ANTHROPIC_API_KEY,
  }
}
