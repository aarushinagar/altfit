/**
 * POST /api/ai/classify
 *
 * Classify clothing items from an image (public endpoint, optional auth)
 *
 * Request body:
 * {
 *   "base64": "iVBORw0KGgoAAAANS...",  // base64 encoded image
 *   "mediaType": "image/jpeg"            // image/jpeg | image/png | image/gif | image/webp
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "name": "Blue T-Shirt",
 *         "category": "top",
 *         "colors": ["#3498db"],
 *         "colorNames": ["Blue"],
 *         "pattern": "Solid",
 *         "fabric": "Cotton",
 *         "fit": "Fitted",
 *         "formality": 3,
 *         "season": ["All-Season"],
 *         "occasion": ["Casual"],
 *         "stylistNote": "Perfect for everyday wear.",
 *         "tags": ["casual", "comfortable"]
 *       }
 *     ]
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";

// Max base64 payload: ~6.7MB (represents ≤5MB file)
const MAX_BASE64_BYTES = 7 * 1024 * 1024;

const VALID_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
type ValidMediaType = (typeof VALID_MEDIA_TYPES)[number];

function isValidMediaType(v: string): v is ValidMediaType {
  return (VALID_MEDIA_TYPES as readonly string[]).includes(v);
}

const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
const MAX_TOKENS = 1024;

function stripCodeFences(text: string): string {
  return text.replace(/^```json\n?|\n?```$/g, "").trim();
}

async function retryWithBackoff(
  fn: () => Promise<any>,
  maxRetries = 3
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable =
        error?.status === 429 || error?.status === 503;
      if (!isRetryable || i === maxRetries - 1) throw error;

      const delayMs = Math.min(1000 * Math.pow(2, i), 10000);
      console.warn(`[AI Classify] Retry ${i + 1}/${maxRetries} after ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("[AI Classify] Received classification request");

    // Get Anthropic API key
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error("[AI Classify] Missing ANTHROPIC_API_KEY environment variable");
      return NextResponse.json(
        { error: "Server configuration error: Missing API key" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { base64, mediaType } = body as {
      base64?: string;
      mediaType?: string;
    };

    // Validate input
    if (!base64 || typeof base64 !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid base64 image data" },
        { status: 400 }
      );
    }

    if (!mediaType || !isValidMediaType(mediaType)) {
      return NextResponse.json(
        {
          error: "Invalid mediaType. Must be image/jpeg, image/png, image/gif, or image/webp",
        },
        { status: 400 }
      );
    }

    if (base64.length > MAX_BASE64_BYTES) {
      return NextResponse.json(
        { error: "Image too large. Max 5MB." },
        { status: 400 }
      );
    }

    console.log(
      `[AI Classify] Processing image: mediaType=${mediaType}, size=${base64.length} bytes`
    );

    // Initialize Anthropic client
    const client = new Anthropic({ apiKey: anthropicApiKey });

    // Call Anthropic API with retry logic
    const result = await retryWithBackoff(() =>
      client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: `Identify every distinct clothing item and accessory in this image.
Return ONLY a JSON array, no markdown fences, no extra text:
[
  {
    "name": "string",
    "category": "top|bottom|dress|outerwear|footwear|bag|accessory",
    "colors": ["#hexcode"],
    "colorNames": ["color name"],
    "pattern": "Solid|Striped|Printed|Textured|Embellished",
    "fabric": "string or null",
    "fit": "Fitted|Relaxed|Oversized|Cropped|Longline|null",
    "formality": 1,
    "season": ["Summer|Winter|Transitional|All-Season"],
    "occasion": ["Casual|Work|Date Night|Weekend|Festive"],
    "stylistNote": "One stylist sentence.",
    "tags": ["tag1", "tag2"]
  }
]
Rules: one object per garment. formality is 1-10. Return ONLY the JSON array.`,
              },
            ],
          },
        ],
      })
    );

    if (!result.content[0] || result.content[0].type !== "text") {
      throw new Error("Unexpected response format from Anthropic");
    }

    const responseText = (result.content[0] as any).text;
    const cleanedText = stripCodeFences(responseText);

    let items;
    try {
      items = JSON.parse(cleanedText);
    } catch {
      console.error("[AI Classify] Failed to parse JSON:", cleanedText);
      return NextResponse.json(
        { error: "Failed to parse AI response. No valid JSON found." },
        { status: 500 }
      );
    }

    if (!Array.isArray(items)) {
      items = [items];
    }

    const processingMs = Date.now() - startTime;
    console.log(
      `[AI Classify] Successfully classified ${items.length} items in ${processingMs}ms`
    );

    return NextResponse.json(
      {
        success: true,
        data: { items },
        message: "Classification completed",
      },
      { status: 200 }
    );
  } catch (error: any) {
    const processingMs = Date.now() - startTime;

    if (error?.status === 429) {
      console.warn("[AI Classify] Rate limited by Anthropic API");
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait and try again." },
        { status: 429 }
      );
    }

    console.error("[AI Classify] Error:", error?.message || error);
    return NextResponse.json(
      {
        error: error?.message || "Image classification failed",
        processingMs,
      },
      { status: 500 }
    );
  }
}
