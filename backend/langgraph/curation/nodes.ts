/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Curation Pipeline — Nodes
 *
 * Seven node functions for the daily outfit curation pipeline.
 *
 * Execution order (see graph.ts):
 *   fetch_weather → interpret_weather → query_wardrobe
 *   → curate_outfits → validate_outfits (→ retry up to 2×) → persist_curation → hydrate_slots
 */

import prisma from "@/backend/database/prisma";
import { generatePrismaId, toPrismaId } from "@/backend/database/prisma-id";
import { generateSnowflakeId } from "@/backend/database/snowflake";
import {
  getWeatherTool,
  getGenericIndianWeatherFallback,
} from "../tools/weather";
import { queryWardrobeCandidates } from "../tools/query";
import { buildUserMemoryContext } from "../tools/memory";
import { retryWithBackoff } from "../llm/client";
import {
  WEATHER_INTERPRETER_PROMPT,
  SENIOR_STYLIST_PROMPT,
  buildRegenAddendum,
} from "../shared/prompts";
import { getModelForTask } from "../shared/models";
import { REGEN_CONFIG } from "../shared/regen";
import Anthropic from "@anthropic-ai/sdk";
import type { CurationState } from "./state";
import type {
  WeatherContext,
  CuratedSlot,
  CurationOutput,
  HydratedSlot,
  WardrobeCandidate,
  SeasonContext,
  DressingTempBand,
} from "../shared/types";

// ── Anthropic client (singleton) ──────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * Call Claude and parse a JSON response.
 * Strips markdown fences if present, then JSON.parse.
 * Hard timeout: 45 seconds — on expiry throws so the caller can fall back.
 * Logs performance metrics for latency tracking.
 */
async function callClaude(
  prompt: string,
  model: string,
  maxTokens = 500,
): Promise<Record<string, unknown>> {
  const timeoutMs = 45_000;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: "You are a JSON API. You MUST respond with ONLY valid JSON. No markdown. No explanations. No text outside JSON.",
        messages: [{ role: "user", content: prompt }],
      },
      { signal: ac.signal },
    );
    const elapsed = Date.now() - startTime;
    
    if (response.stop_reason === "max_tokens") {
      throw new Error(
        `Claude response was truncated (max_tokens=${maxTokens}). Increase the token limit.`,
      );
    }
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    
    if (!cleaned) {
      throw new Error("Claude returned empty response");
    }
    
    // Log performance metrics for monitoring
    console.log(`[Claude API] ${model} completed in ${elapsed}ms (tokens: input=${response.usage.input_tokens}, output=${response.usage.output_tokens})`);
    
    return JSON.parse(cleaned);
  } finally {
    clearTimeout(timer);
  }
}

// ── Season tag from current month ─────────────────────────────────────────

