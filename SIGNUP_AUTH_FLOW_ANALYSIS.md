# AltFit Signup & Auth System - Complete Flow Analysis

## Overview
The signup/registration flow consists of three main components:
1. **Frontend Form** - [components/auth/Auth.tsx](components/auth/Auth.tsx)
2. **Auth API Routes** - `app/api/auth/register/` and `app/api/auth/login/`
3. **User Database Model** - [backend/database/prisma/schema.prisma](backend/database/prisma/schema.prisma)

---

## 1. SIGNUP FORM - Frontend Component

**File:** [components/auth/Auth.tsx](components/auth/Auth.tsx)

### Current Form Fields (Signup Mode)
```typescript
// Form State Variables
const [email, setEmail] = useState("");        // Required
const [password, setPassword] = useState("");  // Required
const [name, setName] = useState("");          // Required for signup
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### Form Fields Rendered
During `mode === "email-signup"`:
1. **Name** - Text input
   - Label: "NAME"
   - Placeholder: "Your name"
   - Required: Yes

2. **Email** - Email input
   - Label: "EMAIL"
   - Placeholder: "you@email.com"
   - Required: Yes

3. **Password** - Password input
   - Label: "PASSWORD"
   - Placeholder: "••••••••"
   - Required: Yes

### Client-Side Validation
```javascript
// Password validation checks
if (password.length < 8) {
  error: "Password must be at least 8 characters with uppercase, lowercase, and a number."
}
if (!/[A-Z]/.test(password)) {
  error: "Password must contain at least one uppercase letter."
}
if (!/[a-z]/.test(password)) {
  error: "Password must contain at least one lowercase letter."
}
if (!/[0-9]/.test(password)) {
  error: "Password must contain at least one number."
}
if (mode === "email-signup" && !name.trim()) {
  error: "What should we call you?"
}
```

### Form Submission Handler
```javascript
const handleEmailAuth = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  // ... validation ...
  setLoading(true);
  try {
    const res = mode === "email-signup"
      ? await registerUser(email, password, name || email.split("@")[0])
      : await loginUser(email, password);
    if (res.success && res.data) {
      onAuth(res.data.user as Record<string, unknown>);
    } else {
      setError(res.error || "Authentication failed. Please try again.");
    }
  } finally {
    setLoading(false);
  }
};
```

---

## 2. USER MODEL - Database Schema

**File:** [backend/database/prisma/schema.prisma](backend/database/prisma/schema.prisma) (**Lines 15-44**)

### Current User Model
```prisma
model User {
  id           BigInt   @id
  email        String   @unique
  name         String?
  avatar       String?
  passwordHash String?  // null for Google OAuth users
  provider     String   @default("email")  // "email" | "google"
  googleId     String?  @unique

  // Onboarding data
  styleProfiles String[] @default([])
  styleIssues   String[] @default([])
  onboarded     Boolean  @default(false)

  // ── Plan & Location ───────────────────────────────────────────
  plan               String    @default("free")
  wardrobeItemCount  Int       @default(0)
  timezone           String?                     // IANA e.g. "Asia/Kolkata"
  locationLat        Float?
  locationLon        Float?
  locationCity       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  wardrobeItems   WardrobeItem[]
  outfits         Outfit[]
  subscription    Subscription?
  sessions        Session[]
  dailyCurations  DailyCuration[]
  outfitHistories OutfitHistory[]
  styleProfile    UserStyleProfile?
  savedOutfits    SavedOutfit[]
  emailLogs       EmailLog[]

  // Email marketing preferences
  emailOptOut   Boolean  @default(false)
  unsubToken    String?  @unique

  @@index([email])
  @@index([googleId])
}
```

### Key Observations
- **No phone field exists** - Phone number is not currently stored
- **ID:** BigInt (generated via `generatePrismaId("User")`)
- **Email:** String, unique
- **Name:** Optional string
- **Provider:** Either "email" or "google"
- **Timezone:** Optional, stored as IANA format (e.g., "Asia/Kolkata")
- **Location fields:** lat/lon/city for weather/personalization

---

## 3. SIGNUP API ROUTE - Request/Response

**File:** [app/api/auth/register/route.ts](app/api/auth/register/route.ts)

### POST /api/auth/register

#### Request Body Type
From [types/api.ts](types/api.ts#L29-L32):
```typescript
export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}
```

#### Example Request
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

#### Request Validation
1. **Required fields check:** `validateRequired(body, ["email", "password"])`
2. **Email format:** `isValidEmail(email)`
3. **Password strength:** `validatePassword(password)` - Returns `{ valid: boolean, message?: string }`
4. **Duplicate check:** `prisma.user.findUnique({ where: { email } })`

#### Processing Steps
```typescript
1. Validate required fields and format
2. Check if user already exists (by email)
3. Hash password with bcrypt (12 salt rounds)
4. Create User record with:
   - id: generatePrismaId("User")
   - email
   - name (or null)
   - passwordHash
   - provider: "email"

