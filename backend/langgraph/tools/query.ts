/**
 * Wardrobe Candidates Query Tool
 *
 * Calls the `get_wardrobe_candidates` Supabase RPC to fetch candidate
 * wardrobe items for outfit curation.
 *
 * 2-tier fallback:
 *   Tier 1 — weather/season/temp filtered (up to 20 items)
 *   Tier 2 — top 10 most recent active items (no weather filter)
 */

import { supabaseAdmin } from "@/backend/database/supabase";
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

/**
 * Queries wardrobe candidates via Supabase RPC with 2-tier fallback.
 * Throws only if both tiers fail with a database error.
 */
export async function queryWardrobeCandidates(
  params: QueryCandidatesParams,
): Promise<QueryCandidatesResult> {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured");
  }

  const excludeArray = params.excludeIds ?? [];

  // Tier 1: weather + season + temp filtered
  const { data: tier1, error: err1 } = await supabaseAdmin.rpc(
    "get_wardrobe_candidates",
    {
      p_user_id: params.userId,
      p_temp_c: params.tempC,
      p_condition: params.condition,
      p_season: params.season,
      p_exclude: excludeArray,
      p_tier: 1,
    },
  );

  if (!err1 && tier1 && (tier1 as WardrobeCandidate[]).length >= 3) {
    return { items: tier1 as WardrobeCandidate[], tierUsed: 1 };
  }

  // Tier 2: top 10 most recent, no weather filter
  const { data: tier2, error: err2 } = await supabaseAdmin.rpc(
    "get_wardrobe_candidates",
    {
      p_user_id: params.userId,
      p_temp_c: params.tempC,
      p_condition: params.condition,
      p_season: params.season,
      p_exclude: excludeArray,
      p_tier: 2,
    },
  );

  if (err2) {
    throw new Error(`queryWardrobeCandidates tier-2 failed: ${err2.message}`);
  }

  return { items: (tier2 as WardrobeCandidate[]) ?? [], tierUsed: 2 };
}
