/**
 * Curation Pipeline — LangGraph State
 *
 * State shape for the daily outfit curation graph.
 *
 * Flow:
 *   fetch_weather → interpret_weather → query_wardrobe
 *   → curate_outfits → validate_outfits (→ retry) → persist_curation → hydrate_slots
 */

import { Annotation } from "@langchain/langgraph";
import type {
  WeatherOutput,
  WeatherContext,
  WardrobeCandidate,
  CuratedSlot,
  HydratedSlot,
} from "../shared/types";
import type { RegenConfig } from "../shared/regen";

// Shared last-value reducer (replace with latest value)
function last<T>(_prev: T, next: T): T {
  return next;
}

export const CurationAnnotation = Annotation.Root({
  // ── Inputs ──────────────────────────────────────────────────
  userId: Annotation<string>(),
  userLat: Annotation<number>(),
  userLon: Annotation<number>(),
  /** IANA timezone string, e.g. "Asia/Kolkata" */
  userTimezone: Annotation<string>(),
  /** User's local calendar date "YYYY-MM-DD" */
  localDate: Annotation<string>(),

  // ── Regen-only inputs ────────────────────────────────────────
  /** Non-null only when regenerating a specific slot (1, 2, or 3) */
  regenerateSlot: Annotation<1 | 2 | 3 | null>({
    reducer: last,
    default: () => null,
  }),
  /** Item IDs to exclude from the candidate pool during regen */
  excludeWardrobeItemIds: Annotation<string[]>({
    reducer: last,
    default: () => [],
  }),
  /** Regen config from the route handler */
  regenConfig: Annotation<RegenConfig | null>({
    reducer: last,
    default: () => null,
  }),
  /** Existing slots (needed for regen vibe-contrast logic) */
  existingSlots: Annotation<CuratedSlot[] | null>({
    reducer: last,
    default: () => null,
  }),

  // ── Weather ──────────────────────────────────────────────────
  /** Raw weather data from Open-Meteo */
  weatherRaw: Annotation<WeatherOutput | null>({
    reducer: last,
    default: () => null,
  }),
  /** LLM-interpreted dressing context */
  weatherContext: Annotation<WeatherContext | null>({
    reducer: last,
    default: () => null,
  }),

  // ── Wardrobe candidates ──────────────────────────────────────
  candidateItems: Annotation<WardrobeCandidate[]>({
    reducer: last,
    default: () => [],
  }),
  /** 1 = weather-filtered, 2 = top-10 fallback */
  queryTierUsed: Annotation<1 | 2>({
    reducer: last,
    default: () => 1 as const,
  }),

  // ── Curation ─────────────────────────────────────────────────
  /** 3 curated outfit slots from the LLM */
  curatedSlots: Annotation<CuratedSlot[] | null>({
    reducer: last,
    default: () => null,
  }),
  /** Incremented on each curate→validate retry cycle */
  validationAttempts: Annotation<number>({ reducer: last, default: () => 0 }),
  /** Validation failure reason injected into retry prompt */
  validationFailureReason: Annotation<string | null>({
    reducer: last,
    default: () => null,
  }),

  // ── Outputs ──────────────────────────────────────────────────
  /** DailyCuration.id (BigInt as string) on success */
  curationId: Annotation<string | null>({ reducer: last, default: () => null }),
  /** Full slot data with hydrated WardrobeItem fields */
  hydratedSlots: Annotation<HydratedSlot[] | null>({
    reducer: last,
    default: () => null,
  }),
  /** Pipeline wall-clock time in ms */
  latencyMs: Annotation<number | null>({ reducer: last, default: () => null }),
  startedAt: Annotation<number>({ reducer: last, default: () => Date.now() }),
  error: Annotation<string | null>({ reducer: last, default: () => null }),
  status: Annotation<
    | "fetching_weather"
    | "interpreting_weather"
    | "querying_wardrobe"
    | "curating"
    | "validating"
    | "persisting"
    | "hydrating"
    | "complete"
    | "failed"
  >({ reducer: last, default: () => "fetching_weather" as const }),
});

export type CurationState = typeof CurationAnnotation.State;
