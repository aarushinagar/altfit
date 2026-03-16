# Digital Wardrobe — Agentic Workflow Design Document

**Version:** 3.0 (Final)
**Model:** `gemini-2.5-flash-lite`
**Stack:** Next.js (TypeScript) · Supabase · LangGraph.js · Gemini Vision API
**Last Updated:** 2026-03-16
**Changelog from v2.0:**

- Full TypeScript stack — no Python, no Pydantic, Zod for schema validation
- LangGraph.js runs inside Next.js API routes (no separate FastAPI service)
- Ingestion is fully synchronous — no job IDs, no polling, no streaming
- Curation triggers only on outfit page visit, not on login
- Simplified 2-tier query fallback (filtered → top 10 recent)
- Image storage finalized: WebP Q80 (25–34% smaller than JPEG, Gemini-compatible)
- No vectorization — SQL only, forever until explicitly revisited

---

## Repo Alignment Notes

> **Read this section first.** The original v3.0 design doc used "outfit" for an individual clothing piece. The actual repo uses `WardrobeItem` (Prisma model) for individual clothing pieces and `Outfit` for a curated ensemble (combination of wardrobe items). This section records all deviations and required adaptations.

### Terminology Map

| Design Doc Term                    | Repo Equivalent                                       | Notes                                                                                |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| "outfit" (single clothing piece)   | `WardrobeItem` (Prisma model)                         | The wardrobe_items table                                                             |
| "outfit_ids" in curation slots     | `wardrobeItemId[]` strings                            | IDs from WardrobeItem                                                                |
| "outfits table"                    | `wardrobe_items` (underlying SQL)                     | WardrobeItem Prisma model                                                            |
| "outfit upload pipeline"           | wardrobe item ingestion pipeline                      | `POST /api/wardrobe` + `POST /api/upload/image`                                      |
| "daily curation slot outfit combo" | `Outfit` (Prisma model)                               | The existing Outfit model = a curated combination                                    |
| `get_outfit_candidates` SQL RPC    | `get_wardrobe_candidates`                             | Rename in actual implementation                                                      |
| `POST /api/outfits/upload`         | `POST /api/wardrobe` (existing) + new ingestion graph | Existing endpoint, new LangGraph graph replaces the Anthropic classify-clothing call |
| `POST /api/curations/today`        | New endpoint (does not exist yet)                     | Needs to be created                                                                  |

### Current vs. Proposed Tech Stack

| Layer                 | Current Repo                                                                              | Proposed in this Doc                      | Action                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Vision classification | Anthropic Claude (`@anthropic-ai/sdk`) calls `/api/classify-clothing` (**route missing**) | Gemini Vision via `@google/generative-ai` | Replace the missing classify-clothing route with the LangGraph ingestion graph using Gemini |
| Image processing      | Browser canvas → JPEG (client-side)                                                       | Sharp server-side → WebP Q80              | Add Sharp to server-side ingestion pipeline. Browser canvas still used for preview only.    |
| LangGraph             | Not installed                                                                             | `@langchain/langgraph`                    | `npm install @langchain/langgraph`                                                          |
| IndexedDB cache       | Not implemented                                                                           | `idb-keyval`                              | `npm install idb-keyval`                                                                    |
| Weather               | Not implemented                                                                           | Open-Meteo + Nominatim                    | No package needed (REST API calls)                                                          |
| Curation endpoint     | Not implemented                                                                           | `POST /api/curations/today`               | New route to create                                                                         |

### Prisma Schema Gap Analysis

Existing `WardrobeItem` fields that already satisfy the proposed `outfits` table:

- `category` ✓ — needs enum validation
- `imageUrl` ✓ — keep
- `colors` / `colorNames` ✓ — exists; supplement with `primaryColorHex`
- `pattern` ✓ — exists (as `pattern`)
- `fabric` ✓ — exists (as `fabric`; rename to `material` in new context)
- `fit` ✓ — exists (as `fit`)
- `formality` — EXISTS but as `Int (1-10)`, needs to change to `String` enum
- `season` ✓ — exists (as `season String[]`)
- `occasion` ✓ — exists (as `occasion String[]`)
- `tags` ✓ — multi-purpose; supplement with specific new fields

Fields to ADD to `WardrobeItem`:

- `primaryColorHex` — hex string for primary color
- `secondaryColorName`, `secondaryColorHex` — secondary color support
- `colorPattern` — solid/striped/plaid/floral/graphic/etc. (replaces `pattern`)
- `fitType` — slim/regular/relaxed/oversized/tailored/cropped/unknown (replaces `fit`)
- `length` — short/midi/long (new)
- `neckline` — nullable (new)
- `material` — string (replaces `fabric`)
- `texture` — smooth/ribbed/woven/fuzzy/sheer/matte/glossy (new)
- `weight` — lightweight/midweight/heavyweight (new)
- `subcategory` — e.g., "t-shirt", "blazer", "chinos" (new)
- `suitableTempMinC` — Int (new)
- `suitableTempMaxC` — Int (new)
- `weatherTags` — String[] (new)
- `styleAesthetic` — String[] (new; replaces `tags` partially)
- `brand` — String? nullable (new)
- `parseConfidence` — Float? (new)
- `parseModel` — String? (new)
- `parseNotes` — String? (replaces `stylistNote`)
- `needsReview` — Boolean default false (new)
- `isActive` — Boolean default true (soft delete, new)

Fields to ADD to `User` model:

- `plan` — String default "free" (fast plan check without joining Subscription)
- `wardrobeItemCount` — Int default 0 (replaces the COUNT query for free tier check)
- `timezone` — String? (IANA)
- `locationLat` — Float?
- `locationLon` — Float?
- `locationCity` — String?

New Prisma model needed:

- `DailyCuration` — see §7.2 for full schema

### Missing API Route

