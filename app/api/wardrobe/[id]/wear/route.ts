import { NextRequest } from "next/server";
import prisma from "@/backend/database/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
  isUserAuthorized,
} from "@/backend/database/auth-middleware";
import {
  successResponse,
  errorResponse,
} from "@/backend/database/api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const { id } = await params;

    const item = await prisma.wardrobeItem.findUnique({
      where: { id: BigInt(id) },
    });
    if (!item) {
      return errorResponse("Wardrobe item not found", 404);
    }
    if (!isUserAuthorized(userId, item.userId.toString())) {
      return errorResponse("Forbidden", 403);
    }

    const updated = await prisma.wardrobeItem.update({
      where: { id: BigInt(id) },
      data: {
        wearCount: { increment: 1 },
        lastWornAt: new Date(),
      },
    });

    console.log(`[wardrobe/wear] Item ${id} wear count: ${updated.wearCount}`);
    return successResponse(updated, "Wear recorded");
  } catch (error) {
    console.error("[wardrobe/wear] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to record wear",
      500,
    );
  }
}
