import { NextRequest } from "next/server";
import { getAuthenticatedUserId, authenticateRequest } from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { geminiModel, retryWithBackoff } from "@/lib/gemini";

const MAX_BASE64_BYTES = 7 * 1024 * 1024;
const VALID_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ValidMediaType = (typeof VALID_MEDIA_TYPES)[number];

function isValidMediaType(v: string): v is ValidMediaType {
  return (VALID_MEDIA_TYPES as readonly string[]).includes(v);
}

export async function POST(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json();
    const { base64, mediaType } = body as { base64?: string; mediaType?: string };

    if (!base64 || !mediaType || !isValidMediaType(mediaType)) {
      return errorResponse("Missing or invalid image data", 400);
    }
    if (base64.length > MAX_BASE64_BYTES) {
      return errorResponse("Image too large. Max 5MB.", 400);
    }

    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");

    const promptText = `Identify every distinct clothing item and accessory in this image. Return ONLY a JSON array, no markdown fences, no extra text: [{"name":"string","category":"top|bottom|dress|outerwear|footwear|bag|accessory","colors":["#hexcode"],"colorNames":["color name"],"pattern":"Solid|Striped|Printed|Textured|Embellished","fabric":"string or null","fit":"Fitted|Relaxed|Oversized|Cropped|Longline|null","formality":1,"season":["Summer|Winter|Transitional|All-Season"],"occasion":["Casual|Work|Date Night|Weekend|Festive"],"stylistNote":"One stylist sentence.","tags":["tag1","tag2"]}]`;

    const result = await retryWithBackoff(() =>
      geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              { inlineData: { data: cleanBase64, mimeType: mediaType } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      })
    );

    const raw = result.response.text();
    let items: unknown[];
    try {
      items = JSON.parse(raw);
    } catch {
      console.error("[classify-clothing] Failed to parse AI response:", raw.slice(0, 300));
      return errorResponse("AI returned unparseable response. Please try again.", 500);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse("No clothing items detected. Try a clearer image.", 400);
    }

    console.log(`[classify-clothing] Classified ${items.length} items for user ${userId}`);
    return successResponse(items, "Clothing classified successfully");
  } catch (error) {
    console.error("[classify-clothing] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Classification failed",
      500
    );
  }
}