`/api/classify-clothing` — referenced in `lib/actions/upload.ts` but the route file does not exist in `app/api/`. This was previously wired but removed. The LangGraph ingestion graph replaces this endpoint entirely.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Stack Decisions](#2-architecture--stack-decisions)
3. [Image Storage — Final Decision](#3-image-storage--final-decision)
4. [Weather MCP Integration](#4-weather-mcp-integration)
5. [Regeneration Config System](#5-regeneration-config-system)
6. [Timezone-Aware Curation & Caching](#6-timezone-aware-curation--caching)
7. [Database Schema](#7-database-schema)
8. [Workflow 1 — Outfit Ingestion Pipeline](#8-workflow-1--outfit-ingestion-pipeline)
9. [Workflow 2 — Daily Outfit Curation Pipeline](#9-workflow-2--daily-outfit-curation-pipeline)
10. [Tool Definitions (TypeScript)](#10-tool-definitions-typescript)
11. [LLM Skill Prompts](#11-llm-skill-prompts)
12. [Zod Schemas](#12-zod-schemas)
13. [Rate Limiting & Quota Management](#13-rate-limiting--quota-management)
14. [BigInt / Snowflake ID Handling](#14-bigint--snowflake-id-handling)
15. [Error Handling & Retry Strategy](#15-error-handling--retry-strategy)
16. [Future Expansion Notes](#16-future-expansion-notes)

---

## 1. System Overview

Users build a digital wardrobe by uploading outfit images. On each visit to the outfit page, they get 3 AI-curated outfit suggestions calibrated to today's local weather. The entire system is TypeScript — LangGraph.js graphs run directly inside Next.js API route handlers.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                 │
│  • Geolocation API → lat/lon                                             │
│  • Intl.DateTimeFormat → IANA timezone                                   │
│  • IndexedDB (idb-keyval) → client-side daily curation cache            │
└──────────────┬───────────────────────────────────────────────────────────┘
               │ fetch / server actions
               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NEXT.JS APP ROUTER (TypeScript)                                         │
│                                                                          │
│  POST /api/outfits/upload                                                │
│    Sharp → WebP Q80 → Supabase Storage                                  │
│    → LangGraph.js IngestionGraph (inline) → Supabase INSERT              │
│    → Returns: { outfitId, metadata } synchronously                      │
│                                                                          │
│  POST /api/curations/today                                               │
│    Check daily_curations cache (local_date + timezone)                   │
│    HIT → return immediately                                              │
│    MISS → LangGraph.js CurationGraph (inline)                            │
│         → MCP weather tool → query outfits → LLM curate                 │
│         → Supabase UPSERT → return result                                │
└──────────────┬───────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────┐    ┌─────────────────────────────────────────────┐
│  SUPABASE           │    │  EXTERNAL                                   │
│  • outfits          │    │  • Open-Meteo API (weather, no key)         │
│  • daily_curations  │    │  • Nominatim OSM (reverse geocoding)        │
│  • users            │    │  • Gemini API (vision + curation LLM)       │
│  • Supabase Storage │    └─────────────────────────────────────────────┘
└─────────────────────┘
```

### Key Simplifications vs v2

| v2 Design                      | v3 Decision                        | Reason                                            |
| ------------------------------ | ---------------------------------- | ------------------------------------------------- |
| Python FastAPI + LangGraph     | LangGraph.js in Next.js API routes | Same language, fewer services, simpler deployment |
| Pydantic schemas               | Zod schemas                        | TypeScript-native                                 |
| Streaming responses            | Standard JSON HTTP                 | Simpler, sufficient for these pipelines           |
| Job ID + polling for ingestion | Synchronous ingestion response     | No background workers needed                      |
| SSE for curation progress      | Standard await + JSON              | No streaming needed for 3–5s pipeline             |
| Tier 3 (30 recent, no filter)  | Fallback = top 10 most recent      | Cleaner, sufficient for free tier                 |
| JPEG Q85 source storage        | WebP Q80 source storage            | 25–34% smaller, Gemini supports WebP              |

---

## 2. Architecture & Stack Decisions

### 2.1 LangGraph.js vs Python LangGraph

**Decision: LangGraph.js, running inside Next.js API routes.**

Integrating Python LangGraph with Next.js is not straightforward — LangGraph is a Python framework while Next.js is JavaScript, requiring a separate service and cross-language HTTP calls. Since the entire stack is TypeScript, LangGraph.js eliminates this entirely. The graph runs as a plain async function called from the API route handler.

```typescript
// app/api/curations/today/route.ts
import { CurationGraph } from "@/lib/graphs/curation";

export async function POST(req: Request) {
  const body = await req.json();
  const graph = CurationGraph.compile();
  const result = await graph.invoke({ ...body });
  return Response.json(result);
}
```

No separate server. No Docker container for Python. No cross-language type definitions.

### 2.2 No Streaming

LangGraph.js supports streaming but this app doesn't need it. The ingestion pipeline takes ~2–3 seconds (one Gemini Vision call). The curation pipeline takes ~3–5 seconds (one weather call + one DB query + one LLM call). Standard `await` on a JSON POST is sufficient. A loading spinner on the client covers the UX gap.

If the curation pipeline ever grows to 10+ seconds, revisit streaming at that point.

### 2.3 Ingestion is Synchronous — No Job IDs

**Decision: Upload → process → respond, all in one HTTP request.**

The previous design used a job ID + polling pattern to handle asynchronous Gemini Vision processing. This adds complexity (job status table, polling loop, client state management) that isn't justified.

The Gemini Vision API (`gemini-2.5-flash-lite`) responds in 1–3 seconds for a single image. Sharp processing is <200ms. Supabase INSERT is <100ms. Total: under 4 seconds, well within a standard HTTP timeout. The client just awaits the POST response.

```
Client POST /api/outfits/upload
  → server processes synchronously (~3s)
  → returns { outfitId, metadata } or { error }
Client shows loading state → receives result → updates UI
```

**Important:** Do not run this in a Vercel Serverless Function if you're on the default 10s timeout. Use Vercel's `maxDuration = 30` or run on a VPS / Fly.io where you control timeout. Self-hosted Next.js has no timeout constraint.

### 2.4 Curation Triggers Only on Outfit Page Visit

**Decision: Curation pipeline runs only when the user navigates to `/wardrobe` or `/outfits`.**

It does NOT run on login. It does NOT run in a background cron. The sequence:

1. User navigates to the outfit page
2. Client sends `POST /api/curations/today` with `{ lat, lon, timezone }`
3. Server checks `daily_curations` for `(user_id, local_date, timezone)` — HIT returns immediately
4. MISS triggers the LangGraph Curation pipeline, stores result, returns it
5. Client also checks IndexedDB first (before the network request) and renders from cache if available

This means the first visit of the day has a ~4–6 second wait. Subsequent visits that day are instant (IndexedDB). This is acceptable.

---

## 3. Image Storage — Final Decision

### 3.1 Format: WebP Q80

**Store source images as WebP at quality 80. Serve them as-is.**

This decision is now sound because:

1. Gemini supports WebP as an input format for image analysis alongside JPEG, PNG, and HEIF. This removes the only previous blocker to using WebP as source.
2. WebP achieves 25–34% smaller file sizes than JPEG at equivalent perceptual quality (SSIM). For a free-tier user with 10 outfit photos, this could be the difference between 8MB and 12MB of storage per user — meaningful at scale.
3. WebP is natively supported in all modern browsers (Chrome, Firefox, Safari, Edge) — no conversion needed at serve time.
4. Supabase Storage serves WebP files directly without any transform overhead.

**Why not JPEG anymore?**
The v2 rationale for JPEG was "Gemini doesn't support WebP." That was based on an outdated source. Gemini's current documentation confirms WebP support.

**Why not AVIF?**
AVIF has better compression than WebP (~30% better) but is still not supported by Supabase's image transform pipeline and has significantly higher encoding CPU cost. Not worth it yet.

### 3.2 Upload Pipeline

```typescript
// lib/image/process.ts
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ProcessedImage {
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: "webp";
}

export async function processAndUploadOutfitImage(
  file: File,
  userId: string,
): Promise<ProcessedImage> {
  const inputBuffer = Buffer.from(await file.arrayBuffer());

  // Process with Sharp
  const { data: webpBuffer, info } = await sharp(inputBuffer)
    .rotate() // auto-rotate from EXIF orientation
    .resize(1200, 1200, {
      // max 1200px — sufficient for LLM analysis
      fit: "inside", // preserve aspect ratio
      withoutEnlargement: true, // never upscale
    })
    .flatten({ background: "#ffffff" }) // handle transparent PNGs (HEIC etc.)
    .webp({
      quality: 80, // good visual quality, ~25-34% smaller than JPEG Q85
      effort: 4, // encoding effort 0-6; 4 = good balance of speed/size
    })
    .toBuffer({ resolveWithObject: true });

  // Upload to Supabase Storage
  const fileName = `${userId}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("outfits")
    .upload(fileName, webpBuffer, {
      contentType: "image/webp",
      cacheControl: "31536000, immutable", // 1 year — content-addressed, never changes
      upsert: false,
    });

  if (uploadError)
    throw new Error(`Storage upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from("outfits").getPublicUrl(fileName);

  return {
    url: publicUrl,
    width: info.width,
    height: info.height,
    sizeBytes: info.size,
    format: "webp",
  };
}
```

**Note on max resolution:** Reduced from 1500px (v2) to 1200px. Gemini Vision analyzes features and patterns, not pixel-perfect details. 1200px is more than sufficient and reduces storage by ~36% vs 1500px at the same quality.

### 3.3 Serving Images in Next.js

Since images are already WebP, Supabase's transform pipeline is not needed for format conversion. Use it only for responsive resizing:

```typescript
// lib/image/loader.ts
export default function outfitImageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
}) {
  // Supabase transform: resize only, no format conversion needed (already WebP)
  return `${src}?width=${width}&quality=80`;
}
```

```typescript
// next.config.ts
const config: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./lib/image/loader.ts",
  },
};
```

---

## 4. Weather MCP Integration

### 4.1 Decision: Open-Meteo via HTTP Tool Call (Not MCP)

**Revised from v2:** After considering the "no streaming, keep it simple" constraint, a dedicated MCP server adds infrastructure complexity that isn't warranted for a single API call. Instead, implement the weather fetch as a regular LangGraph.js tool that calls Open-Meteo and Nominatim directly via `fetch`. This is simpler, has zero external dependencies, and is equally testable.

The MCP abstraction would only be valuable if multiple agents needed to share the weather tool, or if you needed to swap providers at runtime without code changes. For a single pipeline, a typed `tool()` function is sufficient.

**If/when you need MCP:** Use `isdaniel/mcp_weather_server` (supports `streamable-http` transport, Open-Meteo backend, no API key). Wire it via `@langchain/mcp-adapters`'s `MultiServerMCPClient`.

### 4.2 Commercial Licensing Note

Open-Meteo's free tier is for **non-commercial use only**. For a commercial product:

- Subscribe to their commercial plan (~€10/month)
- Or use OpenWeatherMap free tier (1,000 calls/day) as the primary, Open-Meteo as fallback

Budget this from day one.

### 4.3 Weather Tool Implementation

```typescript
// lib/tools/weather.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const WeatherOutputSchema = z.object({
  temp_c: z.number(),
  feels_like_c: z.number(),
  condition: z.enum(["sunny", "cloudy", "rainy", "snowy", "foggy", "windy"]),
  wmo_code: z.number(),
  humidity_pct: z.number().int(),
  wind_kph: z.number(),
  uv_index: z.number(),
  is_daytime: z.boolean(),
  city_name: z.string(),
  iana_timezone: z.string(), // e.g. "Asia/Kolkata" — used for local date calculation
  description: z.string(),
  fetched_at_utc: z.string(),
});

export type WeatherOutput = z.infer<typeof WeatherOutputSchema>;

// WMO weather code → condition string
const WMO_CONDITION_MAP: Record<number, WeatherOutput["condition"]> = {
  0: "sunny",
  1: "sunny",
  2: "cloudy",
  3: "cloudy",
  45: "foggy",
  48: "foggy",
  51: "rainy",
  53: "rainy",
  55: "rainy",
  61: "rainy",
  63: "rainy",
  65: "rainy",
  71: "snowy",
  73: "snowy",
  75: "snowy",
  77: "snowy",
  80: "rainy",
  81: "rainy",
  82: "rainy",
  85: "snowy",
  86: "snowy",
  95: "rainy",
  96: "rainy",
  99: "rainy",
};

function wmoToCondition(code: number): WeatherOutput["condition"] {
  return WMO_CONDITION_MAP[code] ?? "cloudy";
}

export const getWeatherTool = tool(
  async ({
    lat,
    lon,
  }: {
    lat: number;
    lon: number;
  }): Promise<WeatherOutput> => {
    // 1. Open-Meteo current weather
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.searchParams.set("latitude", String(lat));
    weatherUrl.searchParams.set("longitude", String(lon));
    weatherUrl.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,uv_index,is_day",
    );
    weatherUrl.searchParams.set("timezone", "auto"); // returns IANA timezone in response

    const weatherRes = await fetch(weatherUrl.toString());
    if (!weatherRes.ok)
      throw new Error(`Open-Meteo error: ${weatherRes.status}`);
    const weatherData = await weatherRes.json();

    const current = weatherData.current;
    const ianaTimezone: string = weatherData.timezone; // e.g. "Asia/Kolkata"

    // 2. Nominatim reverse geocoding for city name
    // Rate limit: 1 req/s. For a once-per-day-per-user pattern this is fine.
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const cityRes = await fetch(nominatimUrl, {
      headers: { "User-Agent": "DigitalWardrobeApp/1.0" }, // Required by Nominatim policy
    });
    const cityData = cityRes.ok ? await cityRes.json() : null;
    const cityName: string =
      cityData?.address?.city ??
      cityData?.address?.town ??
      cityData?.address?.village ??
      cityData?.address?.county ??
      "your location";

    const wmoCode: number = current.weather_code;
    const windKph: number = current.wind_speed_10m;
    const tempC: number = current.temperature_2m;
    const feelsLikeC: number = current.apparent_temperature;

    return {
      temp_c: tempC,
      feels_like_c: feelsLikeC,
      condition: wmoToCondition(wmoCode),
      wmo_code: wmoCode,
      humidity_pct: current.relative_humidity_2m,
      wind_kph: windKph,
      uv_index: current.uv_index ?? 0,
      is_daytime: current.is_day === 1,
      city_name: cityName,
      iana_timezone: ianaTimezone,
      description: `${wmoToCondition(wmoCode)}, ${Math.round(tempC)}°C, feels like ${Math.round(feelsLikeC)}°C, wind ${Math.round(windKph)} km/h in ${cityName}`,
      fetched_at_utc: new Date().toISOString(),
    };
  },
  {
    name: "get_weather",
    description:
      "Fetches current weather conditions for outfit selection given latitude and longitude.",
    schema: z.object({
      lat: z.number().describe("Latitude of the user's location"),
      lon: z.number().describe("Longitude of the user's location"),
    }),
  },
);
```

---

## 5. Regeneration Config System

The config lives in `config/regen.ts`, version-controlled, checked into the codebase. It is the single source of truth — no duplication across services since everything is TypeScript.

```typescript
// config/regen.ts

/**
 * Controls outfit regeneration behavior.
 * Tweak during development and testing. Production defaults are marked.
 *
 * This config is read server-side in the Next.js API route and passed
 * directly into the LangGraph curation graph state.
 */
export const REGEN_CONFIG = {
  // ── Free Tier Limits ────────────────────────────────────────────────

  /** Number of free regenerations per day. [PROD: 1] */
  freeRegenPerDay: 1,

  /** Which slots can be regenerated on free tier. [PROD: "any"] */
  freeRegenSlotConstraint: "any" as "any" | "last",

  // ── Item Reuse Policy ───────────────────────────────────────────────

  /**
   * Can items in OTHER (non-regenerated) slots appear in the new slot?
   * true  = item in slot 1 can also appear in regenerated slot 3
   * false = all items across all 3 slots must be unique  [PROD: true]
   */
  allowCrossSlotItemReuse: true,

  /**
   * Can the new slot contain ANY items from the slot it is replacing?
   * true  = partial overlap allowed; at least minItemsChanged must differ
   * false = new slot must be 100% different items from old slot  [PROD: false]
   */
  allowPartialSlotOverlap: false,

  /**
   * Minimum number of items that must change between old and new slot.
   * Only applied when allowPartialSlotOverlap = true.
   */
  minItemsChanged: 1,

  // ── Candidate Pool ─────────────────────────────────────────────────

  /**
   * Which outfit IDs to exclude from the candidate pool when regenerating.
   * "none"          = LLM picks freely
   * "replaced_slot" = exclude only the slot being replaced  [PROD: "replaced_slot"]
   * "all_slots"     = exclude all currently shown items
   */
  excludeFromPool: "replaced_slot" as "none" | "replaced_slot" | "all_slots",

  // ── Diversity ──────────────────────────────────────────────────────

  /**
   * Instruct the LLM to pick a vibe distinct from the other two slots.
   * [PROD: true]
   */
  enforceDistinctVibe: true,
} as const;

export type RegenConfig = typeof REGEN_CONFIG;
```

This config is imported in the Next.js API route, serialized to plain JSON, and passed in the graph's initial state. No duplication, no drift.

---

## 6. Timezone-Aware Curation & Caching

### 6.1 Why This Matters

Curation date must be keyed to the **user's local calendar date**, not UTC. A user in Delhi (UTC+5:30) at 11:30 PM is on a different local date than a user in London at the same UTC instant. Keying on UTC causes wrong-day curations for users in non-UTC timezones.

### 6.2 Getting the Timezone

**Primary source: Browser**

```typescript
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// e.g. "Asia/Kolkata", "America/New_York", "Europe/London"
```

This is sent in every `POST /api/curations/today` request body.

**Secondary source: Open-Meteo API response**
The `timezone` field in the Open-Meteo response gives the IANA timezone for the coordinates. Used if the browser value is unavailable or for cross-validation.

**Stored preference:** Optionally persist timezone in `users.timezone`. Let users override it manually for travel scenarios. Never auto-update it silently.

### 6.3 Computing Local Date

```typescript
// lib/timezone.ts

/**
 * Returns the user's local calendar date as "YYYY-MM-DD".
 * Uses en-CA locale which natively produces YYYY-MM-DD.
 */
export function getUserLocalDate(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Returns the Unix timestamp (ms) of midnight at the END of today
 * in the given timezone. Used to set browser cache expiry.
 */
export function getLocalMidnightTimestamp(timezone: string): number {
  const localDate = getUserLocalDate(timezone);
  const [y, m, d] = localDate.split("-").map(Number);
  // Construct the next day in that timezone and convert to UTC
  const nextDayStr = `${y}-${String(m).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}T00:00:00`;
  // Use Intl to parse this as a local date in the given timezone
  return new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      ...fullDateTimeOptions,
    })
      .formatToParts(new Date(nextDayStr))
      .reduce(toDateFields, {} as DateFields),
  ).getTime();
  // Simpler approximation: just add remaining hours until midnight
  // return Date.now() + getRemainingMsInLocalDay(timezone);
}
```

### 6.4 Three-Layer Cache

| Layer                      | Speed | Scope       | Invalidation                                  |
| -------------------------- | ----- | ----------- | --------------------------------------------- |
| IndexedDB (browser)        | ~0ms  | This device | Expires at local midnight                     |
| Supabase `daily_curations` | ~50ms | All devices | New row per `(user_id, local_date, timezone)` |
| LangGraph CurationGraph    | ~4–6s | On-demand   | Runs only on DB cache miss                    |

```typescript
// lib/curation/cache.ts
import { get, set } from "idb-keyval";
import { getUserLocalDate } from "@/lib/timezone";

function cacheKey(userId: string, timezone: string) {
  return `curation:${userId}:${getUserLocalDate(timezone)}`;
}

export async function getCachedCuration(userId: string, timezone: string) {
  try {
    const cached = await get(cacheKey(userId, timezone));
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) return null; // past local midnight
    return cached.data;
  } catch {
    return null; // IndexedDB unavailable (incognito, etc.)
  }
}

export async function setCachedCuration(
  userId: string,
  timezone: string,
  data: CurationResult,
  expiresAt: number,
) {
  try {
    await set(cacheKey(userId, timezone), { data, expiresAt });
  } catch {
    // Non-fatal — DB cache is the authoritative source
  }
}
```

---

## 7. Database Schema

> **Repo note:** In this repo `outfits` (doc terminology) = `WardrobeItem` (Prisma model). The SQL table is `wardrobe_items`. All SQL below is written using the actual Prisma model name `WardrobeItem` and its underlying table name. Fields that already exist in the current schema are marked ✓. New fields to add via Prisma migration are marked ✦.

### 7.1 `WardrobeItem` Model Updates (was `outfits` table in v3 doc)

The existing `WardrobeItem` Prisma model already has `id`, `userId`, `name`, `category`, `imageUrl`, `storagePath`, `colors`, `colorNames`, `pattern`, `fabric`, `fit`, `formality (Int)`, `season`, `occasion`, `stylistNote`, `tags`, `wearCount`, `lastWornAt`.

New fields to add (Prisma migration required):

```prisma
model WardrobeItem {
  // ... existing fields ...

  // ✦ New: Enhanced color metadata
  primaryColorName  String?   // ✓ exists as colorNames[0], promote to own field
  primaryColorHex   String?   // ✦ NEW
  secondaryColorName String?  // ✦ NEW
  secondaryColorHex  String?  // ✦ NEW
  colorPattern      String?   // ✦ NEW (replaces pattern field)

  // ✦ New: Enhanced garment metadata
  subcategory       String?   // ✦ NEW (e.g., "t-shirt", "blazer", "chinos")
  fitType           String?   // ✦ NEW: slim|regular|relaxed|oversized|tailored|cropped|unknown
  length            String?   // ✦ NEW: short|midi|long|cropped
  neckline          String?   // ✦ NEW: nullable
  material          String?   // ✦ NEW (replaces fabric field semantically; keep fabric for backward compat)
  texture           String?   // ✦ NEW: smooth|ribbed|woven|fuzzy|sheer|matte|glossy
  weight            String?   // ✦ NEW: lightweight|midweight|heavyweight|unknown

  // ✦ New: Weather/season suitability (LLM-estimated)
  suitableTempMinC  Int?      // ✦ NEW (°C)
  suitableTempMaxC  Int?      // ✦ NEW (°C)
  weatherTags       String[]  @default([])  // ✦ NEW: sunny|cloudy|light_rain|windy
  styleAesthetic    String[]  @default([])  // ✦ NEW: streetwear|minimalist|bohemian|preppy|...
  brand             String?   // ✦ NEW: OCR-extracted only

  // ✦ New: LLM audit trail
  parseConfidence   Float?    // ✦ NEW: 0.0–1.0
  parseModel        String?   // ✦ NEW: model that generated the metadata
  parseNotes        String?   // ✦ NEW (replaces stylistNote semantically)
  needsReview       Boolean   @default(false)  // ✦ NEW
  isActive          Boolean   @default(true)   // ✦ NEW: soft delete
}
```

**SQL equivalent (for Supabase RPC compatibility):**

```sql
-- Run after Prisma migration to add composite indexes for curation queries
CREATE INDEX idx_wardrobe_items_user_active
  ON "WardrobeItem"("userId", "isActive");
CREATE INDEX idx_wardrobe_items_category
  ON "WardrobeItem"("userId", category, "isActive");
CREATE INDEX idx_wardrobe_items_temp_range
  ON "WardrobeItem"("userId", "suitableTempMinC", "suitableTempMaxC")
  WHERE "isActive" = TRUE;
CREATE INDEX idx_wardrobe_items_season
  ON "WardrobeItem" USING GIN("seasonTags");  -- use existing season[] field
CREATE INDEX idx_wardrobe_items_weather
  ON "WardrobeItem" USING GIN("weatherTags");
```

```sql
CREATE TABLE outfits (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Storage
  image_url           TEXT NOT NULL,
  image_width         SMALLINT,
  image_height        SMALLINT,
  image_size_bytes    INT,
  image_format        TEXT NOT NULL DEFAULT 'webp',

  -- Core classification
  category            TEXT NOT NULL,
  -- top | bottom | outerwear | footwear | accessory | full_outfit
  subcategory         TEXT,
  -- t-shirt | jeans | sneakers | scarf | blazer | dress | shorts | etc.

  -- Color
  primary_color_name  TEXT NOT NULL,       -- "dusty rose", "forest green", "off-white"
  primary_color_hex   CHAR(7) NOT NULL,    -- "#7D9B76" (LLM-estimated; show "~" in UI)
  secondary_color_name TEXT,
  secondary_color_hex  CHAR(7),
  color_pattern       TEXT,
  -- solid | striped | plaid | floral | graphic | animal_print | tie_dye | colorblock | other

  -- Fit & form
  fit_type            TEXT,               -- slim | regular | relaxed | oversized | tailored | cropped
  length              TEXT,               -- cropped | short | midi | maxi | full
  neckline            TEXT,               -- crew | v-neck | collared | turtleneck | off-shoulder

  -- Fabric & texture
  material            TEXT,               -- cotton | denim | wool | silk | linen | leather | knit | synthetic
  texture             TEXT,               -- smooth | ribbed | woven | fuzzy | sheer | matte | glossy
  weight              TEXT,               -- lightweight | midweight | heavyweight

  -- Occasion & formality
  formality           TEXT NOT NULL,
  -- casual | smart_casual | business_casual | formal | athletic | loungewear
  occasions           TEXT[],
  -- work | date_night | weekend | gym | beach | party | outdoor

  -- Weather suitability (LLM-estimated)
  suitable_temp_min_c SMALLINT,
  suitable_temp_max_c SMALLINT,
  weather_tags        TEXT[],             -- sunny | cloudy | light_rain | windy | snow
  season_tags         TEXT[],             -- spring | summer | autumn | winter | all_season

  -- Styling
  style_aesthetic     TEXT[],
  -- streetwear | minimalist | bohemian | preppy | workwear | athleisure | classic
  brand               TEXT,              -- OCR-extracted only, null if not visible

  -- LLM audit
  parse_confidence    REAL,
  parse_model         TEXT NOT NULL,
  parse_notes         TEXT,
  needs_review        BOOLEAN NOT NULL DEFAULT FALSE,

  -- Soft delete
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outfits_user_active    ON outfits(user_id, is_active);
CREATE INDEX idx_outfits_category       ON outfits(user_id, category, is_active);
CREATE INDEX idx_outfits_temp_range     ON outfits(user_id, suitable_temp_min_c, suitable_temp_max_c) WHERE is_active = TRUE;
CREATE INDEX idx_outfits_season         ON outfits USING GIN(season_tags);
CREATE INDEX idx_outfits_weather        ON outfits USING GIN(weather_tags);
CREATE INDEX idx_outfits_created        ON outfits(user_id, created_at DESC) WHERE is_active = TRUE;
```

### 7.2 `daily_curations` Table

```sql
CREATE TABLE daily_curations (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Timezone-aware date key (NOT UTC date)
  local_date           DATE NOT NULL,           -- user's local calendar date, e.g. 2026-03-17
  user_timezone        TEXT NOT NULL,           -- IANA, e.g. "Asia/Kolkata"

  -- Weather snapshot (cached to avoid re-fetching on regen)
  weather_temp_c       REAL NOT NULL,
  weather_feels_like_c REAL,
  weather_condition    TEXT NOT NULL,
  weather_humidity_pct SMALLINT,
  weather_wind_kph     REAL,
  weather_location     TEXT NOT NULL,           -- city name

  -- The 3 outfit slots
  -- Each: { outfit_ids: string[], rationale: string, styling_tip: string,
  --         occasion_tags: string[], vibe: string }
  slot_1               JSONB NOT NULL,
  slot_2               JSONB NOT NULL,
  slot_3               JSONB NOT NULL,

  -- Regeneration tracking
  regen_count          SMALLINT NOT NULL DEFAULT 0,
  regen_slot           SMALLINT,               -- last regenerated slot (1, 2, or 3)
  regen_at             TIMESTAMPTZ,

  -- Audit
  pipeline_version     TEXT,
  model_used           TEXT,
  query_tier_used      SMALLINT,               -- 1 (filtered) or 2 (top 10 fallback)
  total_candidates     SMALLINT,
  latency_ms           INT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, local_date, user_timezone)
);

CREATE INDEX idx_curations_lookup ON daily_curations(user_id, local_date DESC, user_timezone);
```

### 7.3 `User` Model Additions

Add to existing `User` Prisma model:

```prisma
model User {
  // ... existing fields (id, email, name, avatar, passwordHash, provider,
  //     googleId, styleProfiles, styleIssues, onboarded, createdAt, updatedAt) ...

  // ✦ New: Plan tracking (denormalized from Subscription for fast free-tier check)
  plan              String    @default("free")  // "free" | "pro"
  wardrobeItemCount Int       @default(0)       // maintained by trigger, avoids COUNT()

  // ✦ New: Location & timezone (for weather-aware curation)
  timezone          String?   // IANA e.g. "Asia/Kolkata"; NULL = use browser
  locationLat       Float?
  locationLon       Float?
  locationCity      String?
}
```

```sql
-- Prisma migration equivalent
ALTER TABLE "User" ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "User" ADD COLUMN "wardrobeItemCount" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN timezone TEXT;
ALTER TABLE "User" ADD COLUMN "locationLat" REAL;
ALTER TABLE "User" ADD COLUMN "locationLon" REAL;
ALTER TABLE "User" ADD COLUMN "locationCity" TEXT;
```

### 7.4 Free Tier Enforcement Trigger

> **Repo note:** The free-tier limit is 10 wardrobe items (not "outfits"). Uses `WardrobeItem` table (`"WardrobeItem"` in quoted Postgres identifier).

```sql
CREATE OR REPLACE FUNCTION enforce_wardrobe_item_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan  TEXT;
  v_count INT;
BEGIN
  SELECT plan INTO v_plan FROM "User" WHERE id = NEW."userId";

  IF v_plan = 'free' THEN
    SELECT COUNT(*) INTO v_count
    FROM "WardrobeItem"
    WHERE "userId" = NEW."userId" AND "isActive" = TRUE;

    IF v_count >= 10 THEN
      RAISE EXCEPTION 'wardrobe_limit_reached'
        USING HINT = 'Upgrade to Pro for unlimited wardrobe items';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_wardrobe_item_limit
  BEFORE INSERT ON "WardrobeItem"
  FOR EACH ROW EXECUTE FUNCTION enforce_wardrobe_item_limit();
```

### 7.5 `get_wardrobe_candidates` RPC Function

> **Repo note:** Renamed from `get_outfit_candidates` to `get_wardrobe_candidates` to avoid confusion with the existing `Outfit` Prisma model (which represents an ensemble, not a single piece). Uses `"WardrobeItem"` table.

```sql
-- 2-tier fallback: Tier 1 = weather/season filter; Tier 2 = top 10 most recent
CREATE OR REPLACE FUNCTION get_wardrobe_candidates(
  p_user_id   TEXT,        -- Snowflake ID as TEXT (Prisma stores as String @id)
  p_temp_c    REAL,
  p_condition TEXT,
  p_season    TEXT,
  p_exclude   TEXT[] DEFAULT '{}',
  p_tier      INT DEFAULT 1
)
RETURNS TABLE (
  id                   TEXT,
  category             TEXT,
  subcategory          TEXT,
  primary_color_name   TEXT,
  primary_color_hex    TEXT,
  secondary_color_name TEXT,
  color_pattern        TEXT,
  fit_type             TEXT,
  material             TEXT,
  weight               TEXT,
  formality            TEXT,
  occasions            TEXT[],
  suitable_temp_min_c  INT,
  suitable_temp_max_c  INT,
  weather_tags         TEXT[],
  season_tags          TEXT[],
  style_aesthetic      TEXT[],
  parse_notes          TEXT,
  image_url            TEXT,
  created_at           TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_tier = 1 THEN
    RETURN QUERY
      SELECT
        wi.id,
        wi.category, wi."subcategory",
        wi."primaryColorName", wi."primaryColorHex", wi."secondaryColorName",
        wi."colorPattern", wi."fitType", wi.material, wi.weight,
        wi.formality::TEXT, wi.occasion,
        wi."suitableTempMinC", wi."suitableTempMaxC",
        wi."weatherTags", wi.season, wi."styleAesthetic",
        wi."parseNotes", wi."imageUrl", wi."createdAt"
      FROM "WardrobeItem" wi
      WHERE wi."userId" = p_user_id
        AND wi."isActive" = TRUE
        AND wi.id != ALL(p_exclude)
        AND wi."suitableTempMinC" <= p_temp_c
        AND wi."suitableTempMaxC" >= p_temp_c
        AND p_season = ANY(wi.season)
        AND p_condition = ANY(wi."weatherTags")
      ORDER BY wi."createdAt" DESC
      LIMIT 20;
  ELSE
    RETURN QUERY
      SELECT
        wi.id,
        wi.category, wi."subcategory",
        wi."primaryColorName", wi."primaryColorHex", wi."secondaryColorName",
        wi."colorPattern", wi."fitType", wi.material, wi.weight,
        wi.formality::TEXT, wi.occasion,
        wi."suitableTempMinC", wi."suitableTempMaxC",
        wi."weatherTags", wi.season, wi."styleAesthetic",
        wi."parseNotes", wi."imageUrl", wi."createdAt"
      FROM "WardrobeItem" wi
      WHERE wi."userId" = p_user_id
        AND wi."isActive" = TRUE
        AND wi.id != ALL(p_exclude)
      ORDER BY wi."createdAt" DESC
      LIMIT 10;
  END IF;
END;
$$;
```

---

## 8. Workflow 1 — Wardrobe Item Ingestion Pipeline

> **Repo note:** The doc's "outfit ingestion pipeline" is renamed here to "wardrobe item ingestion pipeline". The existing flow uses two separate endpoints (`POST /api/upload/image` for storage, then `POST /api/wardrobe` for classification + DB insert). The new LangGraph `IngestionGraph` runs inside an updated `POST /api/wardrobe` handler, replacing the currently-missing `/api/classify-clothing` call.

### Current Flow (being replaced)

```
Browser → POST /api/upload/image (Sharp-free, stores original)
        → POST /api/classify-clothing (MISSING — route doesn't exist)
        → POST /api/wardrobe (creates WardrobeItem with whatever data exists)
```

### New Flow

```
Browser sends base64 image + metadata → POST /api/wardrobe (updated)
  1. Sharp → WebP Q80, max 1200px, strip EXIF (NEW — server-side)
  2. Upload to Supabase Storage → get publicUrl
  3. IngestionGraph.invoke({ imageUrl, userId }) → enhanced WardrobeItem metadata
  4. prisma.wardrobeItem.create({ enriched metadata })
  5. Return { wardrobeItemId, metadata }
```

Note: The existing `POST /api/upload/image` can remain for the browser preview upload (returns URL for display). The new `POST /api/wardrobe` does its own upload internally for the final WebP-converted version. Alternatively, upload can remain separate and the route handler receives the uploadedUrl.

### Flow Diagram

```
POST /api/wardrobe (multipart form: file + userId)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  NEXT.JS ROUTE HANDLER (synchronous)                        │
│                                                             │
│  1. Auth check (JWT from request header)                    │
│  2. Pre-check wardrobeItemCount < 10 (free tier, User.plan) │
│     → 403 immediately if at limit (fast fail before Sharp)  │
│  3. Validate MIME (jpeg | png | webp | heic accepted)       │
│  4. Sharp → WebP Q80, max 1200px, strip EXIF               │
│  5. Upload to Supabase Storage → get publicUrl             │
│  6. Run IngestionGraph.invoke({ imageUrl, userId })         │
│  7. prisma.wardrobeItem.create(enriched metadata)           │
│  8. Return { wardrobeItemId, metadata } or { error }        │
└──────────────────────┬──────────────────────────────────────┘
```

### File Locations in This Repo

```
backend/langgraph/
  ingestion/
    state.ts       — IngestionAnnotation (LangGraph state)
    nodes.ts       — validateImageNode, visionParseNode, enrichMetadataNode, persistItemNode
    graph.ts       — buildIngestionGraph()
  curation/
    state.ts       — CurationAnnotation
    nodes.ts       — fetchWeatherNode, interpretWeatherNode, queryWardrobeNode, curateOutfitsNode, validateOutfitsNode, persistCurationNode, hydrateSlots
    graph.ts       — buildCurationGraph()

lib/tools/
  vision.ts        — geminiVisionAnalyze()
  query.ts         — queryWardrobeCandidates()  [renamed from queryOutfitCandidates]
  weather.ts       — getWeatherTool()

lib/schemas/
  wardrobeItem.ts  — wardrobeItemMetadataSchema (renamed from outfitMetadataSchema)
  curation.ts      — weatherContextSchema, curatedSlotSchema, curationOutputSchema

lib/llm/
  parse.ts         — callGeminiWithSchema() wrapper
  provider.ts      — LLMProvider interface (future)

config/
  regen.ts         — RegenConfig + defaults
```

### LangGraph.js State (wardrobe item ingestion)

                       │
                       ▼ LangGraph.js IngestionGraph
              ┌────────────────────┐
              │  validate_image    │
              │  Confirm URL is    │
              │  reachable, <8MB   │
              └────────┬───────────┘
                       │
                       ▼
              ┌────────────────────┐
              │  vision_parse      │◄── Gemini Vision API
              │                    │    System: Fashion Analysis Expert
              │  responseSchema:   │    response_mime_type: "application/json"
              │  OutfitMetadata    │    + Zod schema enforcement after
              │  Schema            │
              └────────┬───────────┘
                       │
              ┌────────┴───────────┐
              │  confidence ≥ 0.6? │
              └──┬──────────────┬──┘
               YES              NO (up to 2 retries with hint)
               │                │
               ▼                ▼
     ┌─────────────────┐  ┌──────────────────┐
     │ enrich_metadata │  │ flag_for_review   │
     │                 │  │ needs_review=true │
     │ - Normalize     │  │ confidence=low    │
     │   color name    │  └────────┬──────────┘
     │ - Validate hex  │           │
     │ - Derive temp   │           │
     │   range from    │           │
     │   material if   │           │
     │   null          │           │
     └────────┬────────┘           │
              └──────────┬─────────┘
                         │
                         ▼
              ┌────────────────────┐
              │  persist_outfit    │◄── Supabase INSERT outfits
              │  + increment       │
              │  users.outfit_count│
              └────────┬───────────┘
                       │
                       ▼
              Return { outfitId, metadata }
              to Next.js route handler
              → JSON response to client

````

### LangGraph.js State (wardrobe item ingestion)

```typescript
// backend/langgraph/ingestion/state.ts
import { Annotation } from "@langchain/langgraph";

export const IngestionAnnotation = Annotation.Root({
  // Input
  imageUrl: Annotation<string>(),
  userId: Annotation<string>(),

  // Parse
  parseAttempts: Annotation<number>({ default: () => 0 }),
  rawParse: Annotation<WardrobeItemMetadata | null>({ default: () => null }),

  // Enriched
  enrichedMetadata: Annotation<WardrobeItemMetadata | null>({ default: () => null }),
  confidence: Annotation<number | null>({ default: () => null }),
  needsReview: Annotation<boolean>({ default: () => false }),

  // Output
  wardrobeItemId: Annotation<string | null>({ default: () => null }),  // was outfitId
  error: Annotation<string | null>({ default: () => null }),
  status: Annotation<"parsing" | "enriching" | "persisting" | "complete" | "failed">({
    default: () => "parsing",
  }),
});
````

### Graph Definition

```typescript
// backend/langgraph/ingestion/graph.ts
import { StateGraph, END } from "@langchain/langgraph";
import { IngestionAnnotation } from "./state";
import {
  validateImageNode,
  visionParseNode,
  enrichMetadataNode,
  persistItemNode,
} from "./nodes";

export function buildIngestionGraph() {
  const graph = new StateGraph(IngestionAnnotation)
    .addNode("validate_image", validateImageNode)
    .addNode("vision_parse", visionParseNode)
    .addNode("enrich_metadata", enrichMetadataNode)
    .addNode("persist_item", persistItemNode) // was persist_outfit
    .addEdge("__start__", "validate_image")
    .addEdge("validate_image", "vision_parse")
    .addConditionalEdges("vision_parse", (state) => {
      if (state.error) return "persist_item"; // store with needs_review=true on error
      if ((state.confidence ?? 0) < 0.6 && state.parseAttempts < 2)
        return "vision_parse"; // retry
      return "enrich_metadata";
    })
    .addEdge("enrich_metadata", "persist_item")
    .addEdge("persist_item", END);

  return graph.compile();
}
```

---

## 9. Workflow 2 — Daily Outfit Curation Pipeline

> **Repo note:** "Outfits" in curation slots = COMBINATIONS of `WardrobeItem` records by wardrobeItemId[]. The curation triggers on user visit to `/today` (not `/wardrobe`), which is the main page in this app. JSONB `outfit_ids` in `DailyCuration` slots refers to `WardrobeItem.id[]`.

### Flow Diagram

```
User navigates to /today page
       │
       ▼
Client: check IndexedDB cache (local_date + timezone)
  HIT  → render curation immediately ─────────────────────────► Done
  MISS → POST /api/curations/today { lat, lon, timezone }
                 │
                 ▼
         Check daily_curations (userId, local_date, timezone)
           HIT → return JSON, client stores to IndexedDB ─────► Done
           MISS → run CurationGraph
                         │
                         ▼
               ┌──────────────────────┐
               │  fetch_weather       │◄── getWeatherTool(lat, lon)
               │                      │    Open-Meteo + Nominatim
               └────────┬─────────────┘
                        │
                        ▼
               ┌──────────────────────┐
               │  interpret_weather   │◄── Gemini LLM
               │                      │    System: Weather Interpreter
               │  Input: raw weather  │    Output: season_context,
               │  Output: dressing    │    dressing_temp_band,
               │  context             │    layering_needed,
               │                      │    rain_protection_needed
               └────────┬─────────────┘
                        │
                        ▼
               ┌──────────────────────────────────────────────┐
               │  query_wardrobe                              │
               │                                              │
               │  Tier 1: get_outfit_candidates(              │
               │    temp, condition, season, tier=1)          │
               │    → ≥ 3 items? proceed                     │
               │    → 0 items? → Tier 2                      │
               │                                              │
               │  Tier 2: get_outfit_candidates(tier=2)       │
               │    → top 10 most recent, no filter           │
               │    → always returns data if wardrobe exists  │
               │                                              │
               │  Pass candidates + weather context to LLM   │
               └────────┬─────────────────────────────────────┘
                        │
                        ▼
               ┌──────────────────────┐
               │  curate_outfits      │◄── Gemini LLM
               │                      │    System: Senior Stylist
               │  Input: weather ctx  │    Input: candidate pool
               │  + candidates        │    (metadata only, no images)
               │  Output: 3 slots     │    Output: 3 outfit combos
               └────────┬─────────────┘
                        │
                        ▼
               ┌──────────────────────────────────────────────┐
               │  validate_outfits                            │
               │                                              │
               │  Checks:                                     │
               │  - All outfit_ids exist in candidate pool?   │
               │  - 3 distinct combos (no cross-slot dupes)?  │
               │  - No two outerwear in one slot?             │
               │  - No two bottoms in one slot?               │
               │  - ≤ 2 accessories per slot?                 │
               │                                              │
               │  FAIL → retry curate (max 2x)               │
               │  PASS → proceed                              │
               └────────┬─────────────────────────────────────┘
                        │
                        ▼
               ┌──────────────────────┐
               │  persist_curation    │◄── Supabase UPSERT daily_curations
               └────────┬─────────────┘
                        │
                        ▼
               ┌──────────────────────┐
               │  hydrate_slots       │
               │  Fetch full outfit   │
               │  records for all IDs │
               │  (image_url etc.)    │
               └────────┬─────────────┘
                        │
                        ▼
               Return JSON to Next.js route handler
               → Store in IndexedDB → render
```

### LangGraph.js State

```typescript
// backend/langgraph/curation/state.ts  (was lib/graphs/curation/state.ts in doc)
import { Annotation } from "@langchain/langgraph";
import type { WeatherOutput } from "@/lib/tools/weather";
import type { RegenConfig } from "@/config/regen";

export const CurationAnnotation = Annotation.Root({
  // Input
  userId: Annotation<string>(),
  userLat: Annotation<number>(),
  userLon: Annotation<number>(),
  userTimezone: Annotation<string>(), // IANA
  localDate: Annotation<string>(), // "YYYY-MM-DD"

  // Regen-only inputs (null for fresh curation)
  regenerateSlot: Annotation<1 | 2 | 3 | null>({ default: () => null }),
  excludeOutfitIds: Annotation<string[]>({ default: () => [] }),
  regenConfig: Annotation<RegenConfig | null>({ default: () => null }),

  // Weather
  weatherRaw: Annotation<WeatherOutput | null>({ default: () => null }),
  weatherContext: Annotation<WeatherContext | null>({ default: () => null }),

  // Query
  candidateItems: Annotation<WardrobeCandidate[]>({ default: () => [] }), // was candidateOutfits
  queryTierUsed: Annotation<1 | 2>({ default: () => 1 }),

  // Curation
  curatedSlots: Annotation<CuratedSlot[] | null>({ default: () => null }),
  validationAttempts: Annotation<number>({ default: () => 0 }),

  // Output
  curationId: Annotation<string | null>({ default: () => null }),
  hydratedSlots: Annotation<HydratedSlot[] | null>({ default: () => null }),
  error: Annotation<string | null>({ default: () => null }),
  latencyMs: Annotation<number | null>({ default: () => null }),
});
```

---

## 10. Tool Definitions (TypeScript)

### 10.1 `geminiVisionAnalyze`

````typescript
// lib/tools/vision.ts  (same path as in doc — correct)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { wardrobeItemMetadataSchema, type WardrobeItemMetadata } from "@/lib/schemas/wardrobeItem";
// was: import { outfitMetadataSchema, type OutfitMetadata } from "@/lib/schemas/outfit";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function geminiVisionAnalyze(
  imageUrl: string,
  retryHint = ""
): Promise<{ data: WardrobeItemMetadata; raw: string }> {  // was OutfitMetadata
  const model = genAI.getGenerativeModel({
    model: process.env.OUTFIT_LLM_MODEL ?? "gemini-2.5-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
      // response_schema forces structured output — eliminates markdown fence bug
  const geminiSchema = GEMINI_WARDROBE_ITEM_SCHEMA; // was GEMINI_OUTFIT_SCHEMA
    },
  });

  const imageResponse = await fetch(imageUrl);
  const imageArrayBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageArrayBuffer).toString("base64");

  const prompt = [
    FASHION_ANALYST_SYSTEM_PROMPT,
    retryHint ? `\n\nHINT FOR THIS RETRY: ${retryHint}` : "",
    "\n\nAnalyze the clothing item in this image and respond with structured JSON.",
  ].join("");

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType: "image/webp", data: imageBase64 } },
  ]);

  const rawText = result.response.text();

  // Defense in depth: strip markdown fences if present despite response_mime_type
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

  // Validate against Zod schema
  const parsed = wardrobeItemMetadataSchema.safeParse(JSON.parse(cleaned));  // was outfitMetadataSchema
  if (!parsed.success) {
    throw new Error(`Schema validation failed: ${parsed.error.message}`);
  }

  return { data: parsed.data, raw: rawText };
}
````