5. Send welcome email (async, non-blocking)
6. Generate JWT access token and refresh token
7. Store refresh token hash in Session table
8. Return response with:
   - accessToken (JWT)
   - user object
   - Sets refresh token cookie
```

#### Response Body - Success (201)
From [types/api.ts](types/api.ts#L18-L27):
```typescript
export interface AuthPayload {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    provider: string;
    onboarded: boolean;
  };
}
```

#### Example Success Response
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "72036969759318017",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": null,
      "provider": "email",
      "onboarded": false
    }
  },
  "statusCode": 201
}
```

#### Response - Error Cases
```json
// Invalid email format (400)
{
  "success": false,
  "error": "Invalid email format",
  "statusCode": 400
}

// User already exists (400)
{
  "success": false,
  "error": "User with this email already exists",
  "statusCode": 400
}

// Weak password (400)
{
  "success": false,
  "error": "Password is too weak",
  "statusCode": 400
}

// Server error (500)
{
  "success": false,
  "error": "Registration failed. Please try again.",
  "statusCode": 500
}
```

---

## 4. LOGIN API ROUTE

**File:** [app/api/auth/login/route.ts](app/api/auth/login/route.ts)

### POST /api/auth/login

#### Request Body Type
From [types/api.ts](types/api.ts#L34-L37):
```typescript
export interface LoginRequest {
  email: string;
  password: string;
}
```

#### Processing Steps
```typescript
1. Validate required fields (email, password)
2. Validate email format
3. Find user by email
4. Check if user exists and has passwordHash (not OAuth-only)
5. Verify password with bcrypt.compare()
6. Generate new access + refresh tokens
7. Store refresh token hash in Session table
8. Return response with:
   - accessToken (JWT)
   - user object
   - Sets refresh token cookie
```

#### Response Format
Same as register - `AuthPayload` with `statusCode: 200`

---

## 5. TOKEN SYSTEM

### JWT Structure
Generated by [backend/database/jwt.ts](backend/database/jwt.ts):

```typescript
// Payload for both access and refresh tokens
{
  userId: string;        // BigInt.toString()
  email: string;
  provider: "email" | "google";
}
```

### Token Storage
- **Access Token:** Returned to client, stored in localStorage
- **Refresh Token:** 
  - Stored as HTTP-only cookie
  - Hash stored in `Session` table (Prisma)
  - Expires in 30 days

---

## 6. USER DATA CREATION FLOW

### Step-by-Step: Email Signup

```
1. User fills form in Auth.tsx (email, password, name)
   ↓
2. Call registerUser() → POST /api/auth/register
   ↓
3. Backend validates email format + password strength
   ↓
4. Check if email already exists
   ↓
5. Hash password with bcrypt (12 rounds)
   ↓
6. CREATE User in Prisma:
   - id: BigInt (generated)
   - email: string (unique)
   - name: string (optional)
   - passwordHash: string (hashed)
   - provider: "email"
   - All other fields: defaults
   ↓
7. Send welcome email (async)
   ↓
8. Generate JWT tokens
   ↓
9. CREATE Session in Prisma:
   - id: BigInt (generated)
   - userId: BigInt
   - token: string (hashed refresh token)
   - expiresAt: DateTime (30 days from now)
   ↓
10. Return success response with:
    - accessToken (JWT)
    - user object
    - Set refresh token cookie
   ↓
11. Frontend stores accessToken in localStorage
   ↓
12. Frontend redirects to onboarding or today page
```

---

## 7. WHERE TO ADD PHONE NUMBER

### Files That Need Updates

#### 1. Prisma Schema
**File:** [backend/database/prisma/schema.prisma](backend/database/prisma/schema.prisma)

Add to User model:
```prisma
model User {
  id           BigInt   @id
  email        String   @unique
  name         String?
  phone        String?  // Add this line
  avatar       String?
  passwordHash String?
  // ... rest of model
}
```

#### 2. TypeScript Types
**File:** [types/api.ts](types/api.ts)

Update `RegisterRequest`:
```typescript
export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  phone?: string;  // Add this
}

export interface AuthPayload {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    phone: string | null;  // Add this
    provider: string;
    onboarded: boolean;
  };
}
```

#### 3. Frontend Form Component
**File:** [components/auth/Auth.tsx](components/auth/Auth.tsx)

Add form state:
```typescript
const [phone, setPhone] = useState("");
```

Add form field (in signup mode):
```jsx
<div>
  <label style={labelStyle}>Phone Number</label>
  <input
    type="tel"
    value={phone}
    onChange={(e) => setPhone(e.target.value)}
    placeholder="+1 (555) 000-0000"
    style={inputStyle}
    onFocus={(e) => (e.target.style.borderColor = "var(--gold)")}
    onBlur={(e) => (e.target.style.borderColor = "var(--linen)")}
  />
</div>
```

Add validation:
```typescript
if (mode === "email-signup" && !phone.trim()) {
  setError("Please enter your phone number");
  return;
}
```

Update register call:
```typescript
const res = mode === "email-signup"
  ? await registerUser(email, password, name || email.split("@")[0], phone)
  : await loginUser(email, password);
```

#### 4. Backend Register Route
**File:** [app/api/auth/register/route.ts](app/api/auth/register/route.ts)

Add phone to request body:
```typescript
const { email, password, name, phone } = body as RegisterRequest;
```

Add phone validation (optional, but recommended):
```typescript
// Optional: Validate phone format
if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone.replace(/\D/g, ''))) {
  return errorResponse("Invalid phone number format", 400);
}
```

Add phone to User creation:
```typescript
const user = await prisma.user.create({
  data: {
    id: generatePrismaId("User") as never,
    email,
    name: name || null,
    phone: phone || null,
    passwordHash,
    provider: "email",
  },
});
```

Add phone to response:
```typescript
const response = successResponse<AuthPayload>(
  {
    accessToken,
    user: {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      phone: user.phone,  // Add this
      provider: user.provider,
      onboarded: user.onboarded,
    },
  },
  "User registered successfully",
  201,
);
```

#### 5. Update Auth Action Function
**File:** [lib/actions/auth.ts](lib/actions/auth.ts)

The `registerUser()` function will need to accept phone parameter:
```typescript
export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone?: string  // Add this
): Promise<ApiResponse<AuthPayload>> {
  // ... existing code ...
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name,
      phone,  // Add this
    }),
  });
  // ... rest of function
}
```

---

## 8. MIGRATION REQUIRED

After adding the phone field to the User model:

```bash
# Generate migration
npx prisma migrate dev --name add_phone_to_user

# This will:
# 1. Create a migration file in backend/database/prisma/migrations/
# 2. Run the migration against your database
# 3. Regenerate Prisma Client
```

---

## 9. KEY FILES TO UPDATE (In Order)

1. **[backend/database/prisma/schema.prisma](backend/database/prisma/schema.prisma)** - Add phone field to User model
2. **[types/api.ts](types/api.ts)** - Update RegisterRequest and AuthPayload types
3. **[components/auth/Auth.tsx](components/auth/Auth.tsx)** - Add phone form input and validation
4. **[lib/actions/auth.ts](lib/actions/auth.ts)** - Update registerUser() function signature
5. **[app/api/auth/register/route.ts](app/api/auth/register/route.ts)** - Accept and store phone
6. **Run `npx prisma migrate dev`** - Create and run migration

---

## 10. TESTING SIGNUP FLOW

### Manual Test Checklist
```
[ ] Form displays phone input field on signup
[ ] Phone validation runs (if implemented)
[ ] Phone is submitted in request body
[ ] Phone is stored in database
[ ] Phone is returned in auth response
[ ] Existing login flow still works (phone optional)
[ ] Google OAuth still works (phone not required for OAuth)
```

### API Test - Register with Phone
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "name": "Test User",
    "phone": "+1 (555) 123-4567"
  }'
```

---

## 11. ADDITIONAL NOTES

### Database Schema
- **ID Generation:** User and Session IDs are generated via `generatePrismaId()` which creates BigInt snowflake IDs
- **BigInt:** Used for high-volume ID generation and tenant isolation
- **Email:** Indexed for fast lookups during login
- **Row Level Security:** Implemented via Supabase policies

### Password Security
- Bcrypt hash with 12 salt rounds for user password
- Bcrypt hash with 2 rounds for token storage (speed optimization)
- Refresh tokens are hashed before storage

### Auth Flow
- Dual tokens: Access token (short-lived) + Refresh token (30 days, httpOnly cookie)
- JWT structure includes: userId, email, provider
- Session table tracks valid refresh tokens
- Invalid email/password returns generic error (security!)

### Google OAuth
- Stored as `provider: "google"` with `googleId` field
- `passwordHash` is null for OAuth users
- Email and name extracted from Google JWT
- Same token generation flow as email signup
