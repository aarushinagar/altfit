import { describe, it, expect } from "vitest";
import {
  REGEN_CONFIG,
  getMaxRegenForPlan,
  isWardrobeCapExceeded,
  FREE_WARDROBE_LIMIT,
} from "@/backend/langgraph/shared/regen";

describe("REGEN_CONFIG", () => {
  it("free tier allows 1 regen per day", () => {
    expect(REGEN_CONFIG.freeRegenPerDay).toBe(1);
  });

  it("pro tier allows 5 regens per day", () => {
    expect(REGEN_CONFIG.proRegenPerDay).toBe(5);
  });

  it("enforces distinct vibe by default", () => {
    expect(REGEN_CONFIG.enforceDistinctVibe).toBe(true);
  });

  it("excludes only the replaced slot from candidate pool", () => {
    expect(REGEN_CONFIG.excludeFromPool).toBe("replaced_slot");
  });
});

describe("getMaxRegenForPlan", () => {
  it("returns proRegenPerDay for 'pro' plan", () => {
    expect(getMaxRegenForPlan("pro")).toBe(REGEN_CONFIG.proRegenPerDay);
  });

  it("returns freeRegenPerDay for 'free' plan", () => {
    expect(getMaxRegenForPlan("free")).toBe(REGEN_CONFIG.freeRegenPerDay);
  });

  it("returns freeRegenPerDay for unrecognised plan strings", () => {
    expect(getMaxRegenForPlan("enterprise")).toBe(REGEN_CONFIG.freeRegenPerDay);
    expect(getMaxRegenForPlan("")).toBe(REGEN_CONFIG.freeRegenPerDay);
  });

  it("is case-sensitive — 'Pro' is not treated as pro", () => {
    expect(getMaxRegenForPlan("Pro")).toBe(REGEN_CONFIG.freeRegenPerDay);
  });
});

describe("FREE_WARDROBE_LIMIT", () => {
  it("is 10", () => {
    expect(FREE_WARDROBE_LIMIT).toBe(10);
  });
});

describe("isWardrobeCapExceeded", () => {
  it("returns false when count is below the limit on free plan", () => {
    expect(isWardrobeCapExceeded("free", 0)).toBe(false);
    expect(isWardrobeCapExceeded("free", 9)).toBe(false);
  });

  it("returns true when count equals the limit on free plan", () => {
    expect(isWardrobeCapExceeded("free", 10)).toBe(true);
  });

  it("returns true when count exceeds the limit on free plan", () => {
    expect(isWardrobeCapExceeded("free", 11)).toBe(true);
    expect(isWardrobeCapExceeded("free", 100)).toBe(true);
  });

  it("always returns false for pro plan regardless of count", () => {
    expect(isWardrobeCapExceeded("pro", 0)).toBe(false);
    expect(isWardrobeCapExceeded("pro", 10)).toBe(false);
    expect(isWardrobeCapExceeded("pro", 999)).toBe(false);
  });

  it("treats unrecognised plan strings as non-pro (cap applies)", () => {
    expect(isWardrobeCapExceeded("enterprise", 10)).toBe(true);
    expect(isWardrobeCapExceeded("", 10)).toBe(true);
  });
});