### 10.2 `queryWardrobeCandidates`

> **Repo note:** Renamed from `queryOutfitCandidates` to avoid confusion with the `Outfit` Prisma model. Uses `get_wardrobe_candidates` RPC (see §7.5).

```typescript
// lib/tools/query.ts
import { supabaseAdmin } from "@/backend/database/supabase";

export async function queryWardrobeCandidates(params: {
  userId: string; // Snowflake ID as string (Prisma @id String)
  tempC: number;
  condition: string;
  season: string;
  excludeIds?: string[];
}): Promise<{ items: WardrobeCandidate[]; tierUsed: 1 | 2 }> {
  const excludeIdsArray = params.excludeIds ?? [];

  // Tier 1: filtered
  const { data: tier1, error: err1 } = await supabaseAdmin.rpc(
    "get_wardrobe_candidates",
    {
      p_user_id: params.userId, // String — no BigInt needed (Prisma stores as String @id)
      p_temp_c: params.tempC,
      p_condition: params.condition,
      p_season: params.season,
      p_exclude: excludeIdsArray,
      p_tier: 1,
    },
  );

  if (!err1 && tier1 && tier1.length >= 3) {
    return { items: tier1 as WardrobeCandidate[], tierUsed: 1 };
  }

  // Tier 2: top 10 recent, no filter
  const { data: tier2, error: err2 } = await supabaseAdmin.rpc(
    "get_wardrobe_candidates",
    {
      p_user_id: params.userId,
      p_temp_c: params.tempC,
      p_condition: params.condition,
      p_season: params.season,
      p_exclude: excludeIdsArray,
      p_tier: 2,
    },
  );

  if (err2) throw new Error(`Query failed: ${err2.message}`);
  return { items: (tier2 ?? []) as WardrobeCandidate[], tierUsed: 2 };
}
```

