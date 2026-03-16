/**
 * Shared TypeScript interfaces for the LangGraph pipelines.
 *
 * These are plain TS types — no Zod, no Prisma imports here.
 * Validation is done by parsing LLM JSON against these shapes
 * using the runtime validators in llm/client.ts.
 */

// ── Wardrobe Item Metadata (LLM output from vision analysis) ──────────────

export type WardrobeCategory =
  | "top"
  | "bottom"
  | "outerwear"
  | "footwear"
  | "accessory"
  | "full_outfit";

export type ColorPattern =
  | "solid"
  | "striped"
  | "plaid"
  | "floral"
  | "graphic"
  | "animal_print"
  | "tie_dye"
  | "colorblock"
  | "other";

export type FitType =
  | "slim"
  | "regular"
  | "relaxed"
  | "oversized"
  | "tailored"
  | "cropped"
  | "unknown";

export type WeightType =
  | "lightweight"
  | "midweight"
  | "heavyweight"
  | "unknown";

export type FormalityLabel =
  | "casual"
  | "smart_casual"
  | "business_casual"
  | "formal"
  | "athletic"
  | "loungewear";

export type SeasonTag =
  | "spring"
  | "summer"
  | "autumn"
  | "winter"
  | "all_season";

/**
 * Full metadata structure returned by Gemini Vision for a single wardrobe item.
 * Maps 1-to-1 with the WardrobeItem Prisma model's new AI fields.
 */
export interface WardrobeItemMetadata {
  category: WardrobeCategory;
  subcategory: string; // e.g. "t-shirt", "blazer", "chinos"

  // Color
  primary_color_name: string; // "dusty rose", "forest green"
  primary_color_hex: string; // "#7D9B76"
  secondary_color_name: string | null;
  secondary_color_hex: string | null;
  color_pattern: ColorPattern;

  // Fit & form
  fit_type: FitType;
  length: string; // short|midi|long|cropped|full
  neckline: string | null;

  // Fabric & texture
  material: string;
  texture: string;
  weight: WeightType;

  // Occasion & formality
  formality: FormalityLabel;
  occasions: string[];

  // Weather suitability
  suitable_temp_min_c: number;
  suitable_temp_max_c: number;
  weather_tags: string[]; // sunny|cloudy|light_rain|windy|snow
  season_tags: SeasonTag[];

  // Styling
  style_aesthetic: string[];
  brand: string | null;

  // LLM audit
  confidence: number; // 0.0 – 1.0
  parse_notes: string | null;
}

// ── Weather ────────────────────────────────────────────────────────────────

export type WeatherCondition =
  | "sunny"
  | "cloudy"
  | "rainy"
  | "snowy"
  | "foggy"
  | "windy";

export interface WeatherOutput {
  temp_c: number;
  feels_like_c: number;
  condition: WeatherCondition;
  wmo_code: number;
  humidity_pct: number;
  wind_kph: number;
  uv_index: number;
  is_daytime: boolean;
  city_name: string;
  iana_timezone: string;
  description: string;
  fetched_at_utc: string;
}

export type SeasonContext =
  | "early_spring"
  | "late_spring"
  | "peak_summer"
  | "late_summer"
  | "early_autumn"
  | "late_autumn"
  | "winter"
  | "transitional";

export type DressingTempBand =
  | "very_hot"
  | "hot"
  | "warm"
  | "mild"
  | "cool"
  | "cold"
  | "very_cold";

export interface WeatherContext {
  season_context: SeasonContext;
  dressing_temp_band: DressingTempBand;
  target_temp_c: number;
  layering_needed: boolean;
  rain_protection_needed: boolean;
  weather_notes: string;
  formality_suggestion:
    | "none"
    | "lean_casual"
    | "lean_smart_casual"
    | "context_dependent";
}

// ── Curation ───────────────────────────────────────────────────────────────

export type CurationVibe =
  | "Relaxed"
  | "Polished"
  | "Sporty"
  | "Cosy"
  | "Fresh"
  | "Bold"
  | "Understated";

/** One of the 3 daily outfit slots returned by the curation LLM. */
export interface CuratedSlot {
  outfit_ids: string[]; // WardrobeItem.id values (1–4 items)
  rationale: string;
  styling_tip: string;
  occasion_tags: string[];
  vibe: CurationVibe;
}

/** Curation output = exactly 3 slots */
export interface CurationOutput {
  slots: [CuratedSlot, CuratedSlot, CuratedSlot];
}

/** A curated slot with full WardrobeItem data attached for the API response. */
export interface HydratedSlot extends CuratedSlot {
  items: HydratedWardrobeItem[];
}

export interface HydratedWardrobeItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  primaryColorName: string | null;
  primaryColorHex: string | null;
}

// ── Wardrobe Candidates (from Supabase RPC) ────────────────────────────────

export interface WardrobeCandidate {
  id: string;
  category: string;
  subcategory: string | null;
  primary_color_name: string | null;
  primary_color_hex: string | null;
  secondary_color_name: string | null;
  color_pattern: string | null;
  fit_type: string | null;
  material: string | null;
  weight: string | null;
  formality: string | null;
  occasions: string[] | null;
  suitable_temp_min_c: number | null;
  suitable_temp_max_c: number | null;
  weather_tags: string[] | null;
  season_tags: string[] | null;
  style_aesthetic: string[] | null;
  parse_notes: string | null;
  image_url: string;
  created_at: string;
}

// ── Field mapping helpers ──────────────────────────────────────────────────

/** Maps formality string label to the legacy Int (1–10) scale stored in Prisma. */
export const FORMALITY_LABEL_TO_INT: Record<FormalityLabel, number> = {
  loungewear: 1,
  casual: 2,
  athletic: 3,
  smart_casual: 5,
  business_casual: 7,
  formal: 9,
};

/** WMO weather code → condition string */
export const WMO_CONDITION_MAP: Record<number, WeatherCondition> = {
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

export function wmoToCondition(code: number): WeatherCondition {
  return WMO_CONDITION_MAP[code] ?? "cloudy";
}
