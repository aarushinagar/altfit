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
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    // ── Early check: verify user has images in wardrobe ──────────────────
    const hasWardrobe = await prisma.wardrobeItem.findFirst({
      where: { userId: BigInt(userId) },
      select: { id: true },
    });

    if (!hasWardrobe) {
      return errorResponse(
        "No wardrobe items found. Upload at least 2 pieces to get outfit recommendations.",
        400,
      );
    }

    // ── Parse and validate body ─────────────────────────────────────────
    const body = await request.json();
    const { lat, lon, timezone, regenerateSlot } = body as {
      lat: number;
      lon: number;
      timezone: string;
      regenerateSlot?: 1 | 2 | 3;
    };

    if (typeof lat !== "number" || typeof lon !== "number" || !timezone) {
      return errorResponse("Missing required fields: lat, lon, timezone", 400);
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return errorResponse("Invalid coordinates", 400);
    }
    if (regenerateSlot !== undefined && ![1, 2, 3].includes(regenerateSlot)) {
      return errorResponse("regenerateSlot must be 1, 2, or 3", 400);
    }

    const localDate = getUserLocalDate(timezone);

    // ── Check DB cache ──────────────────────────────────────────────────
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
      console.log(`[CurationsToday] DB cache hit — outfit_ids: [${allIds.join(", ")}]`);

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

      console.log(`[CurationsToday] Wardrobe lookup: ${wardrobeItems.length}/${allIds.length} IDs matched`);
      if (wardrobeItems.length === 0 && allIds.length > 0) {
        console.error(`[CurationsToday] ❌ ZERO items matched — outfit_ids don't correspond to any wardrobe items. Deleting stale DB cache and regenerating.`);
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
                console.warn(`[CurationsToday] No wardrobe match for id: ${id}`);
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
        console.log(`[CurationsToday] Hydrated slots: ${hydratedSlots.map((s) => `${s.vibe}(${s.items.length} items)`).join(", ")} — total: ${totalItems}`);

        if (totalItems === 0) {
          console.error(`[CurationsToday] ❌ All slots hydrated with 0 items — deleting stale DB cache and regenerating.`);
          await prisma.dailyCuration.delete({ where: { id: cached.id } });
          // Fall through to LangGraph below
        } else {
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
    }

    // ── Regen limit check ───────────────────────────────────────────────
    if (regenerateSlot !== undefined && cached) {
      const user = await prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { plan: true },
      });
      const plan = user?.plan ?? "free";
      const maxRegen = getMaxRegenForPlan(plan);

      if (cached.regenCount >= maxRegen) {
        return errorResponse(
          `Daily regeneration limit reached (${maxRegen} for ${plan} plan)`,
          429,
        );
      }
    }

    // ── Run CurationGraph ───────────────────────────────────────────────
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

    const result = await graph.invoke(initialState);

    if (result.status === "failed" || result.error) {
      console.error("[CurationsToday] Graph failed:", result.error);
      // Determine HTTP status code based on error type
      const statusCode = result.errorCode === "no_wardrobe" ? 400 : 500;
      return errorResponse(
        result.error ?? "Curation pipeline failed",
        statusCode,
      );
    }

    const hydratedSlots: HydratedSlot[] = result.hydratedSlots ?? [];
    console.log('[CurationsToday] Final state keys:', Object.keys(result).slice(0, 20));
    console.log('[CurationsToday] hydratedSlots:', hydratedSlots?.length, 'status:', result.status);
    if (hydratedSlots.length !== 3) {
      console.error('[CurationsToday] ❌ Expected 3 hydratedSlots, got', hydratedSlots.length);
      console.error('[CurationsToday] Full result:', JSON.stringify(result, null, 2).slice(0, 500));
      return errorResponse("Unexpected pipeline output: expected 3 slots", 500);
    }

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
    console.error("[CurationsToday] Unhandled error:", error);
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

    console.log(`[CurationsToday] Cleared ${deleted.count} cached curation(s) for user ${userId} on ${localDate}`);

    return successResponse(
      { deleted: deleted.count, localDate },
      `Cleared ${deleted.count} cached curation(s) — next load will regenerate`,
      200,
    );
  } catch (error) {
    console.error("[CurationsToday] DELETE error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
