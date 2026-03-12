/**
 * AI Outfit Generation Endpoint
 * Safely calls Anthropic API from backend to generate outfit recommendations
 * Prevents CORS issues by handling API communication server-side
 */

import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

/**
 * Logs structured error information
 */
function logError(context, error, metadata = {}) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR in ${context}:`, {
    message: error?.message || error,
    metadata,
    stack: error?.stack,
  });
}

/**
 * Logs structured success information
 */
function logSuccess(context, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] SUCCESS in ${context}:`, {
    message,
    metadata,
  });
}

/**
 * Parses JSON outfit response from AI
 */
function parseOutfitJson(raw) {
  try {
    // Try matching JSON object
    const match = raw.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("No JSON object found in response");
    }
    return JSON.parse(match[0]);
  } catch (err) {
    logError("parseOutfitJson", err, { raw: raw.substring(0, 200) });
    throw new Error(`Failed to parse outfit JSON: ${err.message}`);
  }
}

/**
 * Calls Anthropic API for outfit generation
 */
async function callAnthropicAPI(prompt) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      throw new Error(
        `Anthropic API Error ${response.status}: ${errorBody.substring(0, 200)}`
      );
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Anthropic API Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data;
  } catch (error) {
    logError("callAnthropicAPI", error, { model: MODEL });
    throw error;
  }
}

/**
 * POST /api/generate-outfit
 * Generates an outfit recommendation based on the user's wardrobe
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    // Validate environment
    if (!ANTHROPIC_API_KEY) {
      logError("POST /api/generate-outfit", "Missing ANTHROPIC_API_KEY environment variable");
      return NextResponse.json(
        { error: "Server configuration error: Missing API key" },
        { status: 500 }
      );
    }

    const { wardrobeItems, previousOutfitIds = [], shuffleVibe = null } =
      await request.json();

    // Validate request
    if (!Array.isArray(wardrobeItems) || wardrobeItems.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: wardrobeItems must be a non-empty array" },
        { status: 400 }
      );
    }

    logSuccess("POST /api/generate-outfit", "Request received", {
      itemCount: wardrobeItems.length,
      previousOutfitCount: previousOutfitIds.length,
      shuffle: shuffleVibe,
    });

    // Build catalog for AI
    const catalog = wardrobeItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      type: item.type || item.category,
      colorName: item.colorName,
      colorHex: item.colorHex || item.color || "#888",
      pattern: item.pattern,
      fit: item.fit,
      formality: item.formality,
      season: item.season,
      emoji: item.emoji,
      note: item.note,
      pairsWith: item.pairsWith || [],
    }));

    // Build the prompt
    const prompt = `You are a world-class personal stylist with deep knowledge of color psychology, fabric quality, and trend forecasting. Your mission: curate the perfect daily outfit from a user's existing wardrobe, maximizing style, mood enhancement, and psychological well-being.

Here is the user's wardrobe (JSON):
${JSON.stringify(catalog, null, 2)}

${previousOutfitIds.length > 0 ? `Avoid these previously recommended item IDs: [${previousOutfitIds.map((id) => `"${id}"`).join(", ")}]` : ""}

${shuffleVibe ? `The user's vibe today: ${shuffleVibe}` : ""}

Your task:
1. **Analyze the wardrobe** for color harmony, style consistency, and quality
2. **Recommend 3-5 pieces** that create a cohesive, confidence-boosting outfit
3. **Maximize psychological impact** using color psychology (e.g., red for confidence, blue for calm)
4. **Consider occasion flexibility** — the outfit should work for multiple contexts if possible
5. **Ensure uniqueness** — vary the style recommendations across calls

Return ONLY a JSON object with this structure (no markdown, no explanation):
{
  "title": "Outfit title capturing the vibe",
  "description": "2-3 sentence stylist commentary on why this combination works",
  "colorPsychology": "Explain the psychology of the chosen colors",
  "pieces": [{"role": "top|bottom|dress|outerwear|footwear|bag|accessory", "itemId": "id-from-catalog"}],
  "styling_tips": ["tip 1", "tip 2", "tip 3"],
  "occasion": "casual|work|date-night|weekend|all-occasions",
  "mood_boost": "One sentence about how this outfit makes you feel"
}`;

    // Call Anthropic API
    const data = await callAnthropicAPI(prompt);

    // Parse response
    const raw = (data.content || [])
      .map((c) => c.text || "")
      .join("")
      .trim();

    const outfit = parseOutfitJson(raw);

    // Validate outfit structure
    if (!outfit.pieces || !Array.isArray(outfit.pieces) || outfit.pieces.length === 0) {
      logError("POST /api/generate-outfit", "Invalid outfit structure from AI");
      return NextResponse.json(
        { error: "AI generated invalid outfit. Please try again." },
        { status: 400 }
      );
    }

    // Resolve pieces to actual items
    const itemMap = Object.fromEntries(
      wardrobeItems.map((i) => [String(i.id), i])
    );
    const resolvedPieces = outfit.pieces
      .map((p) => ({
        role: p.role,
        item: itemMap[String(p.itemId)],
      }))
      .filter((p) => p.item);

    // Validate all pieces were resolved
    if (resolvedPieces.length === 0) {
      logError("POST /api/generate-outfit", "No items matched from wardrobe", {
        aiItems: outfit.pieces.length,
      });
      return NextResponse.json(
        { error: "AI returned items not in your wardrobe. Please try again." },
        { status: 400 }
      );
    }

    logSuccess("POST /api/generate-outfit", "Successfully generated outfit", {
      pieceCount: resolvedPieces.length,
      title: outfit.title,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      { ...outfit, pieces: resolvedPieces },
      { status: 200 }
    );
  } catch (error) {
    logError("POST /api/generate-outfit", error, {
      processingTimeMs: Date.now() - startTime,
    });

    const statusCode = error.message.includes("Invalid request") ? 400 : 500;

    return NextResponse.json(
      {
        error: error.message || "Failed to generate outfit",
      },
      { status: statusCode }
    );
  }
}
