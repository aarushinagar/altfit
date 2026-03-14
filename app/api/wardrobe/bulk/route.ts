import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import type { WardrobeItemRequest } from "@/types/api";

/**
 * POST /api/wardrobe/bulk
 * Batch-create wardrobe items (e.g. all pieces from a single upload session).
 * Runs in a single Prisma transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json().catch(() => null);

    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return errorResponse(
        "Request body must include a non-empty 'items' array",
        400,
      );
    }

    const { items } = body as { items: WardrobeItemRequest[] };

    // Validate each item has required fields
    for (const item of items) {
      if (!item.name || !item.category || !item.imageUrl || !item.storagePath) {
        return errorResponse(
          "Each item must include name, category, imageUrl, and storagePath",
          400,
        );
      }
    }

    const created = await prisma.$transaction(
      items.map((item) =>
        prisma.wardrobeItem.create({
          data: {
            userId,
            name: item.name,
            category: item.category,
            imageUrl: item.imageUrl,
            storagePath: item.storagePath,
            colors: item.colors ?? [],
            colorNames: item.colorNames ?? [],
            pattern: item.pattern ?? null,
            fabric: item.fabric ?? null,
            fit: item.fit ?? null,
            formality: typeof item.formality === "number" ? item.formality : 5,
            season: item.season ?? [],
            occasion: item.occasion ?? [],
            stylistNote: item.stylistNote ?? null,
            tags: item.tags ?? [],
          },
        }),
      ),
    );

    console.log(
      `[wardrobe/bulk POST] Created ${created.length} items for user ${userId}`,
    );
    return successResponse(
      { items: created, count: created.length },
      `${created.length} items saved`,
      201,
    );
  } catch (error) {
    console.error("[wardrobe/bulk POST] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Bulk create failed", 500);
  }
}

/**
 * DELETE /api/wardrobe/bulk
 * Delete multiple wardrobe items at once (only items owned by authenticated user).
 */
export async function DELETE(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json().catch(() => null);

    if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
      return errorResponse(
        "Request body must include a non-empty 'ids' array",
        400,
      );
    }

    const { ids } = body as { ids: string[] };

    // Only delete items that belong to this user (enforces user isolation)
    const { count } = await prisma.wardrobeItem.deleteMany({
      where: { id: { in: ids }, userId },
    });

    console.log(
      `[wardrobe/bulk DELETE] Deleted ${count} items for user ${userId}`,
    );
    return successResponse({ deleted: count }, `${count} items deleted`);
  } catch (error) {
    console.error("[wardrobe/bulk DELETE] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Bulk delete failed", 500);
  }
}
