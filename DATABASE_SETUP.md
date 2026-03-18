# Database Setup Guide

## Current Issue

The app is failing with:
```
Authentication failed against database server at 'aws-1-ap-southeast-1.pooler.supabase.com'
The provided database credentials for 'postgres' are not valid.
```

This means the `DATABASE_URL` in `.env` has invalid credentials.

## How to Fix

### Option 1: Reset Supabase Password (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `euwyvotkrbivyahysuqm`
3. Go to **Settings → Database**
4. Click **Database password** → **Reset password**
5. Copy the new password shown in the green notification
6. Update `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.euwyvotkrbivyahysuqm:NEW_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.euwyvotkrbivyahysuqm:NEW_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```
   (Replace `NEW_PASSWORD` with the actual password, **URL-encoded**)

### Option 2: Create New Supabase Project

If password reset doesn't work:

1. Create a new project at [Supabase](https://supabase.com)
2. Copy all credentials from **Settings → Database**
3. Update `.env` with new credentials

### Password URL Encoding

If your password has special characters, URL-encode it:
- `$` → `%24`
- `@` → `%40`
- `#` → `%23`
- `&` → `%26`

Example: Password `my$pass@123` becomes `my%24pass%40123`

## Verify Connection

After updating credentials:

```bash
# Test the connection
psql $DATABASE_URL -c "SELECT 1"

# If successful, run migrations
npx prisma migrate deploy

# Start the app
npm run dev
```

## Docker Users

If using Docker, set credentials as environment variables:

```bash
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e DIRECT_URL="postgresql://..." \
  -p 3000:3000 \
  altfit
```

## Troubleshooting

### Error: "peer authentication failed"
- Verify username is `postgres.PROJECT_ID` (with period, not underscore)
- Reset password and try again

### Error: "too many connections"
- Check connection pool limits in Supabase settings
- Ensure `pgbouncer=true` is in DATABASE_URL query string

### Connection timeout
- Check IP whitelist: Settings → Database → IP Whitelist
- For development: Allow `0.0.0.0/0` (all IPs)
- For production: Add only your server's IP

## Connection Pooling

The DATABASE_URL uses pgbouncer (`:6543` port) for connection pooling, which is required for serverless deployments.

For local development, you can use the direct connection (`:5432` port) instead, but the app is configured to use pooling.

---

Once credentials are updated and connection is verified, the app should work without the 500 error.
