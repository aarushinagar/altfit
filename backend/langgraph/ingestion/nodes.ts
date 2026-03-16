/**
 * Ingestion Pipeline — Nodes
 *
 * Four pure async functions, each receiving and returning partial state.
 *
 * Node execution order (see graph.ts):
 *   validate_image → vision_parse (→ retry on low confidence) → enrich_metadata → persist_item
 */

import prisma from "@/backend/database/prisma";
import { generatePrismaId, toPrismaId } from "@/backend/database/prisma-id";
import { generateSnowflakeId } from "@/backend/database/snowflake";
import { supabaseAdmin } from "@/backend/database/supabase";
import { geminiVisionAnalyze } from "../tools/vision";
import { getModelForTask } from "../shared/models";
import { FORMALITY_LABEL_TO_INT } from "../shared/types";
import type { IngestionState } from "./state";
import type { WardrobeItemMetadata } from "../shared/types";

// ── Material → temperature range lookup ────────────────────────────────────
// Used in enrichMetadataNode when the LLM returns null temp range.

const MATERIAL_TEMP_DEFAULTS: Record<string, { min: number; max: number }> = {
  linen: { min: 22, max: 38 },
  cotton: { min: 15, max: 35 },
  denim: { min: 8, max: 22 },
  wool: { min: -5, max: 15 },
  cashmere: { min: -5, max: 12 },
  fleece: { min: 5, max: 20 },
  down: { min: -15, max: 5 },
  silk: { min: 18, max: 30 },
  synthetic: { min: 10, max: 28 },
  leather: { min: 0, max: 18 },
  knit: { min: 5, max: 20 },
};

function deriveTempRange(material: string): { min: number; max: number } {
  const key = material.toLowerCase().trim();
  for (const [mat, range] of Object.entries(MATERIAL_TEMP_DEFAULTS)) {
    if (key.includes(mat)) return range;
  }
  return { min: 10, max: 30 }; // sensible default
}

// ── Node 1: validateImageNode ──────────────────────────────────────────────

/**
 * HEAD-checks the image URL to ensure it's reachable and under 8 MB.
 * Sets state.error on failure (graph routes to END).
 */
