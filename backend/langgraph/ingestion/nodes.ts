/**
 * Ingestion Pipeline — Nodes
 *
 * Four pure async functions, each receiving and returning partial state.
 *
 * Node execution order (see graph.ts):
 *   validate_image → vision_parse (→ retry on low confidence) → enrich_metadata → persist_item
 *
 * Multi-item: a single photo may yield several clothing pieces. Each piece is
 * persisted as a separate WardrobeItem. Items within one graph run are processed
 * sequentially (queue behaviour) to avoid concurrent DB writes.
 */

import { geminiVisionAnalyze } from "../tools/vision";
import { upsertWardrobeItem } from "../tools/upsert";
import type { IngestionState } from "./state";
import type { WardrobeItemMetadata, DetectedPiece } from "../shared/types";

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
 * Validates the image URL before running vision analysis.
 *
 * HEAD-checks for size if possible, but does NOT abort on fetch errors:
 * - 403/404: bucket may have no public-read policy — the upload may still be
 *   valid and Gemini can fetch it with its own auth. Continue.
 * - Network errors: transient — continue and let Gemini decide.
 * Only hard-abort if the URL is obviously malformed (not https://).
 */
export async function validateImageNode(
  state: IngestionState,
): Promise<Partial<IngestionState>> {
  const { imageUrl } = state;

  // Guard: imageUrl must be a real https:// URL
  if (!imageUrl || !imageUrl.startsWith("https://")) {
    return {
      status: "failed",
      error: `Invalid image URL "${(imageUrl ?? "").slice(0, 80)}". Must be a public https:// Supabase CDN URL.`,
    };
  }

  try {
    const res = await fetch(imageUrl, { method: "HEAD" });

    if (res.ok) {
      // Check size only when the server tells us
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
    }

    // 403 / 404 → bucket is private or file path is odd;
    // still let Gemini try — it fetches URLs directly.
    console.warn(
      `[IngestionGraph] validate_image: HEAD returned ${res.status} for ${imageUrl} — proceeding anyway`,
    );
    return { status: "parsing" };
  } catch (err) {
    // Network error on HEAD — non-fatal, proceed
    console.warn(
      `[IngestionGraph] validate_image: HEAD failed (${err instanceof Error ? err.message : String(err)}) — proceeding anyway`,
    );
    return { status: "parsing" };
  }
}

// ── Node 2: visionParseNode ────────────────────────────────────────────────

/**
 * Calls Gemini Vision to analyse the wardrobe item image.
 * Returns ALL clothing pieces found in the photo as rawParseItems[].
 * On low confidence (min across all items < 0.6), sets a retry hint for a
 * second attempt. On error, marks needsReview=true so persist still runs.
 */
export async function visionParseNode(
  state: IngestionState,
): Promise<Partial<IngestionState>> {
  const attempts = state.parseAttempts + 1;

  try {
    const result = await geminiVisionAnalyze(
      state.imageUrl,
      state.retryHint ?? "",
    );

    // Use the lowest confidence across all detected items to drive retry logic
    const minConfidence =
      result.items.length > 0
        ? Math.min(...result.items.map((i) => i.confidence))
        : 0;
    const lowConfidence = minConfidence < 0.6;

    const hint =
      lowConfidence && attempts < 2
        ? `Previous attempt returned minimum confidence ${minConfidence.toFixed(2)} across ${result.items.length} item(s). ` +
        `Please be more precise about category, color, and material for each piece.`
        : null;

    console.log(
      `[IngestionGraph] vision_parse attempt ${attempts}: detected ${result.items.length} item(s), min confidence ${minConfidence.toFixed(2)}`,
    );

    return {
      parseAttempts: attempts,
      rawParseItems: result.items,
      confidence: minConfidence,
      retryHint: hint,
      needsReview: lowConfidence,
      status: "enriching",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[IngestionGraph] vision_parse failed (attempt ${attempts}):`,
      message,
    );

    // Quota / API errors should surface to the user directly instead of
    // silently continuing to persistItemNode with null items (which produces
    // the misleading "no clothing items" message).
    const isQuota = /429|quota|rate.?limit/i.test(message);
    const isApiError = /400|401|403|500|GoogleGenerativeAI/i.test(message);
    if (isQuota) {
      return {
        parseAttempts: attempts,
        status: "failed",
        error:
          "AI quota exceeded — please wait a moment and try again.",
      };
    }
    if (isApiError) {
      return {
        parseAttempts: attempts,
        status: "failed",
        error: `Vision analysis failed: ${message}`,
      };
    }

    // Non-API errors (e.g. the image was unreadable): mark for review but
    // still try to persist so the user gets partial data.
    return {
      parseAttempts: attempts,
      needsReview: true,
      confidence: 0,
      error: message,
      status: "persisting",
    };
  }
}

// ── Node 3: enrichMetadataNode ─────────────────────────────────────────────

/**
 * Normalises and enriches every item in rawParseItems before DB insertion.
 * - Trims / lowercases color names
 * - Validates hex format (nulls out invalid values)
 * - Derives temp range from material if the LLM left it null or reversed
 */
export async function enrichMetadataNode(
  state: IngestionState,
): Promise<Partial<IngestionState>> {
  if (!state.rawParseItems || state.rawParseItems.length === 0) {
    return { status: "persisting" };
  }

  const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

  const enrichedItems: WardrobeItemMetadata[] = state.rawParseItems.map(
    (raw) => {
      const primaryColorName =
        raw.primary_color_name?.trim().toLowerCase() ?? null;
      const secondaryColorName =
        raw.secondary_color_name?.trim().toLowerCase() ?? null;

      const primaryColorHex = HEX_RE.test(raw.primary_color_hex ?? "")
        ? raw.primary_color_hex
        : null;
      const secondaryColorHex =
        raw.secondary_color_hex && HEX_RE.test(raw.secondary_color_hex)
          ? raw.secondary_color_hex
          : null;

      let tempMin = raw.suitable_temp_min_c;
      let tempMax = raw.suitable_temp_max_c;
      if (tempMin == null || tempMax == null || tempMin >= tempMax) {
        const derived = deriveTempRange(raw.material ?? "");
        tempMin = derived.min;
        tempMax = derived.max;
      }

      return {
        ...raw,
        primary_color_name: primaryColorName ?? raw.primary_color_name,
        // If hex failed validation, store null rather than the malformed string
        primary_color_hex: primaryColorHex,
        secondary_color_name: secondaryColorName,
        secondary_color_hex: secondaryColorHex,
        suitable_temp_min_c: tempMin,
        suitable_temp_max_c: tempMax,
      };
    },
  );

  return { enrichedItems, status: "persisting" };
}

// ── Node 4: persistItemNode ────────────────────────────────────────────────

/**
 * Persists each detected clothing piece as a separate WardrobeItem.
 *
 * Items are processed one at a time (sequential queue) to avoid concurrent DB
 * writes from a single photo upload. Uses upsertWardrobeItem so re-analysing
 * the same image updates existing records rather than creating duplicates.
 *
 * Falls back to rawParseItems if enrichment was skipped (vision error path).
 */
export async function persistItemNode(
  state: IngestionState,
): Promise<Partial<IngestionState>> {
  const items = state.enrichedItems ?? state.rawParseItems;

  if (!items || items.length === 0) {
    console.warn(
      "[IngestionGraph] persist_item: no items to save — vision analysis returned nothing",
    );
    return {
      wardrobeItemIds: [],
      status: "complete",
      error: "Vision analysis detected no clothing items in the image.",
    };
  }

  console.log(
    `[IngestionGraph] persist_item: saving ${items.length} item(s) sequentially for user ${state.userId}`,
  );

  const wardrobeItemIds: string[] = [];
  const detectedPieces: DetectedPiece[] = [];

  // ── Sequential queue: process one item at a time ──────────────────────
  for (let i = 0; i < items.length; i++) {
    const meta = items[i];
    const itemLabel = `${meta.category}/${meta.subcategory ?? "?"}`;

    try {
      const itemName =
        meta.display_hint ??
        state.itemName ??
        meta.subcategory ??
        meta.category;

      const { wardrobeItemId, wasUpdated } = await upsertWardrobeItem({
        userId: state.userId,
        imageUrl: state.imageUrl,
        storagePath: state.storagePath ?? "",
        itemName,
        metadata: meta,
        needsReview: state.needsReview || meta.confidence < 0.6,
      });

      wardrobeItemIds.push(wardrobeItemId);
      detectedPieces.push({
        id: wardrobeItemId,
        category: meta.category,
        subcategory: meta.subcategory ?? meta.category,
        boundingBox: meta.boundingBox ?? null,
      });
      console.log(
        `[IngestionGraph] persist_item [${i + 1}/${items.length}] ${wasUpdated ? "updated" : "created"} ${itemLabel} → ${wardrobeItemId}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[IngestionGraph] persist_item [${i + 1}/${items.length}] FAILED for ${itemLabel}:`,
        message,
      );
      // Continue processing remaining items even if one fails
    }
  }

  if (wardrobeItemIds.length === 0) {
    return {
      status: "failed",
      error: `Failed to save any wardrobe items from this image.`,
    };
  }

  return {
    wardrobeItemIds,
    detectedPieces,
    status: "complete",
    error: null,
  };
}
