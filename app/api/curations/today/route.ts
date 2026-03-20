/**
 * POST /api/curations/today
 *
 * Returns 3 AI-curated outfit slots for the authenticated user based on
 * today's weather in their local timezone.
 *
 * Request body:
 * {
 *   lat:             number   — user's latitude
 *   lon:             number   — user's longitude
 *   timezone:        string   — IANA timezone e.g. "Asia/Kolkata"
 *   regenerateSlot?: 1|2|3   — optional: re-run only this slot
 * }
 *
 * Response:
 * {
 *   slots:           HydratedSlot[3]
 *   cached:          boolean         — true if returned from DB cache
 *   curationId:      string | null
 *   weatherContext:  WeatherContext | null
 *   weatherAvailable: boolean        — true if real weather was fetched; false if using fallback
 * }
 *
 * Cache strategy (three layers):
 *   1. IndexedDB  — browser caches on the client side (see lib/curation/cache.ts)
 *   2. DB cache   — DailyCuration row keyed on (userId, localDate, userTimezone)
 *   3. LangGraph  — runs only on DB miss; takes ~4–6 s
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/backend/database/auth-middleware";
import {
  errorResponse,
  successResponse,
} from "@/backend/database/api-response";
import prisma from "@/backend/database/prisma";
import { getUserLocalDate } from "@/lib/timezone";
import { buildCurationGraph } from "@/backend/langgraph/curation/graph";
import {
  getMaxRegenForPlan,
  REGEN_CONFIG,
} from "@/backend/langgraph/shared/regen";
import type {
  HydratedSlot,
  WeatherContext,
  CuratedSlot,
} from "@/backend/langgraph/shared/types";

export const maxDuration = 60; // seconds — Vercel Pro / self-hosted

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  console.log(`[TODAY] Generation started: userId extracted from bearer token`);

  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    console.log(`[TODAY] Auth validated: ${userId}`);

    // ── Parse and validate body ─────────────────────────────────────────
    const body = await request.json();
    const { lat, lon, timezone, regenerateSlot } = body as {
      lat: number;
      lon: number;
      timezone: string;
      regenerateSlot?: 1 | 2 | 3;
    };
    console.log(`[TODAY] Body parsed: timezone=${timezone}, regen=${regenerateSlot}`);

    if (typeof lat !== "number" || typeof lon !== "number" || !timezone) {
      console.warn(`[TODAY] ❌ Missing required fields`);
      return errorResponse("Missing required fields: lat, lon, timezone", 400);
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.warn(`[TODAY] ❌ Invalid coordinates: lat=${lat}, lon=${lon}`);
      return errorResponse("Invalid coordinates", 400);
    }
    if (regenerateSlot !== undefined && ![1, 2, 3].includes(regenerateSlot)) {
      console.warn(`[TODAY] ❌ Invalid regenerateSlot: ${regenerateSlot}`);
      return errorResponse("regenerateSlot must be 1, 2, or 3", 400);
    }

    const localDate = getUserLocalDate(timezone);
    console.log(`[TODAY] Local date calculated: ${localDate}`);

    // ── Check DB cache ──────────────────────────────────────────────────
    console.log(`[TODAY] Checking DB cache...`);
    const cached = await prisma.dailyCuration.findUnique({
      where: {
        userId_localDate_userTimezone: {
          userId: BigInt(userId),
          localDate,
          userTimezone: timezone,
        },
      },
    });

    if (cached && regenerateSlot === undefined) {
      // Full cache hit — hydrate slots with wardrobe item data then return
      // Filter out null slots (dismissed by the user for today)
      console.log(`[TODAY] ✅ DB cache HIT at ${Date.now() - t0}ms`);
      
      const curatedSlots = (
        [cached.slot1, cached.slot2, cached.slot3] as (CuratedSlot | null)[]
      ).filter((s): s is CuratedSlot => s !== null);

      // Coerce outfit_ids to strings in case they were stored as numbers
      // (older curation runs may have had imprecise Snowflake IDs)
      const normalizedSlots = curatedSlots.map((slot) => ({
        ...slot,
        outfit_ids: (slot.outfit_ids ?? []).map((id: unknown) => String(id)),
      }));

      const allIds = [...new Set(normalizedSlots.flatMap((s) => s.outfit_ids))];
      console.log(`[TODAY] Fetching ${allIds.length} wardrobe items...`);

      const wardrobeItems = await prisma.wardrobeItem.findMany({
        where: { id: { in: allIds.map(BigInt) } },
        select: {
          id: true,
          name: true,
          category: true,
          imageUrl: true,
          primaryColorName: true,
          primaryColorHex: true,
          displayHint: true,
        },
      });

      console.log(`[TODAY] Wardrobe lookup: ${wardrobeItems.length}/${allIds.length} items matched at ${Date.now() - t0}ms`);
      
      if (wardrobeItems.length === 0 && allIds.length > 0) {
        console.error(`[TODAY] ❌ ZERO items matched — deleting stale cache and regenerating`);
        await prisma.dailyCuration.delete({ where: { id: cached.id } });
        // Fall through to LangGraph below
      } else {
        const itemMap = new Map(
          wardrobeItems.map((item) => [item.id.toString(), item]),
        );
        const hydratedSlots: HydratedSlot[] = normalizedSlots.map((slot) => ({
          ...slot,
          items: slot.outfit_ids
            .map((id) => {
              const item = itemMap.get(id);
              if (!item) {
                console.warn(`[TODAY] No wardrobe match for id: ${id}`);
                return null;
              }
              return {
                id: item.id.toString(),
                name: item.name,
                category: item.category,
                imageUrl: item.imageUrl,
                primaryColorName: item.primaryColorName,
                primaryColorHex: item.primaryColorHex,
                displayHint: item.displayHint,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null),
        }));

        const totalItems = hydratedSlots.reduce((n, s) => n + s.items.length, 0);
        console.log(`[TODAY] Hydrated ${totalItems} total items at ${Date.now() - t0}ms`);

        if (totalItems === 0) {
          console.error(`[TODAY] ❌ All slots hydrated with 0 items — deleting and regenerating`);
          await prisma.dailyCuration.delete({ where: { id: cached.id } });
          // Fall through to LangGraph below
        } else {
          console.log(`[TODAY] ✅ Cache hit complete: ${Date.now() - t0}ms`);
          return successResponse(
            {
              slots: hydratedSlots,
              cached: true,
              curationId: cached.id.toString(),
              weatherContext: null,
              weatherAvailable: true,
              localDate,
            },
            "Today's outfits retrieved from cache",
            200,
          );
        }
      }
    } else if (cached && regenerateSlot !== undefined) {
      console.log(`[TODAY] DB cache exists, regenerating specific slot ${regenerateSlot} at ${Date.now() - t0}ms`);
    } else {
      console.log(`[TODAY] ❌ DB cache MISS — calling LangGraph`);
    }

    // ── Regen limit check ───────────────────────────────────────────────
    if (regenerateSlot !== undefined && cached) {
      console.log(`[TODAY] Checking regen limits...`);
      const user = await prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { plan: true },
      });
      const plan = user?.plan ?? "free";
      const maxRegen = getMaxRegenForPlan(plan);

      if (cached.regenCount >= maxRegen) {
        console.warn(`[TODAY] ❌ Regen limit reached: ${cached.regenCount}/${maxRegen} for ${plan} plan`);
        return errorResponse(
          `Daily regeneration limit reached (${maxRegen} for ${plan} plan)`,
          429,
        );
      }
      console.log(`[TODAY] Regen allowed: ${cached.regenCount}/${maxRegen}`);
    }

    // ── Guard: Check wardrobe has minimum items ──────────────────────────
    console.log(`[TODAY] Checking wardrobe...`);
    const wardrobeCount = await prisma.wardrobeItem.count({
      where: { userId: BigInt(userId) },
    });
    console.log(`[TODAY] Wardrobe has ${wardrobeCount} items`);
    
    if (wardrobeCount < 3) {
      console.warn(`[TODAY] ❌ Not enough items: ${wardrobeCount} < 3`);
      return errorResponse(
        "not_enough_items",
        400,
      );
    }

    // ── Run CurationGraph with timeout guard ────────────────────────────
    console.log(`[TODAY] LangGraph invoking at ${Date.now() - t0}ms...`);
    
    const graph = buildCurationGraph();

    const initialState = {
      userId,
      userLat: lat,
      userLon: lon,
      userTimezone: timezone,
      localDate,
      regenerateSlot: regenerateSlot ?? null,
      excludeWardrobeItemIds: [] as string[],
      regenConfig: REGEN_CONFIG,
      // On regen: carry over existing slots from cache so curate node can avoid repeating items
      // Filter out nulls (dismissed) so the graph only sees active slots as context
      existingSlots: cached
        ? (
            [cached.slot1, cached.slot2, cached.slot3] as (CuratedSlot | null)[]
          ).filter((s): s is CuratedSlot => s !== null)
        : undefined,
      validationAttempts: 0,
      startedAt: Date.now(),
    };

    // TIMEOUT GUARD: Claude + weather + validation must complete within 15 seconds
    let result: any;
    try {
      const graphPromise = graph.invoke(initialState);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("LangGraph timeout: exceeded 15 seconds")), 15000)
      );
      result = await Promise.race([graphPromise, timeoutPromise]);
      console.log(`[TODAY] LangGraph completed at ${Date.now() - t0}ms`);
    } catch (graphErr) {
      const errMsg = (graphErr as Error).message || String(graphErr);
      console.error(`[TODAY] ❌ LangGraph failed: ${errMsg} at ${Date.now() - t0}ms`);
      
      // If timeout or other error, try to return yesterday's curation as fallback
      if (errMsg.includes("timeout")) {
        console.warn(`[TODAY] Attempting fallback to yesterday's curation...`);
        const yesterday = await prisma.dailyCuration.findFirst({
          where: { userId: BigInt(userId) },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });
        
        if (yesterday?.slot1) {
          console.log(`[TODAY] ✅ Fallback successful, returning yesterday's curation`);
          return successResponse(
            {
              slots: [],
              cached: true,
              curationId: yesterday.id.toString(),
              weatherContext: null,
              weatherAvailable: false,
              localDate,
              fallback: true,
              message: "Showing yesterday's look (today's generation timed out)",
            },
            "Fallback: showing yesterday's look",
            200,
          );
        }
      }
      
      return errorResponse(
        errMsg.includes("timeout") ? "generation_timeout" : "generation_failed",
        errMsg.includes("timeout") ? 504 : 500,
      );
    }

    if (result.status === "failed" || result.error) {
      console.error(`[TODAY] ❌ Graph status failed: ${result.error}`);
      // Determine HTTP status code based on error type
      const statusCode = result.errorCode === "no_wardrobe" ? 400 : 500;
      return errorResponse(
        result.error ?? "Curation pipeline failed",
        statusCode,
      );
    }

    const hydratedSlots: HydratedSlot[] = result.hydratedSlots ?? [];
    console.log(`[TODAY] Result: ${hydratedSlots.length} slots, status=${result.status} at ${Date.now() - t0}ms`);
    
    if (hydratedSlots.length !== 3) {
      console.error(`[TODAY] ❌ Expected 3 slots, got ${hydratedSlots.length}`);
      return errorResponse("Unexpected pipeline output: expected 3 slots", 500);
    }

    console.log(`[TODAY] ✅ Generation complete: ${Date.now() - t0}ms total`);
    return successResponse(
      {
        slots: hydratedSlots,
        cached: false,
        curationId: result.curationId ?? null,
        weatherContext: (result.weatherContext as WeatherContext) ?? null,
        weatherAvailable: result.weatherAvailable ?? true,
        localDate,
      },
      "Today's outfits generated successfully",
      201,
    );
  } catch (error) {
    console.error(`[TODAY] ❌ Unhandled error at ${Date.now() - t0}ms:`, error);
    
    // If it's a JSON parse error, try JSON fallback
    if (error instanceof SyntaxError || (error as any).message.includes("JSON")) {
      console.warn(`[TODAY] JSON parse error, attempting fallback...`);
      try {
        const yesterday = await prisma.dailyCuration.findFirst({
          where: { userId: BigInt((error as any).userId || "0") },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });
        
        if (yesterday?.slot1) {
          return successResponse(
            {
              slots: [],
              cached: true,
              curationId: yesterday.id.toString(),
              weatherContext: null,
              weatherAvailable: false,
              localDate: "",
              fallback: true,
              message: "JSON parse error — showing cached look instead",
            },
            "Fallback after JSON error",
            200,
          );
        }
      } catch (fallbackErr) {
        console.error(`[TODAY] Fallback also failed:`, fallbackErr);
      }
    }
    
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

/**
 * DELETE /api/curations/today
 *
 * Clears today's cached curation for the authenticated user.
 * Call this body: { timezone: "Asia/Kolkata" }
 * The next POST will trigger a fresh LangGraph run.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const body = await request.json().catch(() => ({}));
    const timezone = typeof body?.timezone === "string" ? body.timezone : "UTC";
    const localDate = getUserLocalDate(timezone);

    const deleted = await prisma.dailyCuration.deleteMany({
      where: {
        userId: BigInt(userId),
        localDate,
      },
    });

    console.log(`[TODAY] Cleared ${deleted.count} cached curation(s) on ${localDate}`);

    return successResponse(
      { deleted: deleted.count, localDate },
      `Cleared ${deleted.count} cached curation(s) — next load will regenerate`,
      200,
    );
  } catch (error) {
    console.error(`[TODAY] DELETE error:`, error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
