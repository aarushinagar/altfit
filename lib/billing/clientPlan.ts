export type ClientPlan = "pro" | null;

/**
 * Normalizes billing/access values into the single client-side tier that the
 * app uses for paywall and feature gating.
 */
export function toClientPlan(value: unknown): ClientPlan {
  return value === "pro" || value === "monthly" || value === "yearly"
    ? "pro"
    : null;
}

export function isProPlan(value: unknown): boolean {
  return toClientPlan(value) === "pro";
}

export function getPlanLabel(value: unknown): string {
  return isProPlan(value) ? "Pro plan" : "Free plan";
}
