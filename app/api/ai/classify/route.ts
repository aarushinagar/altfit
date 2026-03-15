/**
 * POST /api/ai/classify
 * Classify clothing items from an image (public endpoint, no auth required)
 *
 * Request: { base64: string, mediaType: "image/jpeg"|"image/png"|"image/gif"|"image/webp" }
 * Response: { success: true, data: { items: [...] }, message: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { geminiModel, retryWithBackoff } from "@/lib/gemini";

const MAX_BASE64_BYTES = 7 * 1024 * 1024;
const VALID_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ValidMediaType = (typeof VALID_MEDIA_TYPES)[number];

function isValidMediaType(v: string): v is ValidMediaType {
  return (VALID_MEDIA_TYPES as readonly string[]).includes(v);
}

const PROMPT = `Identify every distinct clothing item and accessory in this image. Return ONLY a JSON array, no markdown fences, no extra text: [{"name":"string","category":"top|bottom|dress|outerwear|footwear|bag|accessory","colors":["#hexcode"],"colorNames":["color name"],"pattern":"Solid|Striped|Printed|Textured|Embellished","fabric":"string or null","fit":"Fitted|Relaxed|Oversized|Cropped|Longline|null","formality":1,"season":["Summer|Winter|Transitional|All-Season"],"occasion":["Casual|Work|Date Night|Weekend|Festive"],"stylistNote":"One stylist sentence.","tags":["tag1","tag2"]}]`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { base64, mediaType } = body as { base64?: string; mediaType?: string };

    if (!base64 || !mediaType || !isValidMediaType(mediaType)) {
      return NextResponse.json(
        { error: "Missing or invalid image data" },
        { status: 400 }
      );
    }
    if (base64.length > MAX_BASE64_BYTES) {
      return NextResponse.json(
        { error: "Image too large. Max 5MB." },
        { status: 400 }
      );
    }

    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");

    const result = await retryWithBackoff(() =>
      geminiModel.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: PROMPT },
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
      console.error("[AI Classify] Failed to parse:", raw.slice(0, 300));
      return NextResponse.json(
        { error: "AI returned unparseable response. Please try again." },
        { status: 500 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No clothing items detected. Try a clearer image." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: { items }, message: "Classification completed" },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Image classification failed";
    console.error("[AI Classify] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
