/**
 * POST /api/curations/[id]/regen
 *
 * Regenerates a single slot in an existing DailyCuration.
 * Enforces plan-based daily regen limits before running the graph.
 *
 * Request body:
 * {
 *   slot:     1 | 2 | 3    — which slot to refresh
 *   timezone: string       — IANA timezone e.g. "Asia/Kolkata"
 *   lat:      number       — user's latitude (for weather re-fetch)
 *   lon:      number       — user's longitude
 * }
 *
 * Response:
 * {
 *   slots:      HydratedSlot[3]  — all 3 slots (2 unchanged + 1 new)
 *   curationId: string
 *   regenCount: number
 * }
 */

import { NextRequest } from "next/server";
import prisma from "@/backend/database/prisma";
import { requireAuth } from "@/backend/database/auth-middleware";
import {
  errorResponse,
  successResponse,
} from "@/backend/database/api-response";
import { buildCurationGraph } from "@/backend/langgraph/curation/graph";
import {
  getMaxRegenForPlan,
  REGEN_CONFIG,
} from "@/backend/langgraph/shared/regen";
import { getUserLocalDate } from "@/lib/timezone";
import type {
  CuratedSlot,
  HydratedSlot,
} from "@/backend/langgraph/shared/types";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const { slot, timezone, lat, lon } = (await request.json()) as {
      slot: 1 | 2 | 3;
      timezone: string;
      lat: number;
      lon: number;
    };

    if (![1, 2, 3].includes(slot)) {
      return errorResponse("slot must be 1, 2, or 3", 400);
    }
    if (!timezone) {
      return errorResponse("timezone is required", 400);
    }

    const { id } = await params;

    // ── Load and verify curation ──────────────────────────────────────
    const curation = await prisma.dailyCuration.findUnique({
      where: { id: BigInt(id) },
    });

    if (!curation) {
      return errorResponse("Curation not found", 404);
    }
    if (curation.userId.toString() !== userId) {
      return errorResponse("Not authorized", 403);
    }

    // ── Regen limit check ─────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { plan: true },
    });
    const maxRegen = getMaxRegenForPlan(user?.plan ?? "free");

    if (curation.regenCount >= maxRegen) {
      return errorResponse(
        `Daily regeneration limit reached (${maxRegen} per day for ${user?.plan ?? "free"} plan). Upgrade to Pro for more.`,
        429,
      );
    }

    // ── Run curation graph ────────────────────────────────────────────
    const localDate = getUserLocalDate(timezone);
    const graph = buildCurationGraph();

    const result = await graph.invoke({
      userId,
      userLat: lat ?? 0,
      userLon: lon ?? 0,
      userTimezone: timezone,
      localDate,
      regenerateSlot: slot,
      excludeWardrobeItemIds: [] as string[],
      existingSlots: (
        [
          curation.slot1,
          curation.slot2,
          curation.slot3,
        ] as (CuratedSlot | null)[]
      ).filter((s): s is CuratedSlot => s !== null),
      regenConfig: REGEN_CONFIG,
      validationAttempts: 0,
      startedAt: Date.now(),
    });

    if (result.status === "failed" || result.error) {
      console.error("[CurationsRegen] Graph failed:", result.error);
      return errorResponse(result.error ?? "Regeneration pipeline failed", 500);
    }

    return successResponse(
      {
        slots: (result.hydratedSlots ?? []) as HydratedSlot[],
        curationId: result.curationId ?? id,
        regenCount: curation.regenCount + 1,
      },
      "Slot regenerated successfully",
      200,
    );
  } catch (err) {
    console.error("[CurationsRegen] Unhandled error:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
    );
  }
}
