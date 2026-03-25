---
applyTo: "**"
---

# ALTFit — Core Conventions

## Canonical Import Paths

| What              | Import from                          |
| ----------------- | ------------------------------------ |
| Prisma client     | `@/backend/database/prisma`          |
| Auth middleware   | `@/backend/database/auth-middleware` |
| Response helpers  | `@/backend/database/api-response`    |
| JWT utilities     | `@/backend/database/jwt`             |
| Snowflake IDs     | `@/backend/database/snowflake`       |
| Supabase admin    | `@/backend/database/supabase`        |
| App-level actions | `@/lib/actions/*`                    |
| Auth utils        | `@/lib/utils/authUtils`              |
| Theme tokens      | `@/lib/theme/tokens`                 |
| Zod schemas       | `@/lib/schemas/*`                    |
| LLM tools         | `@/lib/tools/*`                      |
| LLM clients       | `@/lib/llm/*`                        |
| LangGraph         | `@/backend/langgraph/*`              |
| Regen config      | `@/config/regen`                     |

**Never use** `@/lib/prisma`, `@/lib/auth-middleware`, `@/lib/api-response`, `@/lib/api-client` — those paths do not exist.

## API Route Boilerplate

```typescript
import { NextRequest } from "next/server";
import {
  authenticateRequest,
  getAuthenticatedUserId,
} from "@/backend/database/auth-middleware";
import {
  successResponse,
  errorResponse,
  validateRequired,
} from "@/backend/database/api-response";
import prisma from "@/backend/database/prisma";

export async function POST(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;
    const userId = getAuthenticatedUserId(request);

    const body = await request.json();
    const missing = validateRequired(body, ["requiredField"]);
    if (missing) return missing;

    return successResponse(result, "Created successfully", 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
```

## Non-Negotiable Rules

| Rule                 | Detail                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **Auth guard**       | Every protected route: `authenticateRequest(request)` FIRST, then `getAuthenticatedUserId` |
| **User isolation**   | All DB queries include `where: { userId }`. Verify ownership before any mutation           |
| **ID format**        | IDs are Snowflake strings — never BigInt. Use `generateSnowflakeId()` for new records      |
| **Response shape**   | Always `successResponse` / `errorResponse`. Never raw `NextResponse.json()`                |
| **Prisma singleton** | `import prisma from '@/backend/database/prisma'`. Never `new PrismaClient()`               |
| **TypeScript only**  | Route files are `.ts`. No `.js` route files                                                |
| **404 errors**       | Use `errorResponse("Not found", 404)`. Never `successResponse(null, ..., 404)`             |
| **Frontend fetch**   | Components never use raw `fetch()`. Call `lib/actions/*` functions                         |

## Security — Never Do

- Never return `passwordHash`, `Session.token`, or `razorpaySignature` in any response
- Never trust client-provided IDs without a DB ownership check (`where: { id, userId }`)
- Never pass raw client data to an LLM — always fetch from Prisma/Supabase first
- Never export HTTP methods that don't exist on the route

## Response Shape

```
Success: { success: true, data: T, message: string, statusCode: number }
Error:   { success: false, error: string, statusCode: number }
```

## Project Structure

```
app/(auth)/          /signin, /register, /onboarding  (unauthenticated)
app/(app)/           /today, /wardrobe, /upload        (authenticated + AppContext)
app/                 / landing page
app/api/             all API routes
backend/database/    Prisma, JWT, auth middleware, Supabase
backend/langgraph/   LangGraph ingestion + curation pipelines
lib/actions/         client-callable server actions
lib/contexts/        AuthContext, AppContext
lib/hooks/           useWardrobe, useOutfit, useUpload, useCuration
lib/llm/             Gemini parse wrapper (callGeminiWithSchema)
lib/tools/           vision, weather, query tools
lib/schemas/         Zod schemas (wardrobeItem.ts, curation.ts)
lib/theme/           MUI theme + design tokens
lib/utils/           authUtils, dateUtils
config/              regen.ts
components/          auth, layout, upload, wardrobe, today, common, paywall
```

## Client-Side Auth Storage

Always use helpers from `@/lib/utils/authUtils`. Never read localStorage directly in components.

- `altfit-token` — JWT access token
- `altfit-user` — serialized user object
- `altfit-plan` — "free" | "pro"
- `altfit-profile` — { styles, issues } from onboarding
