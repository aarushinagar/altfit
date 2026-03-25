---
applyTo: "lib/llm/**,lib/tools/**,backend/langgraph/**"
---

# ALTFit — AI Clients

## Gemini (Primary AI — vision + curation)

**File:** `lib/llm/parse.ts` — singleton client + schema-validated wrapper

```typescript
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai";
import type { z } from "zod";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function callGeminiWithSchema<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  geminiSchema: Schema,
  imageBase64?: string,
): Promise<T>
```

- Import `callGeminiWithSchema` from `@/lib/llm/parse` in all LangGraph nodes that call Gemini
- Never instantiate `new GoogleGenerativeAI()` outside `lib/llm/parse.ts`
- Validate ALL LLM output with Zod before using it — never trust raw LLM JSON
- On validation failure: retry once with a correction hint appended to the prompt

## Anthropic (Secondary AI — kept for future use)

**File:** `lib/anthropic.ts` (create if needed)

```typescript
import Anthropic from "@anthropic-ai/sdk";
export const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const CLAUDE_MODEL = "claude-sonnet-4-6" as const;
export const MAX_TOKENS = 4096;
```

- Only use Anthropic for features that explicitly require it (e.g., complex reasoning)
- Current AI work (ingestion + curation) uses Gemini — not Anthropic

## Retry Pattern for Rate Limits

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 2200,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); }
    catch (err) {
      const is429 = (err as { status?: number }).status === 429;
      if (!is429 || attempt === maxAttempts) throw err;
      await new Promise(res => setTimeout(res, baseDelayMs * attempt));
    }
  }
  throw new Error("unreachable");
}
```

## LLM Output Safety

- Always `JSON.parse()` inside a try/catch — LLMs can return broken JSON
- Use `stripCodeFences(text)` before parsing: `.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`\s*$/i, "").trim()`
- Use Zod `.safeParse()` — never `.parse()` — to catch validation errors without throwing
