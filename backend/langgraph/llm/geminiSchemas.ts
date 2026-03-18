/**
 * Gemini Native Response Schemas
 *
 * Passed as `responseSchema` to Gemini's generationConfig.
 * Using Gemini's structured output forces JSON without markdown fences —
 * no post-processing regex needed.
 *
 * These mirror the interfaces in shared/types.ts but expressed in
 * Gemini's SchemaType format rather than TypeScript types.
 *
 * NOTE: Enum string fields require `format: "enum"` per the SDK v0.24+ API.
 * See: EnumStringSchema in @google/generative-ai/dist/types/function-calling.d.ts
 */

import { SchemaType, type Schema } from "@google/generative-ai";

// Helper: produce an EnumStringSchema to satisfy the SDK's discriminated union
function enumString(values: string[]): Schema {
  return { type: SchemaType.STRING, format: "enum", enum: values };
}

// ── Wardrobe Item (for vision analysis during ingestion) ──────────────────

export const GEMINI_WARDROBE_ITEM_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    category: enumString([
      "top",
      "bottom",
      "outerwear",
      "footwear",
      "accessory",
      "full_outfit",
    ]),
    subcategory: { type: SchemaType.STRING },
    primary_color_name: { type: SchemaType.STRING },
    primary_color_hex: { type: SchemaType.STRING },
    secondary_color_name: { type: SchemaType.STRING },
    secondary_color_hex: { type: SchemaType.STRING },
    color_pattern: enumString([
      "solid",
      "striped",
      "plaid",
      "floral",
      "graphic",
      "animal_print",
      "tie_dye",
      "colorblock",
      "other",
    ]),
    fit_type: enumString([
      "slim",
      "regular",
      "relaxed",
      "oversized",
      "tailored",
      "cropped",
      "unknown",
    ]),
    length: { type: SchemaType.STRING },
    neckline: { type: SchemaType.STRING },
    material: { type: SchemaType.STRING },
    texture: { type: SchemaType.STRING },
    weight: enumString(["lightweight", "midweight", "heavyweight", "unknown"]),
    formality: enumString([
      "casual",
      "smart_casual",
      "business_casual",
      "formal",
      "athletic",
      "loungewear",
    ]),
    occasions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    suitable_temp_min_c: { type: SchemaType.INTEGER },
    suitable_temp_max_c: { type: SchemaType.INTEGER },
    weather_tags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    season_tags: {
      type: SchemaType.ARRAY,
      items: enumString(["spring", "summer", "autumn", "winter", "all_season"]),
    },
    style_aesthetic: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    brand: { type: SchemaType.STRING },
    confidence: { type: SchemaType.NUMBER },
    parse_notes: { type: SchemaType.STRING },
    display_hint: { type: SchemaType.STRING },
    boundingBox: {
      type: SchemaType.OBJECT,
      properties: {
        top: { type: SchemaType.NUMBER },
        left: { type: SchemaType.NUMBER },
        width: { type: SchemaType.NUMBER },
        height: { type: SchemaType.NUMBER },
      },
    },
  },
  required: [
    "category",
    "subcategory",
    "primary_color_name",
    "primary_color_hex",
    "color_pattern",
    "fit_type",
    // "length" is intentionally optional — meaningless for footwear/accessories
    "material",
    // "texture" is optional — may not be discernible from all photos
    "weight",
    "formality",
    "occasions",
    "suitable_temp_min_c",
    "suitable_temp_max_c",
    "weather_tags",
    "season_tags",
    "style_aesthetic",
    "confidence",
    "display_hint",
  ],
};

/**
 * Multi-item wrapper: used when a single photo may contain several garments.
 * The LLM returns a list — one entry per detected clothing piece.
 */
export const GEMINI_WARDROBE_ITEMS_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      items: GEMINI_WARDROBE_ITEM_SCHEMA,
    },
  },
  required: ["items"],
};

// ── Weather Context (for weather interpretation during curation) ──────────

export const GEMINI_WEATHER_CONTEXT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    season_context: enumString([
      "early_spring",
      "late_spring",
      "peak_summer",
      "late_summer",
      "early_autumn",
      "late_autumn",
      "winter",
      "transitional",
    ]),
    dressing_temp_band: enumString([
      "very_hot",
      "hot",
      "warm",
      "mild",
      "cool",
      "cold",
      "very_cold",
    ]),
    target_temp_c: { type: SchemaType.NUMBER },
    layering_needed: { type: SchemaType.BOOLEAN },
    rain_protection_needed: { type: SchemaType.BOOLEAN },
    weather_notes: { type: SchemaType.STRING },
    formality_suggestion: enumString([
      "none",
      "lean_casual",
      "lean_smart_casual",
      "context_dependent",
    ]),
  },
  required: [
    "season_context",
    "dressing_temp_band",
    "target_temp_c",
    "layering_needed",
    "rain_protection_needed",
    "weather_notes",
    "formality_suggestion",
  ],
};

// ── Curation Output (3 outfit slots) ─────────────────────────────────────

const SLOT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    outfit_ids: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    rationale: { type: SchemaType.STRING },
    styling_tip: { type: SchemaType.STRING },
    occasion_tags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    vibe: enumString([
      "Relaxed",
      "Polished",
      "Sporty",
      "Cosy",
      "Fresh",
      "Bold",
      "Understated",
    ]),
  },
  required: ["outfit_ids", "rationale", "styling_tip", "occasion_tags", "vibe"],
};

export const GEMINI_CURATION_OUTPUT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    slots: {
      type: SchemaType.ARRAY,
      items: SLOT_SCHEMA,
    },
  },
  required: ["slots"],
};