**Note on IDs:** This repo uses Snowflake IDs stored as `String` in Prisma (`@id`). Unlike the original doc which assumed numeric BIGINT, there is no BigInt precision issue here — IDs are already strings throughout. The `BigInt()` call in the original doc's `queryOutfitCandidates` is not needed.

---

## 11. LLM Skill Prompts

### 11.1 Fashion Analysis Expert (Ingestion)

```
You are an expert fashion analyst and professional stylist with 15 years of experience
in retail fashion, personal styling, and wardrobe curation.

Analyze the clothing item image and extract precise structured metadata. Rules:

COLOR ACCURACY — this is critical:
- Use precise descriptors: "dusty rose" not "pink", "forest green" not "green",
  "slate grey" not "grey", "ecru" not "white", "cobalt blue" not "blue"
- Hex values: estimate the dominant midtone (not highlights or shadows)
  Navy blazer ≈ #1B2A4A not #000080 | Ivory shirt ≈ #F5F0E8 not #FFFFFF
- If you cannot confidently identify a secondary color, return null

TEMPERATURE RANGE (°C) — realistic comfortable wearing range:
- Linen shirt: 20 to 38 | Wool overcoat: -5 to 12 | Light denim jacket: 12 to 22
- A cotton t-shirt: 18 to 35 | Fleece hoodie: 8 to 20 | Down jacket: -15 to 5
- Consider that items are often layered; be generous with the upper bound

BRAND: Only include if a logo text is clearly and fully readable. Never guess.

CONFIDENCE: Set below 0.6 if the image is blurry, heavily shadowed, cropped,
or the item category is genuinely ambiguous. Explain in parse_notes.

Output must be valid JSON matching the provided schema exactly.
```

