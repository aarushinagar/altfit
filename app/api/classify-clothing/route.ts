import { NextRequest } from "next/server";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  anthropicClient,
  CLAUDE_MODEL,
  MAX_TOKENS,
  retryWithBackoff,
  stripCodeFences,
} from "@/lib/anthropic";

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

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    const body = await request.json();
    const { base64, mediaType } = body as {
      base64?: string;
      mediaType?: string;
    };

    if (!base64 || typeof base64 !== "string") {
      return errorResponse("Missing or invalid base64 image data", 400);
    }
    if (!mediaType || !isValidMediaType(mediaType)) {
      return errorResponse(
        "Invalid mediaType. Must be image/jpeg, image/png, image/gif, or image/webp",
        400,
      );
    }
    if (base64.length > MAX_BASE64_BYTES) {
      return errorResponse("Image too large. Max 5MB.", 400);
    }

    console.log(
      `[classify-clothing] User ${userId}, mediaType: ${mediaType}, size: ${base64.length}`,
    );

    const result = await retryWithBackoff(() =>
      anthropicClient.messages.create({
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
      }),
    );

    const raw = result.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();

    let items: unknown[];
    try {
      const cleaned = stripCodeFences(raw);
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!arrMatch) throw new Error("No JSON array in response");
      items = JSON.parse(arrMatch[0]);
    } catch {
      console.error(
        "[classify-clothing] Failed to parse AI response:",
        raw.slice(0, 300),
      );
      return errorResponse(
        "AI returned unparseable response. Please try again.",
        500,
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(
        "No clothing items detected. Try a clearer image.",
        400,
      );
    }

    console.log(
      `[classify-clothing] Classified ${items.length} items for user ${userId}`,
    );
    return successResponse(items, "Clothing classified successfully");
  } catch (error) {
    console.error("[classify-clothing] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Classification failed", 500);
  }
}
