-- =============================================================
-- Supabase Storage Setup for AltFit
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================
--
-- THE REAL FIX (recommended):
--   Replace SUPABASE_SERVICE_KEY in your .env with the service_role
--   secret key from: Supabase Dashboard → Settings → API → service_role
--   The service_role key bypasses RLS entirely — no policies needed.
--
-- IF YOU MUST USE THE ANON KEY for uploads, run the policies below.
-- =============================================================

-- 1. Create the wardrobe-images bucket (public read, no size limit set here)
INSERT INTO storage.buckets (id, name, public)
VALUES ('wardrobe-images', 'wardrobe-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow server-side INSERT (anon key from Next.js API routes)
--    Remove this once you set the service_role key.
CREATE POLICY IF NOT EXISTS "server_upload_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'wardrobe-images');

-- 3. Allow server-side UPDATE (upsert / re-upload)
CREATE POLICY IF NOT EXISTS "server_upload_update"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'wardrobe-images')
  WITH CHECK (bucket_id = 'wardrobe-images');

-- 4. Allow public reads (CDN URLs work without auth)
CREATE POLICY IF NOT EXISTS "public_image_read"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'wardrobe-images');

-- 5. Allow server-side DELETE (when wardrobe item is removed)
CREATE POLICY IF NOT EXISTS "server_upload_delete"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'wardrobe-images');
