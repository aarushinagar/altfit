/**
 * Outfit Regeneration Configuration
 *
 * Controls how outfit slot regenerations work for free vs pro users.
 * This is the single source of truth — serialized into LangGraph curation state.
 */
export const REGEN_CONFIG = {
  // ── Free Tier ────────────────────────────────────────────────
  /** Max regenerations per local calendar day for free users. [PROD: 1] */
  freeRegenPerDay: 1,
  /** Which slots can be regenerated on free tier. [PROD: "any"] */
  freeRegenSlotConstraint: "any" as "any" | "last",

  // ── Pro Tier ─────────────────────────────────────────────────
  /** Max regenerations per local calendar day for pro users. [PROD: 5] */
  proRegenPerDay: 5,

  // ── Item Reuse Policy ────────────────────────────────────────
  /**
   * Allow items from OTHER slots to appear in the regenerated slot?
   * [PROD: true]
   */
  allowCrossSlotItemReuse: true,
  /**
   * Allow partial overlap between old and new slot items?
   * false = new slot must be 100% different.  [PROD: false]
   */
  allowPartialSlotOverlap: false,
  /** Minimum number of items that must change. Only used when allowPartialSlotOverlap=true. */
  minItemsChanged: 1,

  // ── Candidate Pool ───────────────────────────────────────────
  /**
   * Which item IDs to exclude from the candidate pool when regenerating.
   * "replaced_slot" = exclude only the slot being replaced.  [PROD: "replaced_slot"]
   */
  excludeFromPool: "replaced_slot" as "none" | "replaced_slot" | "all_slots",

  // ── Diversity ────────────────────────────────────────────────
  /**
   * Tell the LLM to pick a vibe distinct from the other two slots.
   * [PROD: true]
   */
  enforceDistinctVibe: true,
} as const;

export type RegenConfig = typeof REGEN_CONFIG;

/** Returns the daily regen limit for the given plan. */
export function getMaxRegenForPlan(plan: string): number {
  return plan === "pro"
    ? REGEN_CONFIG.proRegenPerDay
    : REGEN_CONFIG.freeRegenPerDay;
}
// ── Wardrobe item cap ─────────────────────────────────────────────────────

/** Maximum wardrobe items allowed on the free plan. */
export const FREE_WARDROBE_LIMIT = 10;

/**
 * Returns true when the user has reached (or exceeded) the wardrobe item
 * cap for their plan.  Pro users have no enforced cap.
 */
export function isWardrobeCapExceeded(
  plan: string,
  itemCount: number,
): boolean {
  return plan !== "pro" && itemCount >= FREE_WARDROBE_LIMIT;
}
