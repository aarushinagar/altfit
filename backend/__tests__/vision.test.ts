/**
 * Vision tool unit tests
 *
 * Tests the validateWardrobeItemMetadata runtime validator and geminiVisionAnalyze
 * by mocking callGemini so no real API calls are made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the Gemini client before importing the module under test ──────────
vi.mock("@/backend/langgraph/llm/client", () => ({
  callGemini: vi.fn(),
  retryWithBackoff: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock("@/backend/langgraph/shared/models", () => ({
  getModelForTask: vi.fn(() => "gemini-2.5-flash-lite"),
}));

import { geminiVisionAnalyze } from "@/backend/langgraph/tools/vision";
import { callGemini } from "@/backend/langgraph/llm/client";

// ─────────────────────────────────────────────────────────────────────────────
// Full valid LLM item payload
// ─────────────────────────────────────────────────────────────────────────────

function makeValidItem(overrides: Record<string, unknown> = {}) {
  return {
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
    season_tags: ["summer"],
    style_aesthetic: ["minimalist"],
    brand: null,
    confidence: 0.92,
    parse_notes: null,
    display_hint: "The white t-shirt",
    ...overrides,
  };
}

// Mock fetch for geminiVisionAnalyze (it fetches the image before calling Gemini)
function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (key: string) => (key === "content-type" ? "image/webp" : null),
      },
      arrayBuffer: async () => new ArrayBuffer(1024),
    } as unknown as Response),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// geminiVisionAnalyze
// ─────────────────────────────────────────────────────────────────────────────

describe("geminiVisionAnalyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  it("returns the validated items array from Gemini", async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({
      items: [makeValidItem()],
    });

    const result = await geminiVisionAnalyze("https://example.com/img.webp");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe("top");
    expect(result.items[0].subcategory).toBe("t-shirt");
    expect(result.modelUsed).toBe("gemini-2.5-flash-lite");
  });

  it("handles multi-item response (3 pieces in one photo)", async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({
      items: [
        makeValidItem({ category: "top" }),
        makeValidItem({
          category: "bottom",
          subcategory: "jeans",
          display_hint: "The dark jeans",
        }),
        makeValidItem({
          category: "footwear",
          subcategory: "sneakers",
          display_hint: "The white sneakers",
        }),
      ],
    });

    const result = await geminiVisionAnalyze("https://example.com/outfit.webp");

    expect(result.items).toHaveLength(3);
    expect(result.items.map((i) => i.category)).toEqual([
      "top",
      "bottom",
      "footwear",
    ]);
  });

  it("passes the retryHint into the prompt (callGemini receives it)", async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({ items: [makeValidItem()] });

    await geminiVisionAnalyze(
      "https://example.com/img.webp",
      "Be more precise",
    );

    const calledPrompt = (
      vi.mocked(callGemini).mock.calls[0][0] as { prompt: string }
    ).prompt;
    expect(calledPrompt).toContain("Be more precise");
  });

  it("throws when Gemini returns an empty items array", async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({ items: [] });

    await expect(
      geminiVisionAnalyze("https://example.com/img.webp"),
    ).rejects.toThrow(/no items/i);
  });

  it("throws when items is missing from the response", async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({ outfit: [] });

    await expect(
      geminiVisionAnalyze("https://example.com/img.webp"),
    ).rejects.toThrow(/no items/i);
  });

  it("throws when fetch fails to retrieve the image", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as unknown as Response);

    await expect(
      geminiVisionAnalyze("https://example.com/private.webp"),
    ).rejects.toThrow(/403/);
  });

  it("propagates item validation errors with clear item index info", async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({
      items: [
        makeValidItem(), // valid
        makeValidItem({ category: "INVALID_CATEGORY" }), // invalid
      ],
    });

    await expect(
      geminiVisionAnalyze("https://example.com/img.webp"),
    ).rejects.toThrow(/Item 2 failed validation/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateWardrobeItemMetadata (tested indirectly via geminiVisionAnalyze)
// ─────────────────────────────────────────────────────────────────────────────

describe("validateWardrobeItemMetadata (via geminiVisionAnalyze)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  const cases: [string, Record<string, unknown>][] = [
    ["invalid category", { category: "shoes" }],
    ["missing subcategory", { subcategory: "" }],
    ["missing primary_color_name", { primary_color_name: "" }],
    ["invalid primary_color_hex", { primary_color_hex: "red" }],
    ["invalid color_pattern", { color_pattern: "zebra" }],
    ["invalid fit_type", { fit_type: "baggy" }],
    ["invalid weight", { weight: "extra_heavy" }],
    ["invalid formality", { formality: "semi_formal" }],
    ["non-number suitable_temp_min_c", { suitable_temp_min_c: "warm" }],
    ["non-array season_tags", { season_tags: "summer" }],
    ["confidence out of range", { confidence: 1.5 }],
  ];

  it.each(cases)("throws when %s is provided", async (_label, override) => {
    vi.mocked(callGemini).mockResolvedValueOnce({
      items: [makeValidItem(override)],
    });

    await expect(
      geminiVisionAnalyze("https://example.com/img.webp"),
    ).rejects.toThrow();
  });

  it("accepts valid hex secondary_color_hex", async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({
      items: [makeValidItem({ secondary_color_hex: "#1A2B3C" })],
    });

    const result = await geminiVisionAnalyze("https://example.com/img.webp");
    expect(result.items[0].secondary_color_hex).toBe("#1A2B3C");
  });

  it("accepts null secondary_color_hex", async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({
      items: [makeValidItem({ secondary_color_hex: null })],
    });

    const result = await geminiVisionAnalyze("https://example.com/img.webp");
    expect(result.items[0].secondary_color_hex).toBeNull();
  });

  it("preserves display_hint from the LLM output", async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({
      items: [makeValidItem({ display_hint: "The navy blazer" })],
    });

    const result = await geminiVisionAnalyze("https://example.com/img.webp");
    expect(result.items[0].display_hint).toBe("The navy blazer");
  });
});
