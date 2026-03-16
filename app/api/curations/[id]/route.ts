/**
 * PATCH /api/curations/[id]
 *
 * Dismisses a single slot from an existing DailyCuration by setting it to null.
 * The dismissed slot will not appear again until tomorrow's curation is generated.
 *
 * Request body:
 * {
 *   dismissSlot: 1 | 2 | 3   — which slot to dismiss
 * }
 *
 * Response:
 * { message: "Slot dismissed" }
 */

import { NextRequest } from "next/server";
import prisma from "@/backend/database/prisma";
import { requireAuth } from "@/backend/database/auth-middleware";
import {
  errorResponse,
  successResponse,
} from "@/backend/database/api-response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const { id } = await params;

    const body = await request.json();
    const { dismissSlot } = body as { dismissSlot: 1 | 2 | 3 };

    if (![1, 2, 3].includes(dismissSlot)) {
      return errorResponse("dismissSlot must be 1, 2, or 3", 400);
    }

    // Verify record exists and belongs to this user
    const curation = await prisma.dailyCuration.findUnique({
      where: { id: BigInt(id) },
      select: { userId: true },
    });

    if (!curation) {
      return errorResponse("Curation not found", 404);
    }
    if (curation.userId.toString() !== userId) {
      return errorResponse("Not authorized", 403);
    }

    // Null out the specified slot
    const slotField = `slot${dismissSlot}` as "slot1" | "slot2" | "slot3";
    await prisma.dailyCuration.update({
      where: { id: BigInt(id) },
      data: { [slotField]: null },
    });

    return successResponse(
      { message: "Slot dismissed" },
      "Slot dismissed",
      200,
    );
  } catch (err) {
    console.error("[PATCH /api/curations/[id]]", err);
    return errorResponse("Internal server error", 500);
  }
}