### 11.2 Weather Interpreter (Curation)

```
You are a fashion stylist. Translate raw weather data into a practical dressing
context. Be specific and actionable — this guides outfit selection for real people.

Consider:
- feels_like_c matters more than temp_c (wind chill, humidity)
- Seasonal framing: 15°C in March (end of winter) dresses differently than October
- Layering: changeable weather, morning-to-evening transitions
- Rain: if condition includes rain or thunderstorm, rain_protection_needed = true

Output JSON only. No prose, no explanation outside the JSON fields.
```

### 11.3 Senior Personal Stylist (Curation)

```
You are a senior personal stylist specializing in everyday weather-appropriate dressing,
color theory, and practical wardrobe curation.

Select 3 DISTINCT outfit combinations from the candidate items below.
Each combination must be:
- Weather-appropriate (comfort first, aesthetics second)
- Internally coherent (color harmony + formality match + aesthetic unity)
- Different from the other two in vibe and/or occasion

HARD RULES (violation causes rejection and retry):
- Each item ID may appear in at most ONE slot
- A single-item slot is only valid for category: full_outfit
- No two "bottom" category items in one slot
- No two "outerwear" category items in one slot
- Maximum 2 "accessory" category items per slot
- All outfit_ids MUST come from the provided candidate list

STYLING PRINCIPLES:
1. If raining or condition requires protection: prioritize waterproof/resistant items
2. Color harmony: analogous, complementary, or intentional neutral + pop combos
3. Formality: casual + formal = only if deliberate smart-casual contrast
4. Sparse wardrobe (< 6 items): work with what exists; note the gap in styling_tip

For each slot output exactly:
{
  "outfit_ids": ["id1", "id2"],
  "rationale": "2-3 sentences explaining why these items work together and suit the weather",
  "styling_tip": "One specific, actionable tip (tuck, cuff, layer order, etc.)",
  "occasion_tags": ["work", "casual"],
  "vibe": "Relaxed | Polished | Sporty | Cosy | Fresh | Bold | Understated"
}
```

