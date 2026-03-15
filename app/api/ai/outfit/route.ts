import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { geminiModel, retryWithBackoff, stripCodeFences } from "@/lib/gemini";

interface AIOutfitPiece {
  role: string;
  itemId: string;
}

interface AIOutfitResult {
  reasoning: string;
  colorStory: string;
  occasion?: string;
  scoreBalance?: number;
  scoreFormality?: number;
  scoreColor?: number;
  scoreNovelty?: number;
  pieces: AIOutfitPiece[];
}

export async function POST(request: NextRequest) {
  try {
    console.log("[AI Outfit] Generating outfit");

    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json().catch(() => ({}));
    const { occasion, season, mood } = body as {
      occasion?: string;
      season?: string;
      mood?: string;
    };

    console.log(`[AI Outfit] User ${userId}, occasion: ${occasion}`);

    // Fetch from DB — never trust client-provided wardrobe data
    const [wardrobeItems, user] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          category: true,
          colorNames: true,
          pattern: true,
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
        "No wardrobe items available. Please add items first.",
        400,
      );
    }

    const catalog = wardrobeItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      colorNames: item.colorNames,
      pattern: item.pattern,
      formality: item.formality,
      season: item.season,
      occasion: item.occasion,
      stylistNote: item.stylistNote,
      tags: item.tags,
    }));

    const contextParts: string[] = [];
    if (occasion) contextParts.push(`Occasion: ${occasion}`);
    if (season) contextParts.push(`Season: ${season}`);
    if (mood) contextParts.push(`Mood: ${mood}`);
    if (user?.styleProfiles?.length)
      contextParts.push(`Style profiles: ${user.styleProfiles.join(", ")}`);
    if (user?.styleIssues?.length)
      contextParts.push(`Style challenges: ${user.styleIssues.join(", ")}`);

    const prompt = `You are a world-class personal stylist. Create a complete outfit from this wardrobe.
${contextParts.length > 0 ? `\nContext: ${contextParts.join(", ")}` : ""}

Wardrobe (JSON):
${JSON.stringify(catalog)}

Pick 3-5 pieces for a cohesive, stylish outfit.
Return ONLY a JSON object, no markdown fences:
{
  "reasoning": "2-3 sentences explaining why these pieces work together",
  "colorStory": "Brief description of the color palette",
  "occasion": "casual|work|date-night|weekend|all-occasions",
  "scoreBalance": 8,
  "scoreFormality": 6,
  "scoreColor": 9,
  "scoreNovelty": 7,
  "pieces": [{"role": "base|layer|accent|statement", "itemId": "<id from wardrobe>"}]
}
All scores are integers 1-10.`;

    const result = await retryWithBackoff(() =>
      geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      })
    );

    const raw = result.response.text();
    let aiResult: AIOutfitResult;
    try {
      const cleaned = stripCodeFences(raw);
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!objMatch) throw new Error("No JSON object in AI response");
      aiResult = JSON.parse(objMatch[0]);
    } catch {
      console.error("[AI Outfit] Failed to parse AI response:", raw.slice(0, 300));
      return errorResponse(
        "AI returned unparseable response. Please try again.",
        500,
      );
    }

    if (!Array.isArray(aiResult.pieces) || aiResult.pieces.length === 0) {
      return errorResponse(
        "AI generated invalid outfit. Please try again.",
        400,
      );
    }

    // Validate referenced items belong to this user
    const itemIds = new Set(wardrobeItems.map((i) => i.id));
    const validPieces = aiResult.pieces.filter((p) => itemIds.has(p.itemId));

    if (validPieces.length === 0) {
      return errorResponse(
        "AI referenced items not in your wardrobe. Please try again.",
        400,
      );
    }

    // Persist outfit + items in a transaction
    const outfit = await prisma.$transaction(async (tx) => {
      const created = await tx.outfit.create({
        data: {
          userId,
          occasion: aiResult.occasion || occasion || null,
          reasoning: aiResult.reasoning,
          colorStory: aiResult.colorStory,
          scoreBalance: aiResult.scoreBalance ?? null,
          scoreFormality: aiResult.scoreFormality ?? null,
          scoreColor: aiResult.scoreColor ?? null,
          scoreNovelty: aiResult.scoreNovelty ?? null,
        },
      });

      await tx.outfitItem.createMany({
        data: validPieces.map((p) => ({
          outfitId: created.id,
          wardrobeItemId: p.itemId,
          role: p.role,
        })),
      });

      return tx.outfit.findUnique({
        where: { id: created.id },
        include: { items: { include: { wardrobeItem: true } } },
      });
    });

    if (!outfit) {
      return errorResponse("Failed to save outfit", 500);
    }

    console.log(
      `[AI Outfit] Outfit ${outfit.id} created with ${validPieces.length} items`,
    );

    return successResponse(
      {
        outfitId: outfit.id,
        wardrobeItemIds: validPieces.map((p) => p.itemId),
        reasoning: outfit.reasoning,
        colorStory: outfit.colorStory,
        scores: {
          balance: outfit.scoreBalance,
          formality: outfit.scoreFormality,
          color: outfit.scoreColor,
          novelty: outfit.scoreNovelty,
        },
        items: outfit.items,
      },
      "Outfit generated successfully",
      201,
    );
  } catch (error) {
    console.error("[AI Outfit] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to generate outfit",
      500,
    );
  }
}
