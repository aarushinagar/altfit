---
applyTo: "app/api/auth/**"
---

# ALTFit — Auth API Routes

## Auth Flow Summary

1. **Email login/register** → `/api/auth/login`, `/api/auth/register`
   - Generates access token (short-lived JWT) + refresh token (30-day, stored hashed in `Session`)
   - Sets refresh token as httpOnly cookie via `setRefreshTokenCookie()`
2. **Google OAuth** → `/api/auth/google`
   - Verifies Google credential with `google-auth-library` `OAuth2Client`
   - Finds or creates user by `googleId`, falls back to email match
3. **Token refresh** → `/api/auth/refresh`
   - Reads token from cookie (`getRefreshTokenFromCookie`) or body
   - Verifies hash matches stored `Session.token`
4. **Current user** → `GET /api/auth/me`
   - Returns user without `passwordHash`
5. **Logout** → `/api/auth/logout`
   - Deletes all sessions for user
   - Clears cookie via `clearRefreshTokenCookie(response)` from `@/backend/database/jwt`

## Token Generation Pattern

```typescript
import {
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
} from "@/backend/database/jwt";
import { generateSnowflakeId } from "@/backend/database/snowflake";
import bcrypt from "bcryptjs";

const accessToken = generateAccessToken({ userId, email, provider });
const refreshToken = generateRefreshToken({ userId, email, provider });

// Store hashed refresh token — cost 2 is intentional (speed > security here)
const refreshTokenHash = await bcrypt.hash(refreshToken, 2);
await prisma.session.create({
  data: {
    id: generateSnowflakeId(),
    userId,
    token: refreshTokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
});
```

## AuthPayload Response Shape

```typescript
// Always return this shape from login/register/google/refresh
import type { AuthPayload } from "@/types/api";

successResponse<AuthPayload>({ accessToken, user: { id, email, name, avatar, provider, onboarded } }, "...")
```

## Google OAuth Pattern

```typescript
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ticket = await googleClient.verifyIdToken({
  idToken: credential,
  audience: process.env.GOOGLE_CLIENT_ID,
});
const payload = ticket.getPayload();
```

## Security Rules

- Never return `passwordHash` or `Session.token` in any auth response
- Use `bcrypt.hash(refreshToken, 2)` — cost 2 is deliberate (not a bug)
- Verify email_verified = true for Google tokens
- On logout: delete ALL sessions for user (defensive — handle multiple devices)