### 11.4 Regeneration Addendum (Appended to §11.3 System Prompt)

```typescript
// Built dynamically in the curate_outfits node when regenerateSlot !== null

function buildRegenAddendum(
  slot: 1 | 2 | 3,
  otherSlots: CuratedSlot[],
  config: RegenConfig,
  oldSlotIds: string[],
): string {
  const otherVibes = otherSlots.map((s) => s.vibe).join(" and ");

  const lines = [
    `\nYou are regenerating slot ${slot} only.`,
    config.enforceDistinctVibe
      ? `The other slots have vibes: ${otherVibes}. Choose a DIFFERENT vibe.`
      : "",
    !config.allowPartialSlotOverlap
      ? `The new slot must NOT include any of these item IDs: [${oldSlotIds.join(", ")}]`
      : config.minItemsChanged > 0
        ? `At least ${config.minItemsChanged} item(s) must differ from the old slot: [${oldSlotIds.join(", ")}]`
        : "",
  ];

  return lines.filter(Boolean).join("\n");
}
```

---

## 12. Zod Schemas

> **Repo note:** `outfitMetadataSchema` is renamed to `wardrobeItemMetadataSchema` and stored at `lib/schemas/wardrobeItem.ts`. The schema aligns with the updated `WardrobeItem` Prisma model fields.

