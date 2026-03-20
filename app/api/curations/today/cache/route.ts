/**
 * GET /api/curations/today/cache
 *
 * ULTRA-FAST cache-only endpoint — returns today's outfit if cached, 
 * nothing else. This is called FIRST on page load so outfit appears
 * instantly without showing a loader.
 *
 * Returns 200 if cached + slots returned,
 * Returns 304 if no cache (caller should then POST to /api/curations/today to generate)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/backend/database/auth-middleware";
import { getUserLocalDate } from "@/lib/timezone";
import prisma from "@/backend/database/prisma";
import { successResponse, errorResponse } from "@/backend/database/api-response";
import type { HydratedSlot, CuratedSlot } from "@/backend/langgraph/shared/types";

export async function GET(request: NextRequest) {
  const t0 = Date.now();

  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const timezone = request.nextUrl.searchParams.get("timezone") ?? "Asia/Kolkata";
    const localDate = getUserLocalDate(timezone);

    console.log(`[CacheCheck] Fast cache lookup for ${userId} on ${localDate}`);

    const cached = await prisma.dailyCuration.findUnique({
      where: {
        userId_localDate_userTimezone: {
          userId: BigInt(userId),
          localDate,
          userTimezone: timezone,
        },
      },
    });

    if (!cached?.slot1) {
      console.log(`[CacheCheck] ❌ No cache — caller should POST to generate`);
      return NextResponse.json({ cached: false }, { status: 304 });
    }

    console.log(`[CacheCheck] ✅ Cache hit at ${Date.now() - t0}ms`);

    // Hydrate the cached slots with wardrobe item images + names
    const curatedSlots = (
      [cached.slot1, cached.slot2, cached.slot3] as (CuratedSlot | null)[]
    ).filter((s): s is CuratedSlot => s !== null);

    const normalizedSlots = curatedSlots.map((slot) => ({
      ...slot,
      outfit_ids: (slot.outfit_ids ?? []).map((id: unknown) => String(id)),
    }));

    const allIds = [...new Set(normalizedSlots.flatMap((s) => s.outfit_ids))];
    console.log(`[CacheCheck] Fetching ${allIds.length} items...`);

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

    console.log(`[CacheCheck] Item lookup: ${wardrobeItems.length}/${allIds.length} matched`);

    if (wardrobeItems.length === 0 && allIds.length > 0) {
      console.error(`[CacheCheck] ❌ Stale cache — items missing`);
      // Silently delete stale cache, let caller POST to regenerate
      await prisma.dailyCuration.delete({ where: { id: cached.id } }).catch(() => {});
      return NextResponse.json({ cached: false }, { status: 304 });
    }

    const itemMap = new Map(wardrobeItems.map((item) => [item.id.toString(), item]));
    const hydratedSlots: HydratedSlot[] = normalizedSlots.map((slot) => ({
      ...slot,
      items: slot.outfit_ids
        .map((id) => {
          const item = itemMap.get(id);
          if (!item) return null;
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
    console.log(`[CacheCheck] ✅ Complete: ${totalItems} items hydrated in ${Date.now() - t0}ms`);

    return successResponse(
      {
        slots: hydratedSlots,
        cached: true,
        curationId: cached.id.toString(),
        weatherContext: null,
        weatherAvailable: true,
        localDate,
      },
      "Cache hit",
      200,
    );
  } catch (error) {
    console.error(`[CacheCheck] Error:`, error);
    return NextResponse.json({ cached: false }, { status: 304 });
  }
}
