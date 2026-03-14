import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-4-6";
export const MAX_TOKENS = 4096;

// Singleton client — never instantiate Anthropic in route files
const globalForAnthropic = globalThis as unknown as {
  anthropicClient: Anthropic | undefined;
};

export const anthropicClient =
  globalForAnthropic.anthropicClient ??
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropicClient = anthropicClient;
}

/**
 * Retry a Claude API call with linear backoff on 429s.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2200,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes("rate") ||
        err?.message?.includes("429");
      if (isRateLimit && attempt < retries - 1) {
        attempt++;
        await new Promise((r) => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Strip markdown code fences Claude sometimes wraps JSON in.
 */
export function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}
