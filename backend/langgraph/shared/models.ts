/**
 * Model Configuration
 *
 * Central registry for all LLM providers and models.
 * To add a new model: extend the relevant block below.
 * To switch which model runs a task: change the env var, no code change needed.
 *
 * Env var overrides:
 *   GEMINI_VISION_MODEL     — wardrobe item image analysis
 *   GEMINI_CURATION_MODEL   — outfit curation calls
 *   GEMINI_WEATHER_MODEL    — weather interpretation
 *   LLM_PROVIDER            — "gemini" (default) | "anthropic"
 */

// ── Available model IDs ────────────────────────────────────────────────────

export const GEMINI_MODELS = {
  /** Best balance of speed / cost / quality for structured tasks */
  FLASH_LITE: "gemini-2.5-flash-lite",
  /** Higher quality, slower, more expensive */
  FLASH: "gemini-2.5-flash",
  /** Top-tier — complex multi-step reasoning (future) */
  PRO: "gemini-2.5-pro",
} as const;

export const ANTHROPIC_MODELS = {
  SONNET: "claude-sonnet-4-6",
  HAIKU: "claude-haiku-3-5",
} as const;

// ── Task → model mapping ───────────────────────────────────────────────────

/**
 * Each pipeline task declares which model it uses.
 * Env vars override at runtime without code changes.
 */
export const TASK_MODEL_CONFIG = {
  /** Image analysis during ingestion (must support inline image data). */
  visionAnalysis: process.env.GEMINI_VISION_MODEL ?? GEMINI_MODELS.FLASH_LITE,
  /** Weather data → dressing context interpretation. Text-only, cheap. */
  weatherInterpret:
    process.env.GEMINI_WEATHER_MODEL ?? GEMINI_MODELS.FLASH_LITE,
  /** Main stylist LLM: candidates + weather → 3 outfit slots. */
  outfitCuration: process.env.GEMINI_CURATION_MODEL ?? GEMINI_MODELS.FLASH_LITE,
} as const;

export type TaskName = keyof typeof TASK_MODEL_CONFIG;

/** Returns the configured model ID for a pipeline task. */
export function getModelForTask(task: TaskName): string {
  return TASK_MODEL_CONFIG[task];
}

// ── Provider detection ─────────────────────────────────────────────────────

export type LLMProviderName = "gemini" | "anthropic";

/** Active provider — only Gemini is wired for current AI tasks. */
export const ACTIVE_PROVIDER: LLMProviderName =
  (process.env.LLM_PROVIDER as LLMProviderName | undefined) ?? "gemini";

/** Shared generation config applied to all Gemini calls via callGemini(). */
export const GEMINI_GENERATION_DEFAULTS = {
  /** Forces JSON output — eliminates the markdown fence bug. */
  responseMimeType: "application/json" as const,
  temperature: 0.2,
  topP: 0.8,
} as const;