export async function validateImageNode(
  state: IngestionState,
): Promise<Partial<IngestionState>> {
  try {
    const res = await fetch(state.imageUrl, { method: "HEAD" });
    if (!res.ok) {
      return {
        status: "failed",
        error: `Image URL returned HTTP ${res.status}. Check Supabase Storage permissions.`,
      };
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      if (bytes > 8 * 1024 * 1024) {
        return {
          status: "failed",
          error: `Image size (${(bytes / 1024 / 1024).toFixed(1)} MB) exceeds 8 MB limit.`,
        };
      }
    }

    return { status: "parsing" };
  } catch (err) {
    return {
      status: "failed",
      error: `Image validation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Node 2: visionParseNode ────────────────────────────────────────────────

/**
 * Calls Gemini Vision to analyse the wardrobe item image.
 * On low confidence (< 0.6), sets a retry hint for a second attempt.
 * On error, marks needsReview=true and sets a fallback rawParse so persist still runs.
 */
export async function visionParseNode(
  state: IngestionState,
): Promise<Partial<IngestionState>> {
  const attempts = state.parseAttempts + 1;

  try {
    const { data } = await geminiVisionAnalyze(
      state.imageUrl,
      state.retryHint ?? "",
    );

    const lowConfidence = data.confidence < 0.6;
    const hint =
      lowConfidence && attempts < 2
        ? `Previous attempt returned confidence ${data.confidence.toFixed(2)}. ${data.parse_notes ?? "Please be more precise about category, color, and material."}`
        : null;

    return {
      parseAttempts: attempts,
      rawParse: data,
      confidence: data.confidence,
      retryHint: hint,
      needsReview: lowConfidence,
      status: "enriching",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // On vision failure: mark for review but don't abort — persist with minimal data
    return {
      parseAttempts: attempts,
      needsReview: true,
      confidence: 0,
      error: message,
      status: "persisting", // skip enrich, go straight to persist with null rawParse
    };
  }
}

// ── Node 3: enrichMetadataNode ─────────────────────────────────────────────

/**
 * Normalises and enriches rawParse before DB insertion.
 * - Trims / lowercases color names
 * - Validates hex format (nulls out invalid values)
 * - Derives temp range from material if the LLM left it null or reversed
 */
export async function enrichMetadataNode(
  state: IngestionState,
): Promise<Partial<IngestionState>> {
  if (!state.rawParse) {
    return { status: "persisting" };
  }

  const raw = state.rawParse;

  // Normalize color names
  const primaryColorName = raw.primary_color_name?.trim().toLowerCase() ?? null;
  const secondaryColorName =
    raw.secondary_color_name?.trim().toLowerCase() ?? null;

  // Validate hex (null out if malformed)
  const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
  const primaryColorHex = HEX_RE.test(raw.primary_color_hex ?? "")
    ? raw.primary_color_hex
    : null;
  const secondaryColorHex =
    raw.secondary_color_hex && HEX_RE.test(raw.secondary_color_hex)
      ? raw.secondary_color_hex
      : null;

  // Derive temp range if missing or inverted
  let tempMin = raw.suitable_temp_min_c;
  let tempMax = raw.suitable_temp_max_c;
  if (tempMin == null || tempMax == null || tempMin >= tempMax) {
    const derived = deriveTempRange(raw.material ?? "");
    tempMin = derived.min;
    tempMax = derived.max;
  }

  const enriched: WardrobeItemMetadata = {
    ...raw,
    primary_color_name: primaryColorName ?? raw.primary_color_name,
    primary_color_hex: primaryColorHex ?? raw.primary_color_hex,
    secondary_color_name: secondaryColorName,
    secondary_color_hex: secondaryColorHex,
    suitable_temp_min_c: tempMin,
    suitable_temp_max_c: tempMax,
  };

  return {
    enrichedMetadata: enriched,
    status: "persisting",
  };
}

// ── Node 4: persistItemNode ────────────────────────────────────────────────

/**
 * Creates the WardrobeItem in Prisma and increments the user's wardrobeItemCount.
 * Uses enrichedMetadata when available, falls back to rawParse, then minimal defaults.
 *
 * On failure: deletes the uploaded image from Supabase Storage (no orphaned files).
 */
export async function persistItemNode(
  state: IngestionState,
): Promise<Partial<IngestionState>> {
  const meta = state.enrichedMetadata ?? state.rawParse;
  const model = getModelForTask("visionAnalysis");

  try {
    let createdItemId: string | bigint | null = null;

    await prisma.$transaction(async (tx) => {
      const createdItem = await tx.wardrobeItem.create({
        data: {
          id: generatePrismaId("WardrobeItem") as never,
          userId: toPrismaId("WardrobeItem", "userId", state.userId) as never,
          name:
            state.itemName ??
            meta?.subcategory ??
            meta?.category ??
            "Wardrobe Item",
          category: meta?.category ?? "top",

          // Required Prisma fields from existing schema
          imageUrl: state.imageUrl,
          storagePath: state.storagePath ?? "",

          // ── New AI metadata fields ──
          subcategory: meta?.subcategory ?? null,
          primaryColorName: meta?.primary_color_name ?? null,
          primaryColorHex: meta?.primary_color_hex ?? null,
          secondaryColorName: meta?.secondary_color_name ?? null,
          secondaryColorHex: meta?.secondary_color_hex ?? null,
          colorPattern: meta?.color_pattern ?? null,
          fitType: meta?.fit_type ?? null,
          length: meta?.length ?? null,
          neckline: meta?.neckline ?? null,
          material: meta?.material ?? null,
          texture: meta?.texture ?? null,
          weight: meta?.weight ?? null,
          formalityLabel: meta?.formality ?? null,

          // Legacy fields kept for backward compat
          formality: meta?.formality
            ? (FORMALITY_LABEL_TO_INT[
                meta.formality as keyof typeof FORMALITY_LABEL_TO_INT
              ] ?? 5)
            : 5,
          fabric: meta?.material ?? null,
          fit: meta?.fit_type ?? null,
          season: meta?.season_tags ?? [],
          occasion: meta?.occasions ?? [],
          tags: meta?.style_aesthetic ?? [],
          colorNames: meta ? [meta.primary_color_name] : [],

          // Weather/season
          suitableTempMinC: meta?.suitable_temp_min_c ?? null,
          suitableTempMaxC: meta?.suitable_temp_max_c ?? null,
          weatherTags: meta?.weather_tags ?? [],
          styleAesthetic: meta?.style_aesthetic ?? [],
          brand: meta?.brand ?? null,

          // LLM audit
          parseConfidence: meta?.confidence ?? null,
          parseModel: meta ? model : null,
          parseNotes: meta?.parse_notes ?? null,
          needsReview: state.needsReview || !meta,
          isActive: true,
        },
      });
      createdItemId = createdItem.id;

      // Increment the denormalized count (avoids COUNT() on every piano check)
      await tx.user.update({
        where: { id: toPrismaId("User", "id", state.userId) as never },
        data: { wardrobeItemCount: { increment: 1 } },
      });
    });

    return {
      wardrobeItemId: createdItemId === null ? null : String(createdItemId),
      status: "complete",
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Attempt to clean up the orphaned image from Supabase Storage
    if (state.storagePath && supabaseAdmin) {
      await supabaseAdmin.storage
        .from("wardrobe-images")
        .remove([state.storagePath])
        .catch(() => {
          // Non-fatal — log only
          console.error(
            `[persistItemNode] Failed to delete orphaned image: ${state.storagePath}`,
          );
        });
    }

    return {
      status: "failed",
      error: `Failed to save wardrobe item: ${message}`,
    };
  }
}
