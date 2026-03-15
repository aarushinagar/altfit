# ALTFIT Troubleshooting Log

A record of errors encountered during setup, fixes attempted, and outcomes.

---

## Error 1: Missing Environment Variables

**Error message:**
```
Environment variable not found: DATABASE_URL.
schema.prisma:10 | url = env("DATABASE_URL")
Validation Error Count: 1
```

**Cause:** No `.env.local` file with database credentials.

**Fix applied:** Created `.env.local` with placeholders for all required variables:
- `DATABASE_URL`, `DIRECT_URL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `ANTHROPIC_API_KEY`, `RAZORPAY_*`, etc.

**Result:** ✅ Worked — app could load and read env vars.

---

## Error 2: Invalid Database Connection String

**Error message:**
```
The provided database string is invalid. Error parsing connection string: invalid domain character in database URL.
Please check the string for any illegal characters.
```

**Cause:** `.env.local` still used placeholder values like `[YOUR-PASSWORD]` and `[YOUR-PROJECT-REF]`, which contain invalid URL characters.

**Fix applied:** User provided credentials. Updated:
- Project ID: `euwyvotkrbivyahysuqm`
- Anon key and service role key
- Database password: `Aarushi$369$Altfit` (URL-encoded `$` as `%24`)

**Result:** ✅ Worked — connection string became valid and could be parsed.

---

## Error 3: Cannot Reach Database (Pooler Host)

**Error message:**
```
Can't reach database server at 'aws-0-us-east-1.pooler.supabase.com:6543'
Please make sure your database server is running at 'aws-0-us-east-1.pooler.supabase.com:6543'
```

**Cause:** Using the shared pooler host `aws-0-us-east-1.pooler.supabase.com`, which may be wrong for the project's region or connectivity.

**Fix applied:** Switched to Supabase transaction pooler format:
- `DATABASE_URL`: `db.euwyvotkrbivyahysuqm.supabase.co:6543`
- `DIRECT_URL`: `db.euwyvotkrbivyahysuqm.supabase.co:5432`

**Result:** ❌ Did not work — same type of error with the new host.

---

## Error 4: Cannot Reach Database (db.* Host)

**Error message:**
```
Can't reach database server at db.euwyvotkrbivyahysuqm.supabase.co:6543
Please make sure your database server is running at 'db.euwyvotkrbivyahysuqm.supabase.co:6543'
```

**API response:** `POST /api/auth/register` returns 500 Internal Server Error.

**Cause:** Connection to Supabase database still failing. Possible reasons:
- Project paused (common for free tier after inactivity)
- IPv6-only host on a network without IPv6
- Firewall or VPN blocking outbound database connections
- Incorrect connection string from dashboard

**Fixes suggested (not yet confirmed):**
1. Restore project if paused in Supabase Dashboard
2. Copy exact connection strings from Dashboard → Connect → Transaction / Session
3. Check network and disable VPN if needed

**Result:** ⏳ Pending — waiting on user verification.

---

## Secondary Issues (Non-blocking)

### Google Sign-In Warning
```
[GSI_LOGGER]: google.accounts.id.initialize() is called multiple times.
```
**Status:** Warning only; does not block registration. Can be fixed later by avoiding duplicate `google.accounts.id.initialize()` calls.

### Password Validation Message
Error output sometimes shows `(passwordValidation.message || "Password is too weak", 400)`.
**Status:** Likely secondary; the 500 error occurs before or alongside this, so the database failure is the main blocker.

---

## Summary: What Worked vs What Did Not

| Item | Status |
|------|--------|
| Create `.env.local` with all variables | ✅ Worked |
| Add Supabase URL, project ID, anon key, service key | ✅ Worked |
| URL-encode database password (`$` → `%24`) | ✅ Worked |
| App loads and displays Create Account form | ✅ Worked |
| Database connection (aws-0-us-east-1 pooler) | ❌ Did not work |
| Database connection (db.*.supabase.co) | ❌ Did not work |
| User registration (create account) | ❌ Blocked by DB connection |

---

## Current `.env.local` Database Configuration

```
DATABASE_URL="postgresql://postgres:Aarushi%24369%24Altfit@db.euwyvotkrbivyahysuqm.supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:Aarushi%24369%24Altfit@db.euwyvotkrbivyahysuqm.supabase.co:5432/postgres"
```

---

## Next Steps to Resolve Database Connection

1. **Verify project status**
   - Supabase Dashboard → open project
   - If paused, click **Restore** and wait until it is active

2. **Use official connection strings**
   - Dashboard → **Connect**
   - Copy **Transaction** string → `DATABASE_URL`
   - Copy **Session** or **Direct** string → `DIRECT_URL`
   - Replace `[YOUR-PASSWORD]` with the actual database password (URL-encode special characters)

3. **Test connectivity**
   - Run `npx prisma db push` to confirm DB access
   - If that works, try registration again

4. **Network checks**
   - Try without VPN
   - Try from a different network if possible
