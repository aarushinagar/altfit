# Supabase Setup Guide for ALTFIT

## Overview
This guide walks you through setting up Supabase for ALTFIT, including database configuration, storage buckets, and row-level security (RLS) policies.

## Part 1: Create Supabase Project

### Step 1: Create Project
1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Project Name**: `altfit` (or any name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for project creation (5-10 minutes)

### Step 2: Get Connection Strings
1. Click on your project → Settings → Database
2. Under "Connection strings":
   - Copy the **Pooling connection** string → `DATABASE_URL` in `.env.local`
   - Copy the **Direct connection** string → `DIRECT_URL` in `.env.local`

Format should be:
```
DATABASE_URL="postgresql://postgres.xxxxx:xxxxx@aws-1-region.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxxx:xxxxx@aws-1-region.supabase.co:5432/postgres"
```

### Step 3: Get Service Role Key
1. Click on your project → Settings → API
2. Look for "Service Role" (NOT "anon" key)
3. Copy the Service Role key → `SUPABASE_SERVICE_KEY` in `.env.local`

The key should look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## Part 2: Initialize Database with Prisma

### Step 1: Run Prisma Migration
```bash
# From the project root
npx prisma migrate deploy
# Or if no migration exists yet:
npx prisma db push
```

This creates all database tables defined in `prisma/schema.prisma`:
- `User` - User accounts
- `Session` - Refresh tokens
- `WardrobeItem` - Clothing items
- `Outfit` - Generated outfits
- `OutfitItem` - Items in an outfit
- `Subscription` - Payment subscriptions

### Step 2: Verify Tables Created
1. In Supabase dashboard → SQL Editor
2. Run:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public';
```
You should see: user, session, wardrobe_item, outfit, outfit_item, subscription

---

## Part 3: Create Storage Buckets

### Step 1: Create Wardrobe Images Bucket
1. Go to your Supabase project → Storage
2. Click "New bucket"
3. Fill in:
   - **Name**: `wardrobe-images`
   - **Public bucket**: Toggle ON (images should be publicly accessible)
4. Click "Create bucket"

### Step 2: Create Profile Avatars Bucket
1. Click "New bucket" again
2. Fill in:
   - **Name**: `profile-avatars`
   - **Public bucket**: Toggle ON
3. Click "Create bucket"

### Step 3: Verify Buckets Exist
In the Storage section, you should see:
- `wardrobe-images`
- `profile-avatars`

---

## Part 4: Configure Row-Level Security (RLS) Policies

RLS ensures users can only access their own data. Run these SQL commands in Supabase → SQL Editor:

### Policy 1: Wardrobe Items - Users can only access their own items
```sql
CREATE POLICY "Users can view their own wardrobe items"
ON wardrobe_item FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create wardrobe items"
ON wardrobe_item FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own wardrobe items"
ON wardrobe_item FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own wardrobe items"
ON wardrobe_item FOR DELETE
TO authenticated
USING (user_id = auth.uid());
```

### Policy 2: Outfits - Users can only access their own outfits
```sql
CREATE POLICY "Users can view their own outfits"
ON outfit FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create outfits"
ON outfit FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own outfits"
ON outfit FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own outfits"
ON outfit FOR DELETE
TO authenticated
USING (user_id = auth.uid());
```

### Policy 3: Sessions - Users can only access their own sessions
```sql
CREATE POLICY "Users can view their own sessions"
ON session FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create sessions"
ON session FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
ON session FOR DELETE
TO authenticated
USING (user_id = auth.uid());
```

### Policy 4: Subscriptions - Users can only access their own subscriptions
```sql
CREATE POLICY "Users can view their own subscriptions"
ON subscription FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create subscriptions"
ON subscription FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own subscriptions"
ON subscription FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

### Policy 5: Wardrobe Images - Public read, authenticated write/delete
```sql
CREATE POLICY "Public read access to wardrobe images"
ON storage.objects FOR SELECT
USING (bucket_id = 'wardrobe-images');

CREATE POLICY "Users can upload wardrobe images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'wardrobe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their wardrobe images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'wardrobe-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 6: Profile Avatars - Public read, authenticated write/delete
```sql
CREATE POLICY "Public read access to avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-avatars');

CREATE POLICY "Users can upload profile avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their profile avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Part 5: Enable Necessary Extensions

Run these in Supabase → SQL Editor:

```sql
-- Enable UUID extension (might already be enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search (useful for future features)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

---

## Part 6: Verify Everything Works

### Test Database Connection
```bash
# From project root
npm run db:push  # Or npx prisma db push
```

### Test with API
1. Start dev server: `npm run dev`
2. Go to http://localhost:3000
3. Try registering an account
4. Create a wardrobe item
5. Upload an image
6. Check Supabase dashboard → Storage to verify image was uploaded

---

## Troubleshooting

### "Connection refused" Error
- Verify DATABASE_URL and DIRECT_URL are correct
- Check that your database password was saved
- Make sure network is accessible (Supabase may have firewall rules)

### "Permission denied" on RLS policies
- Verify you're using the **Service Role** key (not anon key) in `SUPABASE_SERVICE_KEY`
- RLS policies should be applied correctly by Prisma/backend, not frontend

### Images not uploading
- Verify buckets are created and public
- Check that Storage policies allow authenticated users to write
- Verify folder structure uses `userId` (e.g., /123e4567-e89b/item.jpg)

### Queries returning empty
- RLS policies might be too restrictive
- Verify `user_id` matches `auth.uid()` in the database
- Check that you're using authenticated requests (JWT token in header)

---

## Security Notes

- **Never commit** `.env.local` to git
- **Supabase Service Role Key** should ONLY be on the server, never in frontend `.env`
- **RLS Policies** are essential - never disable them for production
- Use **HTTPS** in production
- Rotate keys regularly in production environments

---

## Next Steps

Once Supabase is set up:
1. Run `npm run dev`
2. Test user registration at http://localhost:3000
3. Test wardrobe item creation and image upload
4. Verify data appears in Supabase dashboard
5. You're ready to deploy!

