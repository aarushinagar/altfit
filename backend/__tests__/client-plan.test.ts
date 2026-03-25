import { describe, it, expect } from "vitest";
import { FREE_WARDROBE_LIMIT } from "@/backend/langgraph/shared/regen";
import { FREE_LIMIT } from "@/lib/constants";
import {
  getPlanLabel,
  isProPlan,
  toClientPlan,
} from "@/lib/billing/clientPlan";

describe("toClientPlan", () => {
  it("normalizes pro billing/access values to the client pro tier", () => {
    expect(toClientPlan("pro")).toBe("pro");
    expect(toClientPlan("monthly")).toBe("pro");
    expect(toClientPlan("yearly")).toBe("pro");
  });

  it("treats free and unknown values as non-pro", () => {
    expect(toClientPlan("free")).toBeNull();
    expect(toClientPlan("enterprise")).toBeNull();
    expect(toClientPlan(null)).toBeNull();
  });
});

describe("isProPlan", () => {
  it("returns true only for values that map to pro access", () => {
    expect(isProPlan("pro")).toBe(true);
    expect(isProPlan("monthly")).toBe(true);
    expect(isProPlan("yearly")).toBe(true);
    expect(isProPlan("free")).toBe(false);
  });
});

describe("getPlanLabel", () => {
  it("renders a stable label for the nav/profile UI", () => {
    expect(getPlanLabel("pro")).toBe("Pro plan");
    expect(getPlanLabel("monthly")).toBe("Pro plan");
    expect(getPlanLabel(null)).toBe("Free plan");
  });
});

describe("free plan limits", () => {
  it("keeps client and server free-tier wardrobe caps aligned", () => {
    expect(FREE_LIMIT).toBe(FREE_WARDROBE_LIMIT);
  });
});
