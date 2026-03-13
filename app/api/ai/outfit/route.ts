/**
 * POST /api/ai/outfit
 *
 * Generate an outfit from user's wardrobe items using AI
 *
 * Request body:
 * {
 *   "occasion": "casual",
 *   "season": "summer",
 *   "mood": "relaxed"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "outfitId": "outfit_id",
 *     "wardrobeItemIds": ["item1", "item2", ...],
 *     "reasoning": "This outfit combines...",
 *     "colorStory": "A harmonious blend of...",
 *     "scores": {
 *       "balance": 8,
 *       "formality": 6,
 *       "color": 9,
 *       "novelty": 7
 *     }
 *   }
 * }
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    console.log("[AI Outfit] Generating outfit");

    // Authenticate user
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json();

    const { occasion, season, mood } = body;

    console.log(
      `[AI Outfit] Generating outfit for user ${userId}, occasion: ${occasion}`,
    );

    // Get user's wardrobe items
    const wardrobeItems = await prisma.wardrobeItem.findMany({
      where: { userId },
    });

    if (wardrobeItems.length === 0) {
      console.warn(`[AI Outfit] User ${userId} has no wardrobe items`);
      return errorResponse(
        "No wardrobe items available. Please add items first.",
        400,
      );
    }

    console.log(`[AI Outfit] Available items: ${wardrobeItems.length}`);

    // TODO: Integrate with Claude API for outfit generation
    // For now, return a placeholder implementation

    // Build a simple outfit by selecting random compatible items
    // This should be replaced with actual AI logic
    const topItems = wardrobeItems.filter(
      (item: any) => item.category === "top" || item.category === "dress",
    );
    const bottomItems = wardrobeItems.filter(
      (item: any) => item.category === "bottom",
    );
    const accessoryItems = wardrobeItems.filter(
      (item: any) =>
        item.category === "bag" ||
        item.category === "accessory" ||
        item.category === "footwear",
    );

    // Select one of each type randomly
    const selectedItems = [];
    if (topItems.length > 0) {
      selectedItems.push(topItems[Math.floor(Math.random() * topItems.length)]);
    }
    if (bottomItems.length > 0) {
      selectedItems.push(
        bottomItems[Math.floor(Math.random() * bottomItems.length)],
      );
    }
    if (accessoryItems.length > 0) {
      selectedItems.push(
        accessoryItems[Math.floor(Math.random() * accessoryItems.length)],
      );
    }

    if (selectedItems.length === 0) {
      console.warn(`[AI Outfit] Cannot create outfit with available items`);
      return errorResponse("Cannot create outfit with available items", 400);
    }

    console.log(
      `[AI Outfit] Selected ${selectedItems.length} items for outfit`,
    );

    // Create outfit record
    const outfit = await prisma.outfit.create({
      data: {
        userId,
        occasion: occasion || null,
        reasoning: `Generated outfit with ${selectedItems.length} items for ${occasion || "casual"} wear`,
        colorStory: "Color-coordinated selection",
        scoreBalance: 7,
        scoreFormality: 5,
        scoreColor: 8,
        scoreNovelty: 6,
        items: {
          create: selectedItems.map((item, index) => ({
            wardrobeItemId: item.id,
            role:
              index === 0
                ? "base"
                : index === selectedItems.length - 1
                  ? "accent"
                  : "layer",
          })),
        },
      },
      include: {
        items: true,
      },
    });

    console.log(`[AI Outfit] Outfit created: ${outfit.id}`);

    return successResponse(
      {
        outfitId: outfit.id,
        wardrobeItemIds: selectedItems.map((item) => item.id),
        reasoning: outfit.reasoning,
        colorStory: outfit.colorStory,
        scores: {
          balance: outfit.scoreBalance,
          formality: outfit.scoreFormality,
          color: outfit.scoreColor,
          novelty: outfit.scoreNovelty,
        },
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
