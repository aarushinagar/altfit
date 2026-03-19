# Render Environment Setup Guide

## Problem
The app is deployed but failing with: `DATABASE_URL is empty`. Environment variables aren't being loaded.

## Solution
You must set environment variables directly in the Render dashboard. The `render.yaml` file expects these values to be pre-configured.

## Step-by-Step Setup

### 1. Open Render Dashboard
- Go to https://dashboard.render.com
- Click on **altfit** service (or your service name)

### 2. Navigate to Environment Tab
- Click **Environment** in the left sidebar
- You should see **Environment Variables** section

### 3. Add These Variables (ONE BY ONE)

Copy-paste each line exactly as shown. Render will parse the key and value.

#### Public Variables (Safe to see in UI)
```
FRONTEND_URL=https://altfit-6fma.onrender.com
NEXT_PUBLIC_APP_URL=https://altfit-6fma.onrender.com
```

#### Sensitive Variables (CRITICAL - Hidden in UI)
These are from your `.env` file. Copy the values from your local `.env` file, NOT the ones shown here:

```
DATABASE_URL=[your_database_url_from_.env]
DIRECT_URL=[your_direct_url_from_.env]
JWT_SECRET=[your_jwt_secret_from_.env]
SUPABASE_SERVICE_ROLE_KEY=[your_service_role_key_from_.env]
SUPABASE_SERVICE_KEY=[your_service_key_from_.env]
ANTHROPIC_API_KEY=[your_anthropic_api_key_from_.env]
GOOGLE_CLIENT_ID=[your_google_client_id_from_.env]
GOOGLE_SECRET_KEY=[your_google_secret_key_from_.env]
RAZORPAY_KEY_ID=[your_razorpay_key_id_from_.env]
RAZORPAY_KEY_SECRET=[your_razorpay_key_secret_from_.env]
```

To find these values:
1. Open your local `.env` file
2. Copy the value after the `=` for each key
3. Paste into Render's Environment tab

### 4. For Each Variable:
1. Click **Add Environment Variable**
2. Paste the key name (e.g., `DATABASE_URL`)
3. Paste the value (the part after `=`)
4. Click **Save** (or it auto-saves)

### 5. Redeploy
- Go to **Deployments** tab
- Click **Deploy latest commit**
- Wait 2-3 minutes for deployment to complete
- Check Logs tab to verify DATABASE_URL error is gone

### 6. Test
- Open https://altfit-6fma.onrender.com/signin
- Try logging in - should work now
- Check browser console for any errors

## Debugging

If still getting DATABASE_URL errors:

1. **Check Logs Tab**
   - Go to service Logs
   - Look for "DATABASE_URL" or "Prisma" errors
   - Screenshot any errors

2. **Verify Variables Were Saved**
   - Go to Environment tab
   - Scroll down and check if variables appear in the list
   - Some may show as hidden (•••) if marked sensitive

3. **Force Redeploy**
   - Go to Settings → General
   - Scroll to "Render URL" section
   - Click "Manual Deploy" → "Deploy latest commit"

## Alternative: Check Current Values

If you need to verify what Render is reading:

```bash
# This will show in logs if DATABASE_URL is loaded (from startup code)
# Check Logs tab after deployment
```

The startup code will log if DATABASE_URL is present (via startup.ts checking).

---

**Note**: This setup is permanent until you change the Environment variables in Render dashboard. You don't need to redeploy for most env var changes (Render hot-reloads), but major version changes may require manual deploy.
