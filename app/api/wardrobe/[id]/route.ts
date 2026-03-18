/**
 * GET /api/wardrobe/[id]
 * Get a single wardrobe item (with user isolation)
 *
 * PATCH /api/wardrobe/[id]
 * Update a wardrobe item (with user isolation)
 *
 * DELETE /api/wardrobe/[id]
 * Delete a wardrobe item (with user isolation)
 */

import { NextRequest } from "next/server";
import prisma from "@/backend/database/prisma";
import {
  requireAuth,
  isUserAuthorized,
} from "@/backend/database/auth-middleware";
import { deleteImage } from "@/backend/database/supabase";
import {
  successResponse,
  errorResponse,
} from "@/backend/database/api-response";
import type { WardrobeItemResponse } from "@/types/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    console.log(`[Wardrobe Get Item] Fetching item ${id}`);

    // Authenticate user
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    // Get item
    const item = await prisma.wardrobeItem.findUnique({
      where: { id: BigInt(id) },
    });

    if (!item) {
      console.warn(`[Wardrobe Get Item] Item not found: ${id}`);
      return errorResponse("Item not found", 404);
    }

    // Check user isolation
    if (!isUserAuthorized(userId, item.userId.toString())) {
      return errorResponse("Unauthorized", 403);
    }

    console.log(`[Wardrobe Get Item] Retrieved item: ${item.id}`);

    return successResponse(
      {
        id: item.id.toString(),
        userId: item.userId.toString(),
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        storagePath: item.storagePath,
        colors: item.colors,
        colorNames: item.colorNames,
        pattern: item.pattern || undefined,
        fabric: item.fabric || undefined,
        fit: item.fit || undefined,
        formality: item.formality,
        season: item.season,
        occasion: item.occasion,
        stylistNote: item.stylistNote || undefined,
        tags: item.tags,
        wearCount: item.wearCount,
        lastWornAt: item.lastWornAt?.toISOString() || null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      } as WardrobeItemResponse,
      "Item retrieved successfully",
      200,
    );
  } catch (error) {
    console.error(`[Wardrobe Get Item] Error:`, error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to get item",
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    console.log(`[Wardrobe Update Item] Updating item ${id}`);

    // Authenticate user
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const body = await request.json();

    // Get item
    const item = await prisma.wardrobeItem.findUnique({
      where: { id: BigInt(id) },
    });

    if (!item) {
      console.warn(`[Wardrobe Update Item] Item not found: ${id}`);
      return errorResponse("Item not found", 404);
    }

    // Check user isolation
    if (!isUserAuthorized(userId, item.userId.toString())) {
      return errorResponse("Unauthorized", 403);
    }

    console.log(`[Wardrobe Update Item] Updating item for user ${userId}`);

    // Validate imageUrl — must be an absolute Supabase URL, never a local path
    if (body.imageUrl !== undefined && body.imageUrl !== null && body.imageUrl !== "") {
      if (!String(body.imageUrl).startsWith("https://")) {
        return errorResponse(
          `Invalid imageUrl: must be an absolute https:// URL, got "${String(body.imageUrl).slice(0, 80)}"`,
          400,
        );
      }
    }

    // Update item
    const updatedItem = await prisma.wardrobeItem.update({
      where: { id: BigInt(id) },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.category && { category: body.category }),
        // Allow updating the image URL when the client has cropped and re-uploaded
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.storagePath !== undefined && { storagePath: body.storagePath }),
        ...(body.colors && { colors: body.colors }),
        ...(body.colorNames && { colorNames: body.colorNames }),
        ...(body.pattern !== undefined && { pattern: body.pattern }),
        ...(body.fabric !== undefined && { fabric: body.fabric }),
        ...(body.fit !== undefined && { fit: body.fit }),
        ...(body.formality !== undefined && { formality: body.formality }),
        ...(body.season && { season: body.season }),
        ...(body.occasion && { occasion: body.occasion }),
        ...(body.stylistNote !== undefined && {
          stylistNote: body.stylistNote,
        }),
        ...(body.tags && { tags: body.tags }),
      },
    });

    console.log(`[Wardrobe Update Item] Item updated: ${updatedItem.id}`);

    return successResponse(
      {
        id: updatedItem.id.toString(),
        userId: updatedItem.userId.toString(),
        name: updatedItem.name,
        category: updatedItem.category,
        imageUrl: updatedItem.imageUrl,
        storagePath: updatedItem.storagePath,
        colors: updatedItem.colors,
        colorNames: updatedItem.colorNames,
        pattern: updatedItem.pattern || undefined,
        fabric: updatedItem.fabric || undefined,
        fit: updatedItem.fit || undefined,
        formality: updatedItem.formality,
        season: updatedItem.season,
        occasion: updatedItem.occasion,
        stylistNote: updatedItem.stylistNote || undefined,
        tags: updatedItem.tags,
        wearCount: updatedItem.wearCount,
        lastWornAt: updatedItem.lastWornAt?.toISOString() || null,
        createdAt: updatedItem.createdAt.toISOString(),
        updatedAt: updatedItem.updatedAt.toISOString(),
      } as WardrobeItemResponse,
      "Item updated successfully",
      200,
    );
  } catch (error) {
    console.error(`[Wardrobe Update Item] Error:`, error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to update item",
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
    console.log(`[Wardrobe Delete Item] Deleting item ${id}`);

    // Authenticate user
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    // Get item
    const item = await prisma.wardrobeItem.findUnique({
      where: { id: BigInt(id) },
    });

    if (!item) {
      console.warn(`[Wardrobe Delete Item] Item not found: ${id}`);
      return errorResponse("Item not found", 404);
    }

    // Check user isolation
    if (!isUserAuthorized(userId, item.userId.toString())) {
      return errorResponse("Unauthorized", 403);
    }

    console.log(
      `[Wardrobe Delete Item] Deleting image and item for user ${userId}`,
    );

    // Delete image from Supabase
    try {
      if (item.storagePath) await deleteImage(item.storagePath);
    } catch (error) {
      console.warn(
        `[Wardrobe Delete Item] Failed to delete image, continuing with DB delete`,
        error,
      );
    }

    // Delete item from database
    await prisma.wardrobeItem.delete({
      where: { id: BigInt(id) },
    });

    console.log(`[Wardrobe Delete Item] Item deleted: ${id}`);

    return successResponse(
      { message: "Item deleted successfully" },
      "Item deleted",
      200,
    );
  } catch (error) {
    console.error(`[Wardrobe Delete Item] Error:`, error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to delete item",
      500,
    );
  }
}
