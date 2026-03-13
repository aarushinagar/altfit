# ALT FIT — Backend Implementation Spec
## Supabase (Storage + DB) + Custom Auth + Prisma ORM

---

## STACK DECISIONS

| Layer | Choice | Why |
|-------|--------|-----|
| Database | Supabase (PostgreSQL) | Free tier, hosted Postgres, works perfectly with Prisma |
| File Storage | Supabase Storage | Image buckets, CDN URLs, free 1GB |
| ORM | Prisma | Type-safe queries, easy migrations |
| Auth | Custom (JWT) | Full control, no Supabase Auth dependency |
| Passwords | bcryptjs | Industry standard hashing |
| Sessions | JWT (jsonwebtoken) | Stateless, works on Vercel edge |
| Google OAuth | Google Identity Services | GIS popup → JWT issued by our server |

---

## SUPABASE SETUP

### 1. Create Project
- Go to supabase.com → New Project
- Name: `altfit`
- Region: Mumbai (ap-south-1) — closest to your users
- Copy these from Project Settings → Database:
  ```
  DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
  ```

### 2. Storage Buckets
Create two buckets in Supabase Dashboard → Storage:

| Bucket | Public | Purpose |
|--------|--------|---------|
| `wardrobe-images` | ✅ Yes | Clothing item photos |
| `profile-avatars` | ✅ Yes | User profile pictures |

#### Bucket Policies (RLS)
```sql
-- wardrobe-images: users can only access their own folder
CREATE POLICY "Users access own images"
ON storage.objects FOR ALL
USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Since we use custom auth (not Supabase auth), disable RLS
-- and handle access control in our API layer instead
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

---

## PRISMA SCHEMA

### Install
```bash
npm install prisma @prisma/client bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken
npx prisma init
```

### `prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ── USERS ──────────────────────────────────────────────────────
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  avatar       String?  // Supabase Storage URL or Google picture URL
  passwordHash String?  // null for Google OAuth users
  provider     String   @default("email") // "email" | "google"
  googleId     String?  @unique

  // Onboarding data
  styleProfiles String[] @default([])
  styleIssues   String[] @default([])
  onboarded     Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  wardrobeItems WardrobeItem[]
  outfits       Outfit[]
  subscription  Subscription?
  sessions      Session[]
}

// ── SESSIONS (for JWT refresh tokens) ──────────────────────────
model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique // hashed refresh token
  expiresAt DateTime
  createdAt DateTime @default(now())
}

// ── WARDROBE ITEMS ─────────────────────────────────────────────
model WardrobeItem {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Core
  name     String
  category String // top | bottom | dress | outerwear | footwear | bag | accessory | outfit

  // Supabase Storage
  imageUrl    String  // full public CDN URL
  storagePath String  // e.g. "wardrobe-images/user_id/item_id.jpg"

  // AI metadata
  colors     String[] @default([])
  colorNames String[] @default([])
  pattern    String?
  fabric     String?
  fit        String?
  formality  Int      @default(5) // 1-10
  season     String[] @default([])
  occasion   String[] @default([])
  stylistNote String?
  tags       String[] @default([])

  // Usage
  wearCount  Int       @default(0)
  lastWornAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  outfitItems OutfitItem[]
}

// ── OUTFITS ────────────────────────────────────────────────────
model Outfit {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  occasion       String?
  reasoning      String?
  colorStory     String?
  scoreBalance   Int?
  scoreFormality Int?
  scoreColor     Int?
  scoreNovelty   Int?

  worn   Boolean   @default(false)
  wornAt DateTime?

  createdAt DateTime @default(now())

  items OutfitItem[]
}

// ── OUTFIT ITEMS ───────────────────────────────────────────────
model OutfitItem {
  id             String       @id @default(cuid())
  outfitId       String
  outfit         Outfit       @relation(fields: [outfitId], references: [id], onDelete: Cascade)
  wardrobeItemId String
  wardrobeItem   WardrobeItem @relation(fields: [wardrobeItemId], references: [id], onDelete: Cascade)
  role           String? // base | layer | accent | statement
}

