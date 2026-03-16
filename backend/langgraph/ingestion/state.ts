/**
 * Ingestion Pipeline — LangGraph State
 *
 * State shape for the wardrobe item ingestion graph.
 * Flows: validate_image → vision_parse (→ retry) → enrich_metadata → persist_item
 */

import { Annotation } from "@langchain/langgraph";
import type { WardrobeItemMetadata } from "../shared/types";

// Shared last-value reducer (replace with latest value)
function last<T>(_prev: T, next: T): T {
  return next;
}

export const IngestionAnnotation = Annotation.Root({
  // ── Inputs ──────────────────────────────────────────────────
  /** Public URL of the wardrobe item image (already uploaded to Supabase Storage) */
  imageUrl: Annotation<string>(),
  /** Authenticated user ID (Snowflake string) */
  userId: Annotation<string>(),
  /** Optional item name provided by the user */
  itemName: Annotation<string | null>({ reducer: last, default: () => null }),
  /** Supabase Storage path for cleanup on failure */
  storagePath: Annotation<string | null>({
    reducer: last,
    default: () => null,
  }),

  // ── Parse state ──────────────────────────────────────────────
  /** Number of vision parse attempts (incremented on retry) */
  parseAttempts: Annotation<number>({ reducer: last, default: () => 0 }),
  /** Retry hint injected into the prompt on the second attempt */
  retryHint: Annotation<string | null>({ reducer: last, default: () => null }),
  /** Raw validated output from Gemini Vision */
  rawParse: Annotation<WardrobeItemMetadata | null>({
    reducer: last,
    default: () => null,
  }),
  /** Parse confidence 0.0–1.0 (from rawParse.confidence) */
  confidence: Annotation<number>({ reducer: last, default: () => 0 }),

  // ── Enrich state ─────────────────────────────────────────────
  /** Normalised / enriched metadata ready for DB insertion */
  enrichedMetadata: Annotation<WardrobeItemMetadata | null>({
    reducer: last,
    default: () => null,
  }),

  // ── Outputs ──────────────────────────────────────────────────
  /** Prisma WardrobeItem.id on success, null on failure */
  wardrobeItemId: Annotation<string | null>({
    reducer: last,
    default: () => null,
  }),
  /** Flag set when the item needs human review (low confidence) */
  needsReview: Annotation<boolean>({ reducer: last, default: () => false }),
  /** Error message on any unrecoverable failure */
  error: Annotation<string | null>({ reducer: last, default: () => null }),
  /** Pipeline stage for debugging / logging */
  status: Annotation<
    | "validating"
    | "parsing"
    | "enriching"
    | "persisting"
    | "complete"
    | "failed"
  >({ reducer: last, default: () => "validating" as const }),
});

export type IngestionState = typeof IngestionAnnotation.State;
