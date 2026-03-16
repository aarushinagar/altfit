/**
 * Gemini LLM Client
 *
 * Single place where GoogleGenerativeAI is instantiated.
 * All pipeline nodes call callGemini() — never instantiate the client directly.
 *
 * Validation: LLM output is checked against the expected interface shape
 * using a plain TypeScript validator function passed by the caller.
 * No Zod — validation is runtime type-checking with informative errors.
 */

import { GoogleGenerativeAI, type Schema } from "@google/generative-ai";
import { GEMINI_GENERATION_DEFAULTS } from "../shared/models";

// Singleton Gemini client — created once at module load
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Validates that `value` is a non-null object.
 * Deeper field validation happens in the caller's validator fn.
 */
function assertObject(
  value: unknown,
  context: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`[${context}] Expected JSON object, got: ${typeof value}`);
  }
}

/**
 * Strips markdown code fences from LLM output.
 * Defense-in-depth: responseSchema should prevent fences, but just in case.
 */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

export interface CallGeminiOptions {
  /** The model to call — use getModelForTask() from shared/models.ts */
  model: string;
  /** The prompt text (system + user combined) */
  prompt: string;
  /**
   * Gemini-native response schema for structured JSON output.
   * Providing this eliminates markdown fences from the response.
   */
  responseSchema: Schema;
  /** Optional base64-encoded image for vision tasks */
  imageBase64?: string;
  /** MIME type of the image. Defaults to "image/webp". */
  imageMimeType?: string;
}

/**
 * Calls Gemini with a structured JSON response schema.
 * Returns the parsed JSON object — caller is responsible for type assertion.
 *
 * Throws on:
 * - API errors (network, quota, auth)
 * - JSON parse failures
 * - Gemini returning a non-object response
 */
export async function callGemini(
  options: CallGeminiOptions,
): Promise<Record<string, unknown>> {
  const {
    model,
    prompt,
    responseSchema,
    imageBase64,
    imageMimeType = "image/webp",
  } = options;

  const geminiModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      ...GEMINI_GENERATION_DEFAULTS,
      responseSchema,
    },
  });

  const parts: (string | { inlineData: { mimeType: string; data: string } })[] =
    [prompt];
  if (imageBase64) {
    parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
  }

  const result = await geminiModel.generateContent(parts);
  const text = result.response.text();
  const cleaned = stripCodeFences(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `[callGemini] JSON parse failed for model=${model}. Raw: ${cleaned.slice(0, 200)}`,
    );
  }

  assertObject(parsed, "callGemini");
  return parsed;
}

/**
 * Retries a function with exponential backoff on HTTP 429 (rate limit).
 * Used around callGemini() calls in pipeline nodes.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 2200,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = (err as { status?: number }).status === 429;
      if (!is429 || attempt === maxAttempts) throw err;
      await new Promise((res) => setTimeout(res, baseDelayMs * attempt));
    }
  }
  // Unreachable but TypeScript requires it
  throw new Error("retryWithBackoff: exhausted attempts");
}
