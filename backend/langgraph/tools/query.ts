/**
 * Wardrobe Candidates Query Tool
 *
 * Queries wardrobe items from Prisma (PostgreSQL) with a 2-tier fallback:
 *   Tier 1 — weather/season/temp filtered (up to 20 items)
 *   Tier 2 — top 10 most recent active items (no weather filter)
 *
 * This avoids the need for a Supabase admin client or a custom RPC function.
 */

import prisma from "@/backend/database/prisma";
import type { WardrobeCandidate } from "../shared/types";

export interface QueryCandidatesParams {
  userId: string; // Snowflake ID as string
  tempC: number;
  condition: string; // e.g. "sunny", "rainy"
  season: string; // e.g. "spring", "winter"
  excludeIds?: string[];
}

export interface QueryCandidatesResult {
  items: WardrobeCandidate[];
  tierUsed: 1 | 2;
}

/** Map a Prisma WardrobeItem row to the WardrobeCandidate shape used by the LLM. */
function toCandidate(
  item: Awaited<ReturnType<typeof prisma.wardrobeItem.findMany>>[number],
): WardrobeCandidate {
  return {
    id: item.id.toString(),
    category: item.category,
    subcategory: item.subcategory,
    primary_color_name: item.primaryColorName,
    primary_color_hex: item.primaryColorHex,
    secondary_color_name: item.secondaryColorName,
    color_pattern: item.colorPattern,
    fit_type: item.fitType,
    material: item.material,
    weight: item.weight,
    formality: item.formalityLabel,
    occasions: item.occasion.length > 0 ? item.occasion : null,
    suitable_temp_min_c: item.suitableTempMinC,
    suitable_temp_max_c: item.suitableTempMaxC,
    weather_tags: item.weatherTags.length > 0 ? item.weatherTags : null,
    season_tags: item.season.length > 0 ? item.season : null,
    style_aesthetic:
      item.styleAesthetic.length > 0 ? item.styleAesthetic : null,
    parse_notes: item.parseNotes,
    image_url: item.imageUrl ?? null,
    created_at: item.createdAt.toISOString(),
    wear_count: item.wearCount,
    last_worn_at: item.lastWornAt ? item.lastWornAt.toISOString() : null,
    name: item.name ?? item.subcategory ?? null,
  };
}

/**
 * Queries wardrobe candidates via Prisma with 2-tier fallback.
 * Tier 1: filter by suitable temp range + season overlap (min 3 results required).
 * Tier 2: most recent 10 active items — used when tier 1 returns fewer than 3.
 */
export async function queryWardrobeCandidates(
  params: QueryCandidatesParams,
): Promise<QueryCandidatesResult> {
  const userIdBigInt = BigInt(params.userId);
  const excludeBigInts =
    params.excludeIds && params.excludeIds.length > 0
      ? params.excludeIds.map(BigInt)
      : undefined;

  const baseWhere = {
    userId: userIdBigInt,
    isActive: true,
    ...(excludeBigInts ? { id: { notIn: excludeBigInts } } : {}),
  };

  // ── Tier 1: temperature + season filtered ─────────────────────────────────
  try {
    const tier1Items = await prisma.wardrobeItem.findMany({
      where: {
        ...baseWhere,
        season: { hasSome: [params.season] },
        AND: [
          {
            OR: [
              { suitableTempMinC: null },
              { suitableTempMinC: { lte: params.tempC } },
            ],
          },
          {
            OR: [
              { suitableTempMaxC: null },
              { suitableTempMaxC: { gte: params.tempC } },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    if (tier1Items.length >= 3) {
      return { items: tier1Items.map(toCandidate), tierUsed: 1 };
    }
  } catch (err) {
    console.warn("[queryWardrobeCandidates] Tier 1 query failed:", err);
  }

  // ── Tier 2: most recent 12 active items (no filter) ─────────────────────
  const tier2Items = await prisma.wardrobeItem.findMany({
    where: baseWhere,
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return { items: tier2Items.map(toCandidate), tierUsed: 2 };
}
