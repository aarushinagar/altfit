/**
 * Vision Tool — Gemini Vision image analysis for wardrobe item ingestion.
 *
 * Fetches an image by URL, sends it to Gemini Vision with the fashion analyst
 * prompt, and returns strongly-typed WardrobeItemMetadata.
 */

import { callGemini, retryWithBackoff } from "../llm/client";
import { GEMINI_WARDROBE_ITEMS_SCHEMA } from "../llm/geminiSchemas";
import { FASHION_ANALYST_PROMPT } from "../shared/prompts";
import { getModelForTask } from "../shared/models";
import type {
  WardrobeItemMetadata,
  WardrobeCategory,
  ColorPattern,
  FitType,
  WeightType,
  FormalityLabel,
  SeasonTag,
} from "../shared/types";

// ── Runtime validators ────────────────────────────────────────────────────
// No Zod — validate the fields we need for DB insertion, throw clearly if wrong.

const VALID_CATEGORIES: WardrobeCategory[] = [
  "top",
  "bottom",
  "outerwear",
  "footwear",
  "accessory",
  "full_outfit",
];
const VALID_COLOR_PATTERNS: ColorPattern[] = [
  "solid",
  "striped",
  "plaid",
  "floral",
  "graphic",
  "animal_print",
  "tie_dye",
  "colorblock",
  "other",
];
const VALID_FIT_TYPES: FitType[] = [
  "slim",
  "regular",
  "relaxed",
  "oversized",
  "tailored",
  "cropped",
  "unknown",
];
const VALID_WEIGHT: WeightType[] = [
  "lightweight",
  "midweight",
  "heavyweight",
  "unknown",
];
const VALID_FORMALITY: FormalityLabel[] = [
  "casual",
  "smart_casual",
  "business_casual",
  "formal",
  "athletic",
  "loungewear",
];
const VALID_SEASONS: SeasonTag[] = [
  "spring",
  "summer",
  "autumn",
  "winter",
  "all_season",
];
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function validateWardrobeItemMetadata(
  raw: Record<string, unknown>,
): WardrobeItemMetadata {
  const errors: string[] = [];

  if (!VALID_CATEGORIES.includes(raw.category as WardrobeCategory))
    errors.push(`category: "${raw.category}" is not valid`);

  if (typeof raw.subcategory !== "string" || !raw.subcategory)
    errors.push("subcategory: must be a non-empty string");

  if (typeof raw.primary_color_name !== "string" || !raw.primary_color_name)
    errors.push("primary_color_name: missing");

  if (
    typeof raw.primary_color_hex !== "string" ||
    !HEX_RE.test(raw.primary_color_hex)
  )
    errors.push(
      `primary_color_hex: "${raw.primary_color_hex}" is not a valid hex`,
    );

  if (
    raw.secondary_color_hex !== null &&
    raw.secondary_color_hex !== undefined &&
    (typeof raw.secondary_color_hex !== "string" ||
      !HEX_RE.test(raw.secondary_color_hex as string))
  ) {
    errors.push(
      `secondary_color_hex: "${raw.secondary_color_hex}" is not a valid hex`,
    );
  }

  if (!VALID_COLOR_PATTERNS.includes(raw.color_pattern as ColorPattern))
    errors.push(`color_pattern: "${raw.color_pattern}" is not valid`);

  if (!VALID_FIT_TYPES.includes(raw.fit_type as FitType))
    errors.push(`fit_type: "${raw.fit_type}" is not valid`);

  if (!VALID_WEIGHT.includes(raw.weight as WeightType))
    errors.push(`weight: "${raw.weight}" is not valid`);

  if (!VALID_FORMALITY.includes(raw.formality as FormalityLabel))
    errors.push(`formality: "${raw.formality}" is not valid`);

  if (
    typeof raw.suitable_temp_min_c !== "number" ||
    typeof raw.suitable_temp_max_c !== "number"
  )
    errors.push("suitable_temp_min_c / suitable_temp_max_c: must be numbers");

  if (!Array.isArray(raw.season_tags))
    errors.push("season_tags: must be an array");

  if (
    typeof raw.confidence !== "number" ||
    raw.confidence < 0 ||
    raw.confidence > 1
  )
    errors.push(`confidence: "${raw.confidence}" must be 0–1`);

  if (errors.length > 0) {
    throw new Error(
      `WardrobeItemMetadata validation failed:\n${errors.join("\n")}`,
    );
  }

  return {
    category: raw.category as WardrobeCategory,
    subcategory: raw.subcategory as string,
    primary_color_name: raw.primary_color_name as string,
    primary_color_hex: raw.primary_color_hex as string,
    secondary_color_name: (raw.secondary_color_name as string | null) ?? null,
    secondary_color_hex: (raw.secondary_color_hex as string | null) ?? null,
    color_pattern: raw.color_pattern as ColorPattern,
    fit_type: raw.fit_type as FitType,
    length: (raw.length as string) ?? "unknown",
    neckline: (raw.neckline as string | null) ?? null,
    material: (raw.material as string) ?? "unknown",
    texture: (raw.texture as string) ?? "unknown",
    weight: raw.weight as WeightType,
    formality: raw.formality as FormalityLabel,
    occasions: Array.isArray(raw.occasions) ? (raw.occasions as string[]) : [],
    suitable_temp_min_c: raw.suitable_temp_min_c as number,
    suitable_temp_max_c: raw.suitable_temp_max_c as number,
    weather_tags: Array.isArray(raw.weather_tags)
      ? (raw.weather_tags as string[])
      : [],
    season_tags: Array.isArray(raw.season_tags)
      ? (raw.season_tags as SeasonTag[]).filter((s) =>
          VALID_SEASONS.includes(s),
        )
      : [],
    style_aesthetic: Array.isArray(raw.style_aesthetic)
      ? (raw.style_aesthetic as string[])
      : [],
    brand: (raw.brand as string | null) ?? null,
    confidence: raw.confidence as number,
    parse_notes: (raw.parse_notes as string | null) ?? null,
    display_hint: (raw.display_hint as string | null) ?? null,
  };
}

