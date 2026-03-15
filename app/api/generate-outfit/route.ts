import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  geminiModel,
  retryWithBackoff,
  stripCodeFences,
} from "@/lib/gemini";

interface OutfitPiece {
  role: string;
  itemId: string;
}

interface AIOutfitResponse {
  title: string;
  description: string;
  colorPsychology?: string;
  pieces: OutfitPiece[];
  styling_tips?: string[];
  occasion?: string;
  mood_boost?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    const body = await request.json().catch(() => ({}));
    const { previousOutfitIds = [], shuffleVibe = null } = body as {
      previousOutfitIds?: string[];
      shuffleVibe?: string | null;
    };

    // Fetch wardrobe from DB — never trust client-provided item data
    const [wardrobeItems, user] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          category: true,
          colors: true,
          colorNames: true,
          pattern: true,
          fabric: true,
          fit: true,
          formality: true,
          season: true,
          occasion: true,
          stylistNote: true,
          tags: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { styleProfiles: true, styleIssues: true },
      }),
    ]);

    if (wardrobeItems.length === 0) {
      return errorResponse(
        "No wardrobe items found. Please add items first.",
        400,
      );
    }

    const catalog = wardrobeItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      colorNames: item.colorNames,
      pattern: item.pattern,
      fabric: item.fabric,
      fit: item.fit,
      formality: item.formality,
      season: item.season,
      occasion: item.occasion,
      stylistNote: item.stylistNote,
      tags: item.tags,
    }));

    const avoidClause =
      previousOutfitIds.length > 0
        ? `Avoid these recently used item IDs: [${previousOutfitIds.map((id) => `"${id}"`).join(", ")}].`
        : "";

    const vibeClause = shuffleVibe
      ? `The user's vibe today: ${shuffleVibe}.`
      : "";
    const styleClause = user?.styleProfiles?.length
      ? `User's style profiles: ${user.styleProfiles.join(", ")}.`
      : "";
    const issuesClause = user?.styleIssues?.length
      ? `User's style challenges to address: ${user.styleIssues.join(", ")}.`
      : "";

    const prompt = `You are a world-class personal stylist. Curate the perfect outfit from this wardrobe.
${styleClause}
${issuesClause}

Wardrobe (JSON):
${JSON.stringify(catalog)}

${avoidClause}
${vibeClause}

Pick 3-5 pieces for a cohesive, confidence-boosting outfit.
Return ONLY a JSON object, no markdown fences:
{
  "title": "outfit title",
  "description": "2-3 sentence stylist commentary",
  "colorPsychology": "explain color choices",
  "pieces": [{"role": "base|layer|accent|statement", "itemId": "<id from catalog>"}],
  "styling_tips": ["tip1", "tip2"],
  "occasion": "casual|work|date-night|weekend|all-occasions",
  "mood_boost": "one sentence"
}`;

    const result = await retryWithBackoff(() =>
      geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    );

    const raw = result.response.text();

    let outfit: AIOutfitResponse;
    try {
      const cleaned = stripCodeFences(raw);
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!objMatch) throw new Error("No JSON object in response");
      outfit = JSON.parse(objMatch[0]);
    } catch {
      console.error(
        "[generate-outfit] Failed to parse AI response:",
        raw.slice(0, 300),
      );
      return errorResponse(
        "AI returned unparseable response. Please try again.",
        500,
      );
    }

    if (!Array.isArray(outfit.pieces) || outfit.pieces.length === 0) {
      return errorResponse(
        "AI generated invalid outfit. Please try again.",
        400,
      );
    }

    // Resolve pieces to actual DB items to confirm they exist & belong to user
    const itemMap = Object.fromEntries(wardrobeItems.map((i) => [i.id, i]));
    const resolvedPieces = outfit.pieces
      .filter((p) => itemMap[p.itemId])
      .map((p) => ({ role: p.role, item: itemMap[p.itemId] }));

    if (resolvedPieces.length === 0) {
      return errorResponse(
        "AI referenced items not in your wardrobe. Please try again.",
        400,
      );
    }

    console.log(
      `[generate-outfit] Generated ${resolvedPieces.length}-piece outfit for user ${userId}`,
    );

    return successResponse(
      { ...outfit, pieces: resolvedPieces },
      "Outfit generated successfully",
    );
  } catch (error) {
    console.error("[generate-outfit] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to generate outfit", 500);
  }
}