All structured LLM output is validated against Zod schemas. No data ever enters the database without passing validation.

```typescript
// lib/schemas/wardrobeItem.ts  (was outfitMetadataSchema in doc)
import { z } from "zod";

export const wardrobeItemMetadataSchema = z.object({
  // was outfitMetadataSchema
  category: z.enum([
    "top",
    "bottom",
    "outerwear",
    "footwear",
    "accessory",
    "full_outfit",
  ]),
  subcategory: z.string().min(1),
  primary_color_name: z.string().min(1),
  primary_color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondary_color_name: z.string().nullable(),
  secondary_color_hex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(),
  color_pattern: z.enum([
    "solid",
    "striped",
    "plaid",
    "floral",
    "graphic",
    "animal_print",
    "tie_dye",
    "colorblock",
    "other",
  ]),
  fit_type: z.enum([
    "slim",
    "regular",
    "relaxed",
    "oversized",
    "tailored",
    "cropped",
    "unknown",
  ]),
  length: z.string(),
  neckline: z.string().nullable(),
  material: z.string().min(1),
  texture: z.string(),
  weight: z.enum(["lightweight", "midweight", "heavyweight", "unknown"]),
  formality: z.enum([
    "casual",
    "smart_casual",
    "business_casual",
    "formal",
    "athletic",
    "loungewear",
  ]),
  occasions: z.array(z.string()),
  suitable_temp_min_c: z.number().int().min(-30).max(50),
  suitable_temp_max_c: z.number().int().min(-30).max(50),
  weather_tags: z.array(z.string()),
  season_tags: z.array(
    z.enum(["spring", "summer", "autumn", "winter", "all_season"]),
  ),
  style_aesthetic: z.array(z.string()),
  brand: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  parse_notes: z.string().nullable(),
});

export type WardrobeItemMetadata = z.infer<typeof wardrobeItemMetadataSchema>; // was OutfitMetadata

// ─────────────────────────────────

export const weatherContextSchema = z.object({
  season_context: z.enum([
    "early_spring",
    "late_spring",
    "peak_summer",
    "late_summer",
    "early_autumn",
    "late_autumn",
    "winter",
    "transitional",
  ]),
  dressing_temp_band: z.enum([
    "very_hot",
    "hot",
    "warm",
    "mild",
    "cool",
    "cold",
    "very_cold",
  ]),
  target_temp_c: z.number(),
  layering_needed: z.boolean(),
  rain_protection_needed: z.boolean(),
  weather_notes: z.string(),
  formality_suggestion: z.enum([
    "none",
    "lean_casual",
    "lean_smart_casual",
    "context_dependent",
  ]),
});

export type WeatherContext = z.infer<typeof weatherContextSchema>;

// ─────────────────────────────────

export const curatedSlotSchema = z.object({
  outfit_ids: z.array(z.string()).min(1).max(4),
  rationale: z.string().min(20),
  styling_tip: z.string().min(10),
  occasion_tags: z.array(z.string()),
  vibe: z.enum([
    "Relaxed",
    "Polished",
    "Sporty",
    "Cosy",
    "Fresh",
    "Bold",
    "Understated",
  ]),
});

export const curationOutputSchema = z.object({
  slots: z.array(curatedSlotSchema).length(3),
});

export type CuratedSlot = z.infer<typeof curatedSlotSchema>;
```

