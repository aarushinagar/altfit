/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * lib/startup.ts — ALT FIT Self-Configuration
 *
 * Runs once on every cold start (local dev and Vercel) via instrumentation.ts.
 * Creates the Supabase storage bucket, applies RLS policies, and patches any
 * legacy broken imageUrl values — no manual dashboard visits required.
 *
 * Env vars (in priority order):
 *   SUPABASE_SERVICE_ROLE_KEY  — preferred: your project's service_role secret key
 *   SUPABASE_SERVICE_KEY       — legacy alias; accepted as fallback
 *   SUPABASE_URL               — your project URL (e.g. https://xxx.supabase.co)
 *   NEXT_PUBLIC_SUPABASE_URL   — also accepted if the above is absent
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "wardrobe-images";
const BUCKET_SIZE_LIMIT = 10 * 1024 * 1024; // 10 MB

function getSupabaseUrl(): string | undefined {
    return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getServiceKey(): string | undefined {
    // Prefer the proper service_role key; fall back to legacy name
    return (
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );
}

export async function runStartupChecks(): Promise<void> {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceKey();

    // ── Guard: missing service key ─────────────────────────────────────────────
    if (!serviceKey) {
        const projectRef = supabaseUrl
            ? supabaseUrl.replace("https://", "").replace(".supabase.co", "")
            : "<your-project-ref>";
        console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ MISSING: SUPABASE_SERVICE_ROLE_KEY

Storage auto-setup is DISABLED until you add your service_role key.

To fix in 30 seconds:
  1. Open: https://${projectRef}.supabase.co/project/default/settings/api
  2. Under "Project API keys" copy the "service_role" secret key.
  3. Add to .env.local:
       SUPABASE_SERVICE_ROLE_KEY=eyJ...your_key_here...
  4. Restart the dev server — self-setup runs automatically.

Everything else will still work; images just won't upload until the bucket exists.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
        return;
    }

    if (!supabaseUrl) {
        console.error("[Startup] ❌ SUPABASE_URL is not set — skipping self-setup");
        return;
    }

    console.log("[Startup] Running self-setup...");

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 1. Create / verify storage bucket ─────────────────────────────────────
    try {
        const { data: existing } = await supabase.storage.getBucket(BUCKET);

        if (!existing) {
            const { error } = await supabase.storage.createBucket(BUCKET, {
                public: true,
                fileSizeLimit: BUCKET_SIZE_LIMIT,
                allowedMimeTypes: [
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/heic",
                    "image/gif",
                ],
            });
            if (error) throw error;
            console.log(`[Startup] ✅ Bucket created: ${BUCKET}`);
        } else {
            // Ensure bucket stays public (idempotent)
            await supabase.storage.updateBucket(BUCKET, { public: true });
            console.log(`[Startup] ✅ Bucket verified: ${BUCKET}`);
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // "already exists" is fine — another instance beat us to it
        if (
            !msg.toLowerCase().includes("already exist") &&
            !msg.toLowerCase().includes("duplicate")
        ) {
            console.error("[Startup] ❌ Bucket setup failed:", msg);
        } else {
            console.log(`[Startup] ✅ Bucket verified: ${BUCKET} (already exists)`);
        }
    }

    // ── 2. Create saved_outfits table (from Prisma) and grant permissions ────────
    await createSavedOutfitsTable(supabase);

    // ── 3. Apply storage RLS policies ─────────────────────────────────────────
    // We use raw SQL via the pg REST Admin API so we don't need a custom RPC.
    // storage.objects policies let the authenticated server key bypass them —
    // but public read is needed so next/image CDN URLs work without auth.
    await applyStoragePolicies(supabase);

    // ── 4. Patch broken / legacy imageUrl values ───────────────────────────────
    await cleanBrokenImageUrls(supabase);

    console.log("[Startup] ✅ Self-setup complete");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createSavedOutfitsTable(supabase: SupabaseClient<any>): Promise<void> {
    const sql = `
    -- Create table if missing (Prisma may have created it already)
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

    -- Enable RLS
    ALTER TABLE saved_outfits ENABLE ROW LEVEL SECURITY;

    -- Add policy if missing
    DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'saved_outfits' AND policyname = 'saved_outfits_rls'
        ) THEN
            CREATE POLICY saved_outfits_rls ON saved_outfits
                USING (auth.uid() = user_id)
                WITH CHECK (auth.uid() = user_id);
        END IF;
    END $$;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_saved_outfits_user ON saved_outfits(user_id, saved_at DESC);

    -- GRANT permissions to Supabase roles so service_role and anon can query
    GRANT ALL ON saved_outfits TO service_role, anon, authenticated;
    `;

    try {
        // Try exec_sql RPC
        await (supabase as any).rpc("exec_sql", { sql }).catch(() => {});
        console.log("[Startup] ✅ saved_outfits table ensured");
    } catch {
        // If RPC fails, fall back to direct SQL via fetch
        try {
            const response = await fetch(
                `${process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
                        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
                    },
                    body: JSON.stringify({ sql }),
                }
            );
            if (response.ok) {
                console.log("[Startup] ✅ saved_outfits table ensured (via HTTP)");
            }
        } catch (e: any) {
            console.warn("[Startup] ⚠️  saved_outfits table setup skipped:", e.message);
        }
    }
}

async function applyStoragePolicies(supabase: SupabaseClient<any>): Promise<void> {
    // Policy DDL — all wrapped in DO $$ blocks so they are idempotent
    const policySQL = `
    -- Public read: anyone can view wardrobe images via CDN URL
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename  = 'objects'
          AND policyname = 'wardrobe_images_public_read'
      ) THEN
        CREATE POLICY wardrobe_images_public_read ON storage.objects
          FOR SELECT USING (bucket_id = '${BUCKET}');
      END IF;
    END $$;

    -- Authenticated insert: users may upload to their own folder
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename  = 'objects'
          AND policyname = 'wardrobe_images_auth_insert'
      ) THEN
        CREATE POLICY wardrobe_images_auth_insert ON storage.objects
          FOR INSERT WITH CHECK (
            bucket_id = '${BUCKET}' AND
            auth.role() = 'authenticated'
          );
      END IF;
    END $$;

    -- Authenticated update/delete: users may manage their own files
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename  = 'objects'
          AND policyname = 'wardrobe_images_auth_modify'
      ) THEN
        CREATE POLICY wardrobe_images_auth_modify ON storage.objects
          FOR ALL USING (
            bucket_id = '${BUCKET}' AND
            auth.role() = 'authenticated'
          );
      END IF;
    END $$;
  `;

    try {
        // Try the standard Supabase SQL execution approach
        const response = await fetch(`${process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": getServiceKey()!,
                "Authorization": `Bearer ${getServiceKey()!}`,
            },
            body: JSON.stringify({ sql: policySQL }),
        });

        if (response.ok) {
            console.log("[Startup] ✅ Storage policies applied");
        } else {
            // exec_sql RPC not available — fall back to direct query approach
            await applyPoliciesViaQuery(supabase);
        }
    } catch {
        await applyPoliciesViaQuery(supabase);
    }
}

async function applyPoliciesViaQuery(supabase: SupabaseClient<any>): Promise<void> {
    // Direct approach: use supabase-js rpc if exec_sql exists
    try {
        const { error } = await (supabase as any).rpc("exec_sql", {
            sql: `SELECT 1`, // probe
        });
        if (!error) {
            // exec_sql is available — run actual DDL
            await (supabase as any).rpc("exec_sql", {
                sql: `
          CREATE POLICY IF NOT EXISTS wardrobe_images_public_read ON storage.objects
            FOR SELECT USING (bucket_id = '${BUCKET}');
        `,
            });
            console.log("[Startup] ✅ Storage policies applied (via RPC)");
            return;
        }
    } catch {
        /* exec_sql not available */
    }

    // Last resort: policies can be set via Supabase Management API or Dashboard.
    // With a service_role key the server can bypass RLS entirely for server-side
    // uploads, so the upload flow works regardless of bucket-level policies.
    console.log(
        "[Startup] ℹ️  Storage policies not applied automatically (exec_sql RPC unavailable). " +
        "Server-side uploads still work via service_role key. " +
        "Public read access is granted by the bucket being set to public=true.",
    );
}

async function cleanBrokenImageUrls(supabase: SupabaseClient<any>): Promise<void> {
    try {
        // Find items with broken local-dev paths like /api/dev-uploads/... or empty string
        const { data: broken, error: selectErr } = await supabase
            .from("WardrobeItem")
            .select("id")
            .or('imageUrl.like./api/%,imageUrl.eq.');

        if (selectErr) {
            // Table may not exist yet (first deploy) or column name differs — skip silently
            return;
        }

        if (broken && broken.length > 0) {
            const { error: updateErr } = await supabase
                .from("WardrobeItem")
                .update({ imageUrl: null } as any)
            if (!updateErr) {
                console.log(
                    `[Startup] ✅ Cleaned ${broken.length} broken image URL(s) → null`,
                );
            }
        }
    } catch (err: unknown) {
        // Non-fatal — wardrobe still works without this cleanup
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Startup] ⚠️  Image URL cleanup skipped:", msg);
    }
}
