/**
 * PATCH /api/outfits/[id]/worn
 * Mark an outfit as worn
 *
 * Request body:
 * {
 *   "worn": true,
 *   "wornAt": "2024-03-13T10:30:00Z" (optional, defaults to now)
 * }
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
  isUserAuthorized,
} from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import type { OutfitResponse } from "@/types/api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    console.log(`[Outfits Mark Worn] Marking outfit ${id} as worn`);

    // Authenticate user
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json();

    const { worn = true, wornAt = new Date() } = body;

    // Get outfit
    const outfit = await prisma.outfit.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!outfit) {
      console.warn(`[Outfits Mark Worn] Outfit not found: ${id}`);
      return errorResponse("Outfit not found", 404);
    }

    // Check user isolation
    if (!isUserAuthorized(userId, outfit.userId)) {
      return errorResponse("Unauthorized", 403);
    }

    console.log(
      `[Outfits Mark Worn] Updating outfit worn status for user ${userId}`,
    );

    // Update outfit
    const updatedOutfit = await prisma.outfit.update({
      where: { id },
      data: {
        worn,
        wornAt: worn ? new Date(wornAt) : null,
      },
      include: { items: true },
    });

    // If outfit is marked as worn, increment wear count for each item
    if (worn) {
      await Promise.all(
        updatedOutfit.items.map((item: any) =>
          prisma.wardrobeItem.update({
            where: { id: item.wardrobeItemId },
            data: {
              wearCount: { increment: 1 },
              lastWornAt: new Date(wornAt),
            },
          }),
        ),
      );
    }

    console.log(`[Outfits Mark Worn] Outfit updated: ${updatedOutfit.id}`);

    const response: OutfitResponse = {
      id: updatedOutfit.id,
      userId: updatedOutfit.userId,
      occasion: updatedOutfit.occasion,
      reasoning: updatedOutfit.reasoning,
      colorStory: updatedOutfit.colorStory,
      scoreBalance: updatedOutfit.scoreBalance,
      scoreFormality: updatedOutfit.scoreFormality,
      scoreColor: updatedOutfit.scoreColor,
      scoreNovelty: updatedOutfit.scoreNovelty,
      worn: updatedOutfit.worn,
      wornAt: updatedOutfit.wornAt?.toISOString() || null,
      createdAt: updatedOutfit.createdAt.toISOString(),
      items: updatedOutfit.items,
    };

    return successResponse(response, "Outfit updated successfully", 200);
  } catch (error) {
    console.error(`[Outfits Mark Worn] Error:`, error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update outfit",
      500,
    );
  }
}