function getCurrentSeason(timezone: string): string {
  const month = new Date().toLocaleString("en-US", {
    timeZone: timezone,
    month: "numeric",
  });
  const m = parseInt(month, 10);
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

// ── Node 1: fetchWeatherNode ───────────────────────────────────────────────

export async function fetchWeatherNode(
  state: CurationState,
): Promise<Partial<CurationState>> {
  try {
    const weather = await retryWithBackoff(
      () => getWeatherTool(state.userLat, state.userLon),
      2,
      1000,
    );
    return {
      weatherRaw: weather,
      weatherAvailable: true,
      status: "interpreting_weather",
    };
  } catch (err) {
    // Non-fatal: use generic Indian weather fallback
    console.error("[fetchWeatherNode] Weather fetch failed:", err);
    return {
      weatherRaw: getGenericIndianWeatherFallback(),
      weatherAvailable: false,
      status: "interpreting_weather",
    };
  }
}

// ── Node 2: interpretWeatherNode ──────────────────────────────────────────

export async function interpretWeatherNode(
  state: CurationState,
): Promise<Partial<CurationState>> {
  const nodeStart = Date.now();
  
  if (!state.weatherRaw) {
    // This shouldn't happen now (we always have a fallback), but handle it just in case
    const season = getCurrentSeason(state.userTimezone);
    const fallbackContext: WeatherContext = {
      season_context: "transitional",
      dressing_temp_band: "mild",
      target_temp_c: 20,
      layering_needed: false,
      rain_protection_needed: false,
      weather_notes: "Weather data unavailable. Suggesting versatile outfits.",
      formality_suggestion: "none",
    };
    return {
      weatherContext: fallbackContext,
      weatherAvailable: false,
      status: "querying_wardrobe",
    };
  }

  try {
    const w = state.weatherRaw;
    const prompt = `${WEATHER_INTERPRETER_PROMPT}

Raw weather data:
- Temperature: ${w.temp_c}°C (feels like ${w.feels_like_c}°C)
- Condition: ${w.condition} (WMO code: ${w.wmo_code})
- Humidity: ${w.humidity_pct}%
- Wind: ${w.wind_kph} km/h
- UV Index: ${w.uv_index}
- Location: ${w.city_name}
- Date: ${state.localDate}

Respond with ONLY a valid JSON object (no markdown) with these exact fields:
{
  "season_context": one of "early_spring"|"late_spring"|"peak_summer"|"late_summer"|"early_autumn"|"late_autumn"|"winter"|"transitional",
  "dressing_temp_band": one of "very_hot"|"hot"|"warm"|"mild"|"cool"|"cold"|"very_cold",
  "target_temp_c": number,
  "layering_needed": boolean,
  "rain_protection_needed": boolean,
  "weather_notes": string,
  "formality_suggestion": one of "none"|"lean_casual"|"lean_smart_casual"|"context_dependent"
}`;

    const raw = await callClaude(prompt, getModelForTask("weatherInterpret"));
    const elapsed = Date.now() - nodeStart;
    console.log(`[Node] interpretWeather completed in ${elapsed}ms (model: ${getModelForTask("weatherInterpret")})`);

    const ctx: WeatherContext = {
      season_context: (raw.season_context as SeasonContext) ?? "transitional",
      dressing_temp_band:
        (raw.dressing_temp_band as DressingTempBand) ?? "mild",
      target_temp_c: (raw.target_temp_c as number) ?? w.temp_c,
      layering_needed: Boolean(raw.layering_needed),
      rain_protection_needed: Boolean(raw.rain_protection_needed),
      weather_notes: (raw.weather_notes as string) ?? "",
      formality_suggestion:
        (raw.formality_suggestion as WeatherContext["formality_suggestion"]) ??
        "none",
    };

    return {
      weatherContext: ctx,
      weatherAvailable: state.weatherAvailable,
      status: "querying_wardrobe",
    };
  } catch (err) {
    const elapsed = Date.now() - nodeStart;
    console.error(`[Node] interpretWeather FAILED after ${elapsed}ms:`, err);
    // Degrade gracefully to weather data without LLM interpretation
    return {
      weatherContext: {
        season_context: "transitional",
        dressing_temp_band: "mild",
        target_temp_c: state.weatherRaw.temp_c,
        layering_needed: false,
        rain_protection_needed: state.weatherRaw.condition === "rainy",
        weather_notes: state.weatherRaw.description,
        formality_suggestion: "none",
      },
      weatherAvailable: state.weatherAvailable,
      status: "querying_wardrobe",
    };
  }
}

// ── Node 3: queryWardrobeNode ──────────────────────────────────────────────

export async function queryWardrobeNode(
  state: CurationState,
): Promise<Partial<CurationState>> {
  const season = getCurrentSeason(state.userTimezone);
  const condition = state.weatherRaw?.condition ?? "sunny";
  const tempC =
    state.weatherContext?.target_temp_c ?? state.weatherRaw?.temp_c ?? 20;

  try {
    const { items, tierUsed } = await queryWardrobeCandidates({
      userId: state.userId,
      tempC,
      condition,
      season,
      excludeIds: state.excludeWardrobeItemIds,
    });

    if (items.length === 0) {
      return {
        status: "failed",
        error: "No wardrobe items found. Upload some clothing items first.",
        errorCode: "no_wardrobe",
      };
    }

    return {
      candidateItems: items,
      queryTierUsed: tierUsed,
      status: "curating",
    };
  } catch (err) {
    return {
      status: "failed",
      error: `Failed to query wardrobe: ${err instanceof Error ? err.message : String(err)}`,
      errorCode: "system_error",
    };
  }
}

// ── Node 4: curateOutfitsNode ──────────────────────────────────────────────

/** Cap items sent to Claude and send only the fields it needs. */
function buildCandidateSummary(items: WardrobeCandidate[]): string {
  const capped = items.slice(0, 12);
  return capped
    .map((item) => {
      const daysSince =
        item.last_worn_at
          ? Math.floor(
            (Date.now() - new Date(item.last_worn_at).getTime()) / 86_400_000,
          )
          : null;
      const wornLabel =
        item.wear_count === 0
          ? "never worn"
          : `worn ${item.wear_count}× (${daysSince}d ago)`;
      return `${item.id}|${item.category}${item.subcategory ? `(${item.subcategory})` : ""}|${item.primary_color_name ?? "?"}|${item.formality ?? "?"}|${wornLabel}`;
    })
    .join("\n");
}

export async function curateOutfitsNode(
  state: CurationState,
): Promise<Partial<CurationState>> {
  const nodeStart = Date.now();
  const ctx = state.weatherContext;
  const regen = state.regenConfig ?? REGEN_CONFIG;

  let regenAddendum = "";
  if (state.regenerateSlot !== null && state.existingSlots) {
    const otherSlots = state.existingSlots.filter(
      (_, i) => i !== state.regenerateSlot! - 1,
    );
    const oldSlotIds =
      state.existingSlots[state.regenerateSlot! - 1]?.outfit_ids ?? [];
    regenAddendum = buildRegenAddendum(
      state.regenerateSlot,
      otherSlots,
      regen,
      oldSlotIds,
    );
  }

  const validationHint =
    state.validationAttempts > 0 && state.validationFailureReason
      ? `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${state.validationFailureReason}\nFix the issue and try again.`
      : "";

  // Fetch user memory context (parallel to curation, best-effort)
  let memoryContext = "";
  try {
    memoryContext = await buildUserMemoryContext(state.userId);
  } catch (err) {
    console.warn("[curateOutfitsNode] Memory context fetch failed (non-fatal):", err);
  }

  const prompt = `${memoryContext ? memoryContext + "\n\n" : ""}${SENIOR_STYLIST_PROMPT}${regenAddendum}${validationHint}

WEATHER CONTEXT:
- Season: ${ctx?.season_context ?? "unknown"}
- Temp band: ${ctx?.dressing_temp_band ?? "mild"} (target: ${ctx?.target_temp_c ?? 20}°C)
- Layering needed: ${ctx?.layering_needed ? "yes" : "no"}
- Rain protection: ${ctx?.rain_protection_needed ? "yes" : "no"}
- Notes: ${ctx?.weather_notes ?? "none"}

CANDIDATE WARDROBE ITEMS (${state.candidateItems.length} items):
Format: ID|CATEGORY|COLOR|FORMALITY|WEAR_HISTORY
${buildCandidateSummary(state.candidateItems)}

IMPORTANT: Return ONLY the exact ID values (the part before the first |) from the list above.
Do not generate new IDs. Do not use item names. Extract IDs directly from this list.

Return a JSON object with a "slots" array containing exactly 3 slot objects.`;

  const curationModel = getModelForTask("outfitCuration");
  console.log(
    `[CurationGraph] curate_outfits: calling Gemini ${curationModel} to select outfits from ${state.candidateItems.length} candidates (weather: ${ctx?.dressing_temp_band ?? "unknown"}, ${ctx?.target_temp_c ?? "?"}°C)`,
  );

  try {
    const raw = await retryWithBackoff(() =>
      callClaude(
        prompt +
        `\n\nReturn ONLY valid JSON, no markdown:\n{"slots":[{"outfit_ids":["id1"],"rationale":"...","styling_tip":"...","occasion_tags":["casual"],"vibe":"Relaxed"}]}\nExactly 3 slots.`,
        curationModel,
        1500,
      ),
    );

    const rawSlots = (raw.slots as CuratedSlot[]) ?? [];
    if (rawSlots.length !== 3) {
      throw new Error(`Expected 3 slots, got ${rawSlots.length}`);
    }

    // Coerce all outfit_ids to strings — the LLM may return large Snowflake IDs as
    // JSON numbers which JSON.parse converts to imprecise float64 values, causing
    // the IDs to no longer match the BigInt IDs stored in the database.
    const validCandidateIds = new Set(state.candidateItems.map(c => c.id));
    const slots: CuratedSlot[] = rawSlots.map((slot) => ({
      ...slot,
      outfit_ids: (slot.outfit_ids ?? [])
        .map((id: unknown) => String(id))
        .filter(id => validCandidateIds.has(id)), // Filter out any hallucinated IDs
    }));

    // Verify that all slots have at least one valid ID
    const slotIssues = slots
      .map((slot, i) => ({ slotNum: i + 1, count: slot.outfit_ids.length }))
      .filter(s => s.count === 0);
    
    if (slotIssues.length > 0) {
      throw new Error(
        `After filtering invalid IDs, some slots have no items: ${slotIssues.map(s => `slot ${s.slotNum}`).join(', ')}`
      );
    }

    console.log(
      `[CurationGraph] curate_outfits: Gemini returned ${slots.length} slots — vibes: ${slots.map((s) => s.vibe).join(", ")}`,
    );
    console.log(
      `[CurationGraph] outfit_ids by slot:`,
      slots.map((s, i) => `slot${i + 1}: [${s.outfit_ids.join(", ")}]`).join(" | "),
    );

    const elapsed = Date.now() - nodeStart;
    console.log(`[Node] curateOutfits completed in ${elapsed}ms (model: ${curationModel})`);

    return { curatedSlots: slots, status: "validating" };
  } catch (err) {
    const elapsed = Date.now() - nodeStart;
    console.error(`[Node] curateOutfits FAILED after ${elapsed}ms:`, err);
    return {
      status: "failed",
      error: `Outfit curation failed: ${err instanceof Error ? err.message : String(err)}`,
      errorCode: "system_error",
    };
  }
}

// ── Node 5: validateOutfitsNode ────────────────────────────────────────────

export async function validateOutfitsNode(
  state: CurationState,
): Promise<Partial<CurationState>> {
  const slots = state.curatedSlots;
  if (!slots || slots.length !== 3) {
    console.log('[Validation] ❌ Slots not present or wrong count:', slots?.length);
    return {
      validationAttempts: state.validationAttempts + 1,
      validationFailureReason: "Must have exactly 3 slots",
      status: "curating",
    };
  }

  const candidateIds = new Set(state.candidateItems.map((c) => c.id));
  console.log('[Validation] Candidate pool:', state.candidateItems.length, 'items with IDs:', Array.from(candidateIds));
  const errors: string[] = [];

  const allowCrossSlotItemReuse = state.regenConfig?.allowCrossSlotItemReuse ?? REGEN_CONFIG.allowCrossSlotItemReuse;

  // Track all used IDs across slots for cross-slot uniqueness
  const allUsedIds: string[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const slotNum = i + 1;
    console.log(`[Validation] Slot ${slotNum}: outfit_ids =`, slot.outfit_ids, '(types:', slot.outfit_ids.map(id => typeof id).join(','), ')');

    // Each slot must include at least one item
    if (slot.outfit_ids.length === 0) {
      errors.push(`Slot ${slotNum}: outfit_ids is empty — must include at least 1 item`);
    }

    // All IDs must come from candidate pool
    for (const id of slot.outfit_ids) {
      if (!candidateIds.has(id)) {
        console.log(`[Validation] ❌ ID mismatch: "${id}" (type ${typeof id}) not in candidate pool`);
        errors.push(
          `Slot ${slotNum}: item ID "${id}" is not in the candidate pool`,
        );
      }
    }

    // Only enforce cross-slot uniqueness when configured
    if (!allowCrossSlotItemReuse) {
      for (const id of slot.outfit_ids) {
        if (allUsedIds.includes(id)) {
          errors.push(
            `Slot ${slotNum}: item ID "${id}" appears in multiple slots`,
          );
        }
      }
    }
    allUsedIds.push(...slot.outfit_ids);

    // Category constraints
    const categories = slot.outfit_ids.map(
      (id: string) =>
        state.candidateItems.find((candidate) => candidate.id === id)
          ?.category ?? "",
    );
    const bottomCount = categories.filter(
      (category: string) => category === "bottom",
    ).length;
    const outerwearCount = categories.filter(
      (category: string) => category === "outerwear",
    ).length;
    const accessoryCount = categories.filter(
      (category: string) => category === "accessory",
    ).length;

    if (bottomCount > 1)
      errors.push(`Slot ${slotNum}: more than one "bottom" item`);
    if (outerwearCount > 1)
      errors.push(`Slot ${slotNum}: more than one "outerwear" item`);
    if (accessoryCount > 2)
      errors.push(`Slot ${slotNum}: more than 2 accessories`);
  }

  if (errors.length > 0) {
    console.log(`[Validation] ❌ Validation failed with ${errors.length} errors:`, errors);
    return {
      validationAttempts: state.validationAttempts + 1,
      validationFailureReason: errors.join("; "),
      status: "curating", // triggers retry in graph
    };
  }

  console.log('[Validation] ✅ All checks passed! Status: persisting');
  return { status: "persisting" };
}

// ── Node 6: persistCurationNode ────────────────────────────────────────────

export async function persistCurationNode(
  state: CurationState,
): Promise<Partial<CurationState>> {
  if (!state.curatedSlots || state.curatedSlots.length !== 3) {
    return {
      status: "failed",
      error: "Cannot persist: missing curated slots",
      errorCode: "system_error",
    };
  }

  const [slot1, slot2, slot3] = state.curatedSlots;
  const latencyMs = Date.now() - state.startedAt;

  try {
    const curation = await prisma.dailyCuration.upsert({
      where: {
        userId_localDate_userTimezone: {
          userId: toPrismaId("DailyCuration", "userId", state.userId) as never,
          localDate: state.localDate,
          userTimezone: state.userTimezone,
        },
      },
      create: {
        id: generatePrismaId("DailyCuration") as never,
        userId: toPrismaId("DailyCuration", "userId", state.userId) as never,
        localDate: state.localDate,
        userTimezone: state.userTimezone,
        weatherTempC: state.weatherRaw?.temp_c ?? 20,
        weatherFeelsLikeC: state.weatherRaw?.feels_like_c ?? null,
        weatherCondition: state.weatherRaw?.condition ?? "unknown",
        weatherHumidityPct: state.weatherRaw?.humidity_pct ?? null,
        weatherWindKph: state.weatherRaw?.wind_kph ?? null,
        weatherLocation: state.weatherRaw?.city_name ?? "unknown",
        slot1: slot1 as object,
        slot2: slot2 as object,
        slot3: slot3 as object,
        regenCount: 0,
        pipelineVersion: "3.0",
        modelUsed: getModelForTask("outfitCuration"),
        queryTierUsed: state.queryTierUsed,
        totalCandidates: state.candidateItems.length,
        latencyMs,
      },
      update: {
        // On regen: update only the changed slot and increment regenCount
        slot1: state.regenerateSlot === 1 ? (slot1 as object) : undefined,
        slot2: state.regenerateSlot === 2 ? (slot2 as object) : undefined,
        slot3: state.regenerateSlot === 3 ? (slot3 as object) : undefined,
        regenCount: { increment: state.regenerateSlot !== null ? 1 : 0 },
        regenSlot: state.regenerateSlot,
        regenAt: state.regenerateSlot !== null ? new Date() : undefined,
        latencyMs,
        updatedAt: new Date(),
      },
    });

    // Save OutfitHistory rows (fire-and-forget so it doesn't slow down response)
    void saveOutfitHistory(state, curation.id.toString()).catch((err) =>
      console.warn("[persistCurationNode] OutfitHistory save failed (non-fatal):", err),
    );

    return {
      curationId: curation.id.toString(),
      latencyMs,
      status: "hydrating",
    };
  } catch (err) {
    // Non-fatal: still return results even if persist fails
    console.error("[persistCurationNode] Upsert failed:", err);
    return { curationId: null, latencyMs, status: "hydrating" };
  }
}

// ── saveOutfitHistory (helper for persistCurationNode) ────────────────────

async function saveOutfitHistory(
  state: CurationState,
  curationIdStr: string,
): Promise<void> {
  if (!state.curatedSlots) return;

  const userIdBigInt = BigInt(state.userId);
  const curationIdBigInt = BigInt(curationIdStr);

  // Build a lookup: wardrobe item id → name for denormalised itemNames array
  const allIds = [...new Set(state.curatedSlots.flatMap((s) => s.outfit_ids))];
  const items = await prisma.wardrobeItem.findMany({
    where: { id: { in: allIds.map(BigInt) } },
    select: { id: true, name: true, subcategory: true, category: true },
  });
  const nameMap = new Map(
    items.map((i) => [i.id.toString(), i.name ?? i.subcategory ?? i.category]),
  );

  // One OutfitHistory row per slot
  await Promise.all(
    state.curatedSlots.map(async (slot, idx) => {
      const slotNumber = (idx + 1) as 1 | 2 | 3;
      const itemNames = slot.outfit_ids.map(
        (id: string) => nameMap.get(id) ?? id,
      );

      await prisma.outfitHistory.create({
        data: {
          id: generateSnowflakeId(),
          userId: userIdBigInt,
          outfitName: `Slot ${slotNumber} – ${slot.vibe ?? "Look"}`,
          itemIds: slot.outfit_ids,
          itemNames,
          stylingNote: slot.styling_tip ?? null,
          vibe: slot.vibe ?? null,
          occasionTags: slot.occasion_tags ?? [],
          curationId: curationIdBigInt,
          slotNumber,
        },
      });
    }),
  );

  // Increment UserStyleProfile.interactionCount (upsert if missing)
  const updatedProfile = await prisma.userStyleProfile.upsert({
    where: { userId: userIdBigInt },
    create: {
      id: generateSnowflakeId(),
      userId: userIdBigInt,
      interactionCount: 1,
    },
    update: {
      interactionCount: { increment: 1 },
      updatedAt: new Date(),
    },
    select: { interactionCount: true },
  });

  // Every 5 interactions, trigger a background style analysis via the API
  if (updatedProfile.interactionCount % 5 === 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    void fetch(`${appUrl}/api/style-profile/analyze`, {
      method: "POST",
      headers: { "x-internal-user-id": state.userId },
    }).catch((err) =>
      console.warn("[saveOutfitHistory] Style analysis trigger failed:", err),
    );
  }
}

// ── Node 7: hydrateSlotsNode ───────────────────────────────────────────────

export async function hydrateSlotsNode(
  state: CurationState,
): Promise<Partial<CurationState>> {
  if (!state.curatedSlots) {
    return {
      status: "failed",
      error: "Cannot hydrate: missing curated slots",
      errorCode: "system_error",
    };
  }

  // Collect all unique wardrobe item IDs across all slots
  const allIds = [...new Set(state.curatedSlots.flatMap((s) => s.outfit_ids))];
  console.log('[Hydration] Slot outfit_ids:', allIds);

  if (allIds.length === 0) {
    console.error('[Hydration] ❌ CRITICAL: all outfit_ids are empty — LLM returned no items');
    return {
      status: 'failed' as const,
      error: 'Curation produced no outfit items — please retry',
      errorCode: 'system_error' as const,
    };
  }

  try {
    const items = await prisma.wardrobeItem.findMany({
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

    console.log('[Hydration] Found items in DB:', items.length, '/', allIds.length);
    console.log('[Hydration] Item imageUrls:', items.map(i => ({ id: i.id.toString(), hasImage: !!i.imageUrl })));

    const itemMap = new Map(items.map((item) => [item.id.toString(), item]));

    const hydratedSlots: HydratedSlot[] = state.curatedSlots.map((slot) => ({
      ...slot,
      items: slot.outfit_ids
        .map((id: string) => {
          const item = itemMap.get(id);
          if (!item) {
            console.log('[Hydration] Missing wardrobe item for ID:', id);
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
        .filter(
          (
            item: {
              id: string;
              name: string;
              category: string;
              imageUrl: string | null;
              primaryColorName: string | null;
              primaryColorHex: string | null;
              displayHint: string | null;
            } | null,
          ): item is NonNullable<typeof item> => item !== null,
        ),
    }));

    console.log('[Hydration] Hydrated slots with items:', hydratedSlots.map(s => ({ vibe: s.vibe, items: s.items.length })));

    return { hydratedSlots, status: "complete" };
  } catch (err) {
    return {
      status: "failed",
      error: `Hydration failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
