/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * scripts/create-saved-outfits-table.ts
 *
 * Creates the saved_outfits table in Supabase.
 * Tries multiple methods: RPC exec_sql, Management API, or direct SQL creation.
 * Runs via: npx tsx scripts/create-saved-outfits-table.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing env vars:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const SQL = `
CREATE TABLE IF NOT EXISTS saved_outfits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  outfit_name TEXT NOT NULL,
  look_type TEXT,
  mood TEXT,
  formality TEXT,
  items JSONB DEFAULT '[]',
  styling_note TEXT,
  occasion_tags TEXT[] DEFAULT '{}',
  tip TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_outfits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saved_outfits'
    AND policyname = 'saved_outfits_rls'
  ) THEN
    CREATE POLICY saved_outfits_rls ON saved_outfits
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT ALL ON saved_outfits TO service_role;
GRANT ALL ON saved_outfits TO authenticated;
GRANT ALL ON saved_outfits TO anon;

CREATE INDEX IF NOT EXISTS idx_saved_outfits_user
  ON saved_outfits(user_id, saved_at DESC);
`.trim()

async function run() {
  console.log('[CreateTable] Starting table creation...\n')

  // Method 1: Try exec_sql RPC
  console.log('[CreateTable] Method 1: Trying exec_sql RPC...')
  try {
    const { error } = await (supabase as any).rpc('exec_sql', { sql: SQL })
    if (!error) {
      console.log('[CreateTable] ✅ exec_sql RPC succeeded\n')
      await verify()
      return
    }
    console.log('[CreateTable] exec_sql RPC failed:', error.message)
  } catch (err: any) {
    console.log('[CreateTable] exec_sql RPC error:', err.message)
  }

  // Method 2: Try direct HTTP call to RPC endpoint
  console.log('\n[CreateTable] Method 2: Trying direct HTTP to /rest/v1/rpc/exec_sql...')
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey!,
          'Authorization': `Bearer ${serviceKey!}`
        } as HeadersInit,
        body: JSON.stringify({ sql: SQL })
      }
    )

    if (res.ok) {
      console.log(`[CreateTable] ✅ Direct HTTP succeeded (${res.status})\n`)
      await verify()
      return
    }
    const text = await res.text()
    console.log(`[CreateTable] Direct HTTP failed (${res.status}):`, text)
  } catch (err: any) {
    console.log('[CreateTable] Direct HTTP error:', err.message)
  }

  // Method 3: Try Management API
  console.log('\n[CreateTable] Method 3: Trying Supabase Management API...')
  try {
    const projectRef = supabaseUrl!
      .replace('https://', '')
      .replace('.supabase.co', '')
    
    console.log(`[CreateTable] Project ref: ${projectRef}`)

    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey!}`
        } as HeadersInit,
        body: JSON.stringify({ query: SQL })
      }
    )

    const data = await res.text()

    if (res.ok) {
      console.log(`[CreateTable] ✅ Management API succeeded (${res.status})\n`)
      await verify()
      return
    }
    console.log(`[CreateTable] Management API failed (${res.status}):`, data)
  } catch (err: any) {
    console.log('[CreateTable] Management API error:', err.message)
  }

  console.log('\n[CreateTable] ⚠️  All RPC/API methods failed.')
  console.log('[CreateTable] This usually means:')
  console.log('  - exec_sql function hasn\'t been created in your Supabase project')
  console.log('  - Management API requires a personal access token (not service role key)')
  console.log('[CreateTable] Attempting verification anyway...\n')

  await verify()
}

async function verify() {
  console.log('[CreateTable] Verifying table exists...')
  
  // Try both table name formats - SavedOutfit (Prisma) and saved_outfits (manual)-
  const tableNames = ['SavedOutfit', 'saved_outfits']
  let verified = false
  let tableName = ''

  for (const name of tableNames) {
    try {
      console.log(`[CreateTable] Checking table '${name}'...`)
      const { data, error } = await supabase
        .from(name)
        .select('*')
        .limit(1)

      if (!error) {
        verified = true
        tableName = name
        console.log(`[CreateTable] ✅ Table '${name}' verified and is accessible`)
        console.log('[CreateTable] Test query returned:', data ? `${data.length} rows` : '0 rows')
        break
      }
      
      console.log(`[CreateTable] Table '${name}' not accessible: ${error.message}`)
    } catch (e: any) {
      console.log(`[CreateTable] Error checking '${name}':`, e.message)
    }
  }

  if (!verified) {
    console.error('[CreateTable] ❌ Neither table format was accessible')
    console.log('\n[CreateTable] To resolve, run this SQL in Supabase Dashboard:')
    console.log('  1. Go to SQL Editor → New Query')
    console.log('  2. Paste and execute:\n')
    console.log(SQL)
    process.exit(1)
  }

  console.log('\n[CreateTable] 🎉 SUCCESS: Saved outfits table is active!')
  console.log(`[CreateTable] Table: '${tableName}'`)
  console.log('[CreateTable] You can now use the save outfit feature.\n')
  process.exit(0)
}

run().catch((err) => {
  console.error('[CreateTable] ❌ Fatal error:', err.message)
  process.exit(1)
})