---

## 13. Rate Limiting & Quota Management

| Resource              | Free Tier                                     | Enforcement Layer                                                  |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| Outfit uploads        | 10 total                                      | DB trigger `check_outfit_limit` (cannot bypass via API)            |
| Daily curations       | 1 per local calendar day                      | DB UNIQUE constraint + IndexedDB cache                             |
| Regenerations         | `REGEN_CONFIG.freeRegenPerDay` (default: 1)   | `regen_count` column, checked in route handler                     |
| Weather API calls     | 1 per user per local day                      | Stored in `daily_curations.weather_*` on curation; reused on regen |
| Gemini Vision calls   | ~2 per upload (1 parse + 1 retry max)         | Route handler rate-limits per user_id                              |
| Gemini curation calls | ~3 per day (interpret + curate + max 1 retry) | Once-per-day DB cache eliminates repeat calls                      |

**Weather reuse on regeneration:** When regenerating a single slot, the weather data from `daily_curations` is reused directly — no second weather API call.

---

## 14. BigInt / Snowflake ID Handling

> **Repo note:** This repo stores Snowflake IDs as `String` in Prisma (`id String @id`), not as `BIGINT` in the DB (though the underlying Postgres column may be BIGINT — Prisma reads and writes it as text via the String type). This means:
>
> - **No browser JSON precision issue** — IDs are always strings, never numeric
> - **No need for `BigInt()` casts** in RPC calls — pass string IDs directly
> - **No `id::TEXT` overrides needed** in generated types — they're already strings

The BigInt considerations in this section apply **only** if you ever change the schema to use numeric IDs or if using the raw Supabase admin client (not Prisma). For this repo, IDs are safe everywhere as strings.

| Context                  | Rule                                                                     |
| ------------------------ | ------------------------------------------------------------------------ |
| Prisma queries           | `id` is `String` — safe natively                                         |
| Supabase RPC `p_user_id` | Pass as `string` — RPC accepts `TEXT`                                    |
| React state / URL params | Always `string` — never convert to number                                |
| TypeScript types         | `id: string; userId: string` — already correct in Prisma-generated types |

---

## 15. Error Handling & Retry Strategy

### Ingestion Pipeline

| Failure                           | Retry                                    | Fallback                                             |
| --------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Sharp processing fails            | 0×                                       | Return 400 with message; do not upload               |
| Supabase Storage upload fails     | 3× exponential backoff (500ms → 1s → 2s) | Return 500; do not create DB record                  |
| Gemini Vision 429 (rate limit)    | 2× with 2s jitter                        | Return 503; do not insert partial record             |
| Gemini Vision timeout (>10s)      | 1×                                       | Mark `needs_review=true`, insert with low confidence |
| Zod schema validation fails       | 2× with hint prompt in retry             | Insert with `needs_review=true`, `confidence=0`      |
| Supabase INSERT fails             | 1×                                       | Delete uploaded image; return 500                    |
| DB trigger `outfit_limit_reached` | 0×                                       | Return 403 "Upgrade to Pro"                          |

**On any unrecoverable error:** Delete the uploaded WebP from Supabase Storage before responding to the client. Do not leave orphaned files.

### Curation Pipeline

| Failure                            | Retry                                    | Fallback                                                                      |
| ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Open-Meteo API fails               | 2× (1s backoff)                          | Use `users.location_city` + prompt the LLM with city name, no numeric weather |
| Nominatim fails (rate limit)       | Backoff 1.5s                             | Use "your area" as city name in UI                                            |
| Tier 1 query returns 0 items       | Auto-escalate → Tier 2                   | Tier 2 always returns data if wardrobe non-empty                              |
| Both tiers return 0 items          | 0×                                       | Return "no outfits yet" response — user needs to upload first                 |
| LLM returns invalid outfit IDs     | 2× re-prompt                             | On 3rd failure, return Tier 2 items in random order with generic rationale    |
| Zod validation on LLM output fails | 2× retry with validation error in prompt | Same as above                                                                 |
| `daily_curations` upsert fails     | 2×                                       | Return result to client anyway; log failure; next visit regenerates           |

### Gemini Flash-Lite Defense

````typescript
// lib/llm/parse.ts — always use this wrapper, never call Gemini directly

export async function callGeminiWithSchema<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  geminiSchema: Schema, // Gemini's native schema type for response_schema
  imageBase64?: string,
): Promise<T> {
  const model = genAI.getGenerativeModel({
    model: process.env.OUTFIT_LLM_MODEL ?? "gemini-2.5-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: geminiSchema, // Eliminates markdown fence bug
    },
  });

  const parts = imageBase64
    ? [prompt, { inlineData: { mimeType: "image/webp", data: imageBase64 } }]
    : [prompt];

  const result = await model.generateContent(parts);
  const text = result.response.text();

  // Strip fences as fallback defense
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = schema.safeParse(JSON.parse(cleaned));
  if (!parsed.success)
    throw new Error(`Schema mismatch: ${parsed.error.message}`);

  return parsed.data;
}
````

---

## 16. Future Expansion Notes

### Model Expansion

```typescript
// lib/llm/provider.ts — all LLM calls go through this interface
interface LLMProvider {
  analyzeImage(imageBase64: string, prompt: string): Promise<string>;
  generateText(prompt: string): Promise<string>;
}

class GeminiProvider implements LLMProvider { ... }
class OpenAIProvider implements LLMProvider { ... }   // future
class AnthropicProvider implements LLMProvider { ... } // future

// Injected via: OUTFIT_LLM_MODEL=gemini-2.5-flash-lite
```

### Pro Tier Roadmap

| Feature            | Implementation                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Unlimited uploads  | Remove `enforce_outfit_limit` trigger condition for pro users                                                      |
| More daily regens  | Increase `REGEN_CONFIG.freeRegenPerDay` or add per-user override                                                   |
| Week planner       | New `CurationGraph` variant: 7-day forecast + 7 curation runs batched                                              |
| Outfit history     | `outfit_history` table: `{ user_id, worn_date, slot_snapshot }`                                                    |
| Style feedback     | 👍/👎 signals stored in `outfit_feedback` → injected into curation prompt                                          |
| Travel mode        | Temporary `location_override` with expiry in `users` table                                                         |
| MCP weather server | Swap `getWeatherTool` for `MultiServerMCPClient` + `isdaniel/mcp_weather_server` when multi-agent scenarios emerge |

### Timezone Edge Cases to Test

| Case                                                | Expected Behavior                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| User at local midnight (e.g., 23:59 → 00:00)        | New `local_date` key, fresh curation on next request                                       |
| User travelling (timezone changes mid-day)          | Browser sends new timezone; treated as a different key — may trigger regen but not harmful |
| UTC+14 (Line Islands) — world's most ahead timezone | `getUserLocalDate` uses `Intl.DateTimeFormat` — handles natively                           |
| DST transitions                                     | `Intl.DateTimeFormat` handles DST automatically; no manual offset calculations needed      |
| Incognito browser                                   | IndexedDB unavailable; falls back to DB cache gracefully                                   |

---

_Document v3.0 — Final. All decisions are made. Build in this order: (1) image upload + Sharp pipeline, (2) Gemini vision node in isolation, (3) full IngestionGraph, (4) weather tool, (5) Supabase RPC function, (6) CurationGraph, (7) regen endpoint._
