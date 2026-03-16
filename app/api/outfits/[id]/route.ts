/**
 * GET /api/outfits/[id]
 * Get a single outfit (with user isolation)
 *
 * DELETE /api/outfits/[id]
 * Delete a saved outfit and all its OutfitItem relations (with user isolation)
 */

import { NextRequest } from "next/server";
import prisma from "@/backend/database/prisma";
import {
  requireAuth,
  isUserAuthorized,
} from "@/backend/database/auth-middleware";
import {
  successResponse,
  errorResponse,
} from "@/backend/database/api-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const outfit = await prisma.outfit.findUnique({
      where: { id: BigInt(id) },
      include: { items: true },
    });

    if (!outfit) {
      return errorResponse("Outfit not found", 404);
    }
    if (!isUserAuthorized(userId, outfit.userId.toString())) {
      return errorResponse("Unauthorized", 403);
    }

    return successResponse(
      {
        id: outfit.id.toString(),
        userId: outfit.userId.toString(),
        occasion: outfit.occasion,
        reasoning: outfit.reasoning,
        colorStory: outfit.colorStory,
        worn: outfit.worn,
        wornAt: outfit.wornAt?.toISOString() ?? null,
        createdAt: outfit.createdAt.toISOString(),
        items: outfit.items.map((item) => ({
          id: item.id.toString(),
          wardrobeItemId: item.wardrobeItemId.toString(),
        })),
      },
      "Outfit retrieved successfully",
      200,
    );
  } catch (error) {
    console.error("[Outfit Get]", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to retrieve outfit",
      500,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const outfit = await prisma.outfit.findUnique({
      where: { id: BigInt(id) },
      select: { userId: true },
    });

    if (!outfit) {
      return errorResponse("Outfit not found", 404);
    }
    if (!isUserAuthorized(userId, outfit.userId.toString())) {
      return errorResponse("Unauthorized", 403);
    }

    // OutfitItem rows cascade-delete automatically via the schema relation
    await prisma.outfit.delete({
      where: { id: BigInt(id) },
    });

    return successResponse(
      { message: "Outfit deleted successfully" },
      "Outfit deleted",
      200,
    );
  } catch (error) {
    console.error("[Outfit Delete]", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to delete outfit",
      500,
    );
  }
}
