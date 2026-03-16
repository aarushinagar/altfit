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
import { callGemini, retryWithBackoff } from "../llm/client";
import {
  GEMINI_WEATHER_CONTEXT_SCHEMA,
  GEMINI_CURATION_OUTPUT_SCHEMA,
} from "../llm/geminiSchemas";
import {
  WEATHER_INTERPRETER_PROMPT,
  SENIOR_STYLIST_PROMPT,
  buildRegenAddendum,
} from "../shared/prompts";
import { getModelForTask } from "../shared/models";
import { REGEN_CONFIG } from "../shared/regen";
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

Respond with a single JSON object matching the schema.`;

    const raw = await callGemini({
      model: getModelForTask("weatherInterpret"),
      prompt,
      responseSchema: GEMINI_WEATHER_CONTEXT_SCHEMA,
    });

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
    console.error("[interpretWeatherNode] LLM call failed:", err);
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

function buildCandidateSummary(items: WardrobeCandidate[]): string {
  return items
    .map(
      (item) =>
        `ID: ${item.id} | ${item.category}${item.subcategory ? ` (${item.subcategory})` : ""} | ${item.primary_color_name ?? "unknown"} ${item.material ?? ""} | formality: ${item.formality ?? "?"} | occasions: ${(item.occasions ?? []).join(", ") || "general"}`,
    )
    .join("\n");
}

export async function curateOutfitsNode(
  state: CurationState,
): Promise<Partial<CurationState>> {
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

  const prompt = `${SENIOR_STYLIST_PROMPT}${regenAddendum}${validationHint}

WEATHER CONTEXT:
- Season: ${ctx?.season_context ?? "unknown"}
- Temp band: ${ctx?.dressing_temp_band ?? "mild"} (target: ${ctx?.target_temp_c ?? 20}°C)
- Layering needed: ${ctx?.layering_needed ? "yes" : "no"}
- Rain protection: ${ctx?.rain_protection_needed ? "yes" : "no"}
- Notes: ${ctx?.weather_notes ?? "none"}

CANDIDATE WARDROBE ITEMS (${state.candidateItems.length} items):
${buildCandidateSummary(state.candidateItems)}

Return a JSON object with a "slots" array containing exactly 3 slot objects.`;

  const curationModel = getModelForTask("outfitCuration");
  console.log(
    `[CurationGraph] curate_outfits: calling Gemini ${curationModel} to select outfits from ${state.candidateItems.length} candidates (weather: ${ctx?.dressing_temp_band ?? "unknown"}, ${ctx?.target_temp_c ?? "?"}°C)`,
  );

  try {
    const raw = await retryWithBackoff(() =>
      callGemini({
        model: curationModel,
        prompt,
        responseSchema: GEMINI_CURATION_OUTPUT_SCHEMA,
      }),
    );

    const slots = (raw.slots as CuratedSlot[]) ?? [];
    if (slots.length !== 3) {
      throw new Error(`Expected 3 slots, got ${slots.length}`);
    }

    console.log(
      `[CurationGraph] curate_outfits: Gemini returned ${slots.length} slots — vibes: ${slots.map((s) => s.vibe).join(", ")}`,
    );

    return { curatedSlots: slots, status: "validating" };
  } catch (err) {
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
    return {
      validationAttempts: state.validationAttempts + 1,
      validationFailureReason: "Must have exactly 3 slots",
      status: "curating",
    };
  }

  const candidateIds = new Set(state.candidateItems.map((c) => c.id));
  const errors: string[] = [];

  // Track all used IDs across slots for cross-slot uniqueness
  const allUsedIds: string[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const slotNum = i + 1;

    // All IDs must come from candidate pool
    for (const id of slot.outfit_ids) {
      if (!candidateIds.has(id)) {
        errors.push(
          `Slot ${slotNum}: item ID "${id}" is not in the candidate pool`,
        );
      }
    }

    // No cross-slot item reuse
    for (const id of slot.outfit_ids) {
      if (allUsedIds.includes(id)) {
        errors.push(
          `Slot ${slotNum}: item ID "${id}" appears in multiple slots`,
        );
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
    return {
      validationAttempts: state.validationAttempts + 1,
      validationFailureReason: errors.join("; "),
      status: "curating", // triggers retry in graph
    };
  }

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

    const itemMap = new Map(items.map((item) => [item.id.toString(), item]));

    const hydratedSlots: HydratedSlot[] = state.curatedSlots.map((slot) => ({
      ...slot,
      items: slot.outfit_ids
        .map((id: string) => {
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
        .filter(
          (
            item: {
              id: string;
              name: string;
              category: string;
              imageUrl: string;
              primaryColorName: string | null;
              primaryColorHex: string | null;
              displayHint: string | null;
            } | null,
          ): item is NonNullable<typeof item> => item !== null,
        ),
    }));

    return { hydratedSlots, status: "complete" };
  } catch (err) {
    return {
      status: "failed",
      error: `Hydration failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
