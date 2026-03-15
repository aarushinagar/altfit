import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || "",
);

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest",
});

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRetryable =
        (err as { status?: number; message?: string })?.status === 429 ||
        (err as { message?: string })?.message?.includes("rate") ||
        (err as { message?: string })?.message?.includes("429");
      if (isRetryable && attempt < retries - 1) {
        attempt++;
        await new Promise((r) => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
}

export function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}