// ── SUBSCRIPTIONS ──────────────────────────────────────────────
model Subscription {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  plan   String // "monthly" | "yearly"
  status String // "active" | "cancelled" | "expired"

  razorpayOrderId   String?
  razorpayPaymentId String?
  razorpaySignature String?

  amount   Int    // paise
  currency String @default("INR")

  startedAt   DateTime  @default(now())
  expiresAt   DateTime?
  cancelledAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## ENVIRONMENT VARIABLES

```env
# Supabase
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key  # from Supabase Settings → API

# Custom Auth
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## ALL API ENDPOINTS

### AUTH

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Email + password signup |
| POST | `/api/auth/login` | Email + password login |
| POST | `/api/auth/google` | Google OAuth — verify token, issue JWT |
| POST | `/api/auth/refresh` | Refresh access token using refresh token |
| POST | `/api/auth/logout` | Invalidate refresh token |
| GET | `/api/auth/me` | Get current user from JWT |

---

### USER

| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/user/profile` | Update name, avatar |
| PATCH | `/api/user/onboarding` | Save style profiles + issues |
| DELETE | `/api/user/account` | Delete account + all data |

---

### WARDROBE

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wardrobe` | Get all wardrobe items for user |
| POST | `/api/wardrobe` | Add new item (after AI classification) |
| GET | `/api/wardrobe/[id]` | Get single item |
| PATCH | `/api/wardrobe/[id]` | Update item details |
| DELETE | `/api/wardrobe/[id]` | Delete item + remove from Supabase Storage |
| POST | `/api/wardrobe/bulk` | Save multiple items at once |
| PATCH | `/api/wardrobe/[id]/wear` | Increment wear count + set lastWornAt |

---

### UPLOAD (Supabase Storage)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/image` | Upload image → Supabase Storage → return CDN URL |
| DELETE | `/api/upload/image` | Delete image from Supabase Storage by path |

---

### AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/classify` | Send image to Claude → get clothing metadata |
| POST | `/api/ai/outfit` | Generate outfit from wardrobe items |

---

### OUTFITS

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/outfits` | Get outfit history |
| POST | `/api/outfits` | Save a generated outfit |
| PATCH | `/api/outfits/[id]/worn` | Mark outfit as worn today |

---

### PAYMENTS

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/create-order` | Create Razorpay order |
| POST | `/api/payments/verify` | Verify payment + activate subscription |
| GET | `/api/payments/subscription` | Get current subscription status |
| POST | `/api/payments/cancel` | Cancel subscription |

---

## AUTH FLOW

### Email Signup
```
Client → POST /api/auth/register { name, email, password }
Server → hash password with bcrypt (rounds: 12)
Server → create User in DB
Server → issue accessToken (JWT, 15min) + refreshToken (JWT, 30 days)
Server → store hashed refreshToken in Session table
Client → store accessToken in memory, refreshToken in httpOnly cookie
```

### Email Login
```
Client → POST /api/auth/login { email, password }
Server → find user by email
Server → bcrypt.compare(password, passwordHash)
Server → issue new accessToken + refreshToken
Client → store tokens
```

### Google OAuth
```
Client → Google GIS popup → get credential (JWT from Google)
Client → POST /api/auth/google { credential }
Server → verify credential with Google public keys
Server → extract { sub, email, name, picture }
Server → find or create User (upsert by googleId or email)
Server → issue our own accessToken + refreshToken
Client → store tokens
```

### Token Refresh
```
Client → accessToken expires (401 response)
Client → POST /api/auth/refresh (sends refreshToken cookie)
Server → verify refreshToken, check Session table
Server → issue new accessToken
Client → retry original request
```

---

## IMAGE UPLOAD FLOW

```
Client uploads image file
→ POST /api/upload/image
→ Server generates path: wardrobe-images/{userId}/{cuid()}.jpg
→ Server uploads to Supabase Storage using service key
→ Supabase returns public CDN URL
→ Server returns { url, path }

Client sends image URL to AI
→ POST /api/ai/classify { imageUrl }
→ Claude Vision analyzes image
→ Returns clothing metadata

Client saves item
→ POST /api/wardrobe { ...metadata, imageUrl, storagePath }
→ Item saved to DB
```

---

## SUPABASE STORAGE HELPER

### `lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side operations only
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function uploadImage(
  buffer: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from('wardrobe-images')
    .upload(path, buffer, {
      contentType,
      upsert: false,
    })

  if (error) throw error

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('wardrobe-images')
    .getPublicUrl(path)

  return publicUrl
}

export async function deleteImage(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from('wardrobe-images')
    .remove([path])

  if (error) throw error
}
```

---

## PRISMA MIGRATIONS

```bash
# After setting up schema
npx prisma generate
npx prisma migrate dev --name init

# On Vercel deploy
npx prisma migrate deploy
```

Add to `package.json`:
```json
"scripts": {
  "postinstall": "prisma generate",
  "migrate": "prisma migrate deploy"
}
```

---

## ADDITIONAL PACKAGES TO INSTALL

```bash
npm install @supabase/supabase-js
npm install bcryptjs jsonwebtoken
npm install @prisma/client
npm install -D prisma
npm install -D @types/bcryptjs @types/jsonwebtoken
```

---

## IMPLEMENTATION ORDER

```
1. Set up Supabase project + copy DATABASE_URL
2. Create storage buckets (wardrobe-images, profile-avatars)
3. Add all env vars to .env.local + Vercel
4. Run prisma migrate dev
5. Build /api/auth/* endpoints (register, login, google, refresh, logout)
6. Build /api/upload/image endpoint
7. Build /api/wardrobe/* endpoints
8. Build /api/ai/* endpoints (replace current direct API calls)
9. Build /api/payments/* endpoints (already partially done)
10. Connect frontend to all endpoints
```
