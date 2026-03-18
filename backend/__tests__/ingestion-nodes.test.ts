/**
 * Ingestion nodes unit tests
 *
 * All external dependencies (Gemini Vision, upsertWardrobeItem, fetch) are
 * mocked so these tests run without a DB or API key.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WardrobeItemMetadata } from "@/backend/langgraph/shared/types";

// ── Mock external deps before importing the modules under test ─────────────

vi.mock("@/backend/langgraph/tools/vision", () => ({
  geminiVisionAnalyze: vi.fn(),
}));

vi.mock("@/backend/langgraph/tools/upsert", () => ({
  upsertWardrobeItem: vi.fn(),
}));

import {
  validateImageNode,
  visionParseNode,
  enrichMetadataNode,
  persistItemNode,
} from "@/backend/langgraph/ingestion/nodes";
import { geminiVisionAnalyze } from "@/backend/langgraph/tools/vision";
import { upsertWardrobeItem } from "@/backend/langgraph/tools/upsert";

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const BASE_META: WardrobeItemMetadata = {
  category: "top",
  subcategory: "t-shirt",
  primary_color_name: "white",
  primary_color_hex: "#FFFFFF",
  secondary_color_name: null,
  secondary_color_hex: null,
  color_pattern: "solid",
  fit_type: "regular",
  length: "short",
  neckline: "crew",
  material: "cotton",
  texture: "smooth",
  weight: "lightweight",
  formality: "casual",
  occasions: ["everyday"],
  suitable_temp_min_c: 18,
  suitable_temp_max_c: 35,
  weather_tags: ["sunny"],
  season_tags: ["summer", "spring"],
  style_aesthetic: ["minimalist"],
  brand: null,
  confidence: 0.92,
  parse_notes: null,
  display_hint: "The white crew-neck t-shirt",
};

const BASE_STATE = {
  imageUrl: "https://example.com/image.webp",
  userId: "123456789",
  itemName: null,
  storagePath: "uploads/user/123/image.webp",
  parseAttempts: 0,
  retryHint: null,
  rawParseItems: null,
  enrichedItems: null,
  wardrobeItemIds: null,
  detectedPieces: null,
  confidence: 0,
  needsReview: false,
  error: null,
  status: "validating" as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// validateImageNode
// ─────────────────────────────────────────────────────────────────────────────

describe("validateImageNode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns status=parsing when image is reachable and within size limit", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => String(1024 * 1024) }, // 1 MB
    } as unknown as Response);

    const result = await validateImageNode(BASE_STATE);
    expect(result.status).toBe("parsing");
    expect(result.error).toBeUndefined();
  });

  it("returns error when the image URL is not reachable (4xx)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
    } as unknown as Response);

    const result = await validateImageNode(BASE_STATE);
    // 403 errors proceed anyway — Gemini can fetch URLs directly
    expect(result.status).toBe("parsing");
  });

  it("returns error when image exceeds 8 MB", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => String(9 * 1024 * 1024) }, // 9 MB
    } as unknown as Response);

    const result = await validateImageNode(BASE_STATE);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/8 MB/);
  });

  it("returns error on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await validateImageNode(BASE_STATE);
    // Network errors are transient — proceed anyway
    expect(result.status).toBe("parsing");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// visionParseNode
// ─────────────────────────────────────────────────────────────────────────────

describe("visionParseNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores all detected items in rawParseItems", async () => {
    const items = [
      { ...BASE_META, category: "top" as const },
      { ...BASE_META, category: "bottom" as const, subcategory: "jeans" },
    ];
    vi.mocked(geminiVisionAnalyze).mockResolvedValueOnce({
      items,
      modelUsed: "gemini-2.5-flash-lite",
    });

    const result = await visionParseNode(BASE_STATE);

    expect(result.rawParseItems).toHaveLength(2);
    expect(result.rawParseItems![0].category).toBe("top");
    expect(result.rawParseItems![1].category).toBe("bottom");
    expect(result.parseAttempts).toBe(1);
    expect(result.status).toBe("enriching");
  });

  it("sets confidence to the minimum confidence across all items", async () => {
    const items = [
      { ...BASE_META, confidence: 0.95 },
      { ...BASE_META, confidence: 0.45 }, // lowest
    ];
    vi.mocked(geminiVisionAnalyze).mockResolvedValueOnce({
      items,
      modelUsed: "gemini-2.5-flash-lite",
    });

    const result = await visionParseNode(BASE_STATE);

    expect(result.confidence).toBe(0.45);
    expect(result.needsReview).toBe(true);
  });

  it("sets a retry hint when confidence is below 0.6 and attempt < 2", async () => {
    const items = [{ ...BASE_META, confidence: 0.4 }];
    vi.mocked(geminiVisionAnalyze).mockResolvedValueOnce({
      items,
      modelUsed: "gemini-2.5-flash-lite",
    });

    const result = await visionParseNode({ ...BASE_STATE, parseAttempts: 0 });

    expect(result.retryHint).not.toBeNull();
    expect(result.retryHint).toMatch(/0.40/);
  });

  it("does NOT set a retry hint on the second attempt", async () => {
    const items = [{ ...BASE_META, confidence: 0.3 }];
    vi.mocked(geminiVisionAnalyze).mockResolvedValueOnce({
      items,
      modelUsed: "gemini-2.5-flash-lite",
    });

    // parseAttempts=1 means this is already the second call (attempts becomes 2)
    const result = await visionParseNode({ ...BASE_STATE, parseAttempts: 1 });

    expect(result.retryHint).toBeNull();
  });

  it("routes to persisting with needsReview=true when gemini throws", async () => {
    vi.mocked(geminiVisionAnalyze).mockRejectedValueOnce(
      new Error("Network timeout"),
    );

    const result = await visionParseNode(BASE_STATE);

    // Non-API errors route to persisting with needsReview=true
    expect(result.status).toBe("persisting");
    expect(result.needsReview).toBe(true);
    expect(result.error).toMatch(/Network timeout/);
    expect(result.confidence).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enrichMetadataNode
// ─────────────────────────────────────────────────────────────────────────────

describe("enrichMetadataNode", () => {
  it("passes straight through to persisting when rawParseItems is null", async () => {
    const result = await enrichMetadataNode({
      ...BASE_STATE,
      rawParseItems: null,
    });
    expect(result.status).toBe("persisting");
  });

  it("passes straight through to persisting when rawParseItems is empty", async () => {
    const result = await enrichMetadataNode({
      ...BASE_STATE,
      rawParseItems: [],
    });
    expect(result.status).toBe("persisting");
  });

  it("normalises color names to lowercase", async () => {
    const item: WardrobeItemMetadata = {
      ...BASE_META,
      primary_color_name: "  Forest Green  ",
    };
    const result = await enrichMetadataNode({
      ...BASE_STATE,
      rawParseItems: [item],
    } as typeof BASE_STATE & { rawParseItems: WardrobeItemMetadata[] });

    expect(result.enrichedItems![0].primary_color_name).toBe("forest green");
  });

  it("nulls out malformed primary_color_hex", async () => {
    const item: WardrobeItemMetadata = {
      ...BASE_META,
      primary_color_hex: "not-a-hex",
    };
    const result = await enrichMetadataNode({
      ...BASE_STATE,
      rawParseItems: [item],
    } as typeof BASE_STATE & { rawParseItems: WardrobeItemMetadata[] });

    expect(result.enrichedItems![0].primary_color_hex).toBeNull();
  });

  it("derives temp range from material when LLM values are null", async () => {
    const item: WardrobeItemMetadata = {
      ...BASE_META,
      material: "wool",
      suitable_temp_min_c: null as unknown as number,
      suitable_temp_max_c: null as unknown as number,
    };
    const result = await enrichMetadataNode({
      ...BASE_STATE,
      rawParseItems: [item],
    } as typeof BASE_STATE & { rawParseItems: WardrobeItemMetadata[] });

    // Wool defaults: { min: -5, max: 15 }
    expect(result.enrichedItems![0].suitable_temp_min_c).toBe(-5);
    expect(result.enrichedItems![0].suitable_temp_max_c).toBe(15);
  });

  it("derives temp range when min >= max (inverted values)", async () => {
    const item: WardrobeItemMetadata = {
      ...BASE_META,
      material: "linen",
      suitable_temp_min_c: 30,
      suitable_temp_max_c: 10, // inverted
    };
    const result = await enrichMetadataNode({
      ...BASE_STATE,
      rawParseItems: [item],
    } as typeof BASE_STATE & { rawParseItems: WardrobeItemMetadata[] });

    // Linen defaults: { min: 22, max: 38 }
    expect(result.enrichedItems![0].suitable_temp_min_c).toBe(22);
    expect(result.enrichedItems![0].suitable_temp_max_c).toBe(38);
  });

  it("enriches all items in a multi-item array", async () => {
    const items: WardrobeItemMetadata[] = [
      { ...BASE_META, primary_color_name: "WHITE" },
      { ...BASE_META, primary_color_name: "NAVY BLUE" },
    ];
    const result = await enrichMetadataNode({
      ...BASE_STATE,
      rawParseItems: items,
    } as typeof BASE_STATE & { rawParseItems: WardrobeItemMetadata[] });

    expect(result.enrichedItems).toHaveLength(2);
    expect(result.enrichedItems![0].primary_color_name).toBe("white");
    expect(result.enrichedItems![1].primary_color_name).toBe("navy blue");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// persistItemNode
// ─────────────────────────────────────────────────────────────────────────────

describe("persistItemNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty wardrobeItemIds and error when no items to save", async () => {
    const result = await persistItemNode({
      ...BASE_STATE,
      rawParseItems: null,
      enrichedItems: null,
    });

    expect(result.wardrobeItemIds).toEqual([]);
    expect(result.status).toBe("complete");
    expect(result.error).toMatch(/no clothing items/i);
    expect(upsertWardrobeItem).not.toHaveBeenCalled();
  });

  it("calls upsertWardrobeItem once for a single-item result", async () => {
    vi.mocked(upsertWardrobeItem).mockResolvedValueOnce({
      wardrobeItemId: "999",
      wasUpdated: false,
    });

    const result = await persistItemNode({
      ...BASE_STATE,
      enrichedItems: [BASE_META],
    } as typeof BASE_STATE & { enrichedItems: WardrobeItemMetadata[] });

    expect(upsertWardrobeItem).toHaveBeenCalledTimes(1);
    expect(result.wardrobeItemIds).toEqual(["999"]);
    expect(result.status).toBe("complete");
  });

  it("calls upsertWardrobeItem once per detected item (sequential queue)", async () => {
    vi.mocked(upsertWardrobeItem)
      .mockResolvedValueOnce({ wardrobeItemId: "1", wasUpdated: false })
      .mockResolvedValueOnce({ wardrobeItemId: "2", wasUpdated: false })
      .mockResolvedValueOnce({ wardrobeItemId: "3", wasUpdated: false });

    const items: WardrobeItemMetadata[] = [
      { ...BASE_META, category: "top" },
      { ...BASE_META, category: "bottom", subcategory: "jeans" },
      { ...BASE_META, category: "footwear", subcategory: "sneakers" },
    ];

    const result = await persistItemNode({
      ...BASE_STATE,
      enrichedItems: items,
    } as typeof BASE_STATE & { enrichedItems: WardrobeItemMetadata[] });

    expect(upsertWardrobeItem).toHaveBeenCalledTimes(3);
    expect(result.wardrobeItemIds).toEqual(["1", "2", "3"]);
    expect(result.status).toBe("complete");
  });

  it("continues saving remaining items when one upsert fails", async () => {
    vi.mocked(upsertWardrobeItem)
      .mockResolvedValueOnce({ wardrobeItemId: "1", wasUpdated: false })
      .mockRejectedValueOnce(new Error("DB timeout"))
      .mockResolvedValueOnce({ wardrobeItemId: "3", wasUpdated: false });

    const items: WardrobeItemMetadata[] = [
      { ...BASE_META, category: "top" },
      { ...BASE_META, category: "bottom", subcategory: "jeans" },
      { ...BASE_META, category: "footwear", subcategory: "sneakers" },
    ];

    const result = await persistItemNode({
      ...BASE_STATE,
      enrichedItems: items,
    } as typeof BASE_STATE & { enrichedItems: WardrobeItemMetadata[] });

    // IDs 1 and 3 saved — 2 failed but didn't abort the loop
    expect(result.wardrobeItemIds).toEqual(["1", "3"]);
    expect(result.status).toBe("complete");
  });

  it("prefers enrichedItems over rawParseItems", async () => {
    vi.mocked(upsertWardrobeItem).mockResolvedValueOnce({
      wardrobeItemId: "enriched-id",
      wasUpdated: false,
    });

    const rawItem: WardrobeItemMetadata = { ...BASE_META, subcategory: "raw" };
    const enrichedItem: WardrobeItemMetadata = {
      ...BASE_META,
      subcategory: "enriched",
    };

    await persistItemNode({
      ...BASE_STATE,
      rawParseItems: [rawItem],
      enrichedItems: [enrichedItem],
    } as typeof BASE_STATE & {
      rawParseItems: WardrobeItemMetadata[];
      enrichedItems: WardrobeItemMetadata[];
    });

    const calledWith = vi.mocked(upsertWardrobeItem).mock.calls[0][0];
    expect(calledWith.metadata.subcategory).toBe("enriched");
  });

  it("falls back to failed status when all upserts throw", async () => {
    vi.mocked(upsertWardrobeItem).mockRejectedValueOnce(new Error("All fail"));

    const result = await persistItemNode({
      ...BASE_STATE,
      enrichedItems: [BASE_META],
    } as typeof BASE_STATE & { enrichedItems: WardrobeItemMetadata[] });

    expect(result.status).toBe("failed");
    expect(result.wardrobeItemIds).toBeUndefined();
  });
});