// ── Main export ───────────────────────────────────────────────────────────

export interface VisionAnalysisResult {
  /** One entry per detected clothing piece in the photo. */
  items: WardrobeItemMetadata[];
  modelUsed: string;
}

/**
 * Fetches `imageUrl`, sends it to Gemini Vision, identifies ALL clothing
 * pieces in the photo and returns one metadata object per piece.
 *
 * @param imageUrl   Public URL of the wardrobe item image
 * @param retryHint  Optional hint appended to the prompt on retry
 */
export async function geminiVisionAnalyze(
  imageUrl: string,
  retryHint = "",
): Promise<VisionAnalysisResult> {
  const model = getModelForTask("visionAnalysis");

  console.log(
    `[Vision] Fetching image for analysis: ${imageUrl.substring(0, 80)}...`,
  );

  // Fetch image bytes
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to fetch image for analysis: HTTP ${imageResponse.status}`,
    );
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString("base64");

  // Detect MIME type from response headers; default to webp
  const contentType = imageResponse.headers.get("content-type") ?? "image/webp";
  const mimeType = contentType.split(";")[0].trim();

  const prompt = [
    FASHION_ANALYST_PROMPT,
    retryHint ? `\n\nHINT FOR THIS RETRY: ${retryHint}` : "",
    '\n\nAnalyze ALL clothing items and accessories in this image. Return a JSON object with an "items" array — one entry per distinct piece.',
  ]
    .filter(Boolean)
    .join("");

  console.log(
    `[Vision] Calling Gemini ${model} for multi-item analysis (mimeType: ${mimeType})`,
  );

  const raw = await retryWithBackoff(() =>
    callGemini({
      model,
      prompt,
      responseSchema: GEMINI_WARDROBE_ITEMS_SCHEMA,
      imageBase64,
      imageMimeType: mimeType,
    }),
  );

  // Validate: expect { items: [...] }
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new Error(
      `Vision analysis returned no items. Raw response keys: ${Object.keys(raw).join(", ")}`,
    );
  }

  const items = (raw.items as Record<string, unknown>[]).map((item, idx) => {
    try {
      return validateWardrobeItemMetadata(item);
    } catch (err) {
      throw new Error(
        `Item ${idx + 1} failed validation: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  console.log(
    `[Vision] Analysis complete — detected ${items.length} item(s): ${items.map((i) => `${i.category}/${i.subcategory}`).join(", ")}`,
  );

  return { items, modelUsed: model };
}
