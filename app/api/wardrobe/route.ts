/**
 * GET /api/wardrobe
 * Get all wardrobe items for authenticated user (with user isolation)
 *
 * Query parameters:
 * - category: Filter by category
 * - limit: Max items to return (default: 50)
 * - offset: Pagination offset (default: 0)
 *
 * POST /api/wardrobe
 * Create a new wardrobe item
 *
 * Request body:
 * {
 *   "name": "Blue T-Shirt",
 *   "category": "top",
 *   "imageUrl": "https://...",
 *   "storagePath": "wardrobe-images/user_id/...",
 *   "colors": ["blue"],
 *   ...
 * }
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import {
  successResponse,
  errorResponse,
  validateRequired,
} from "@/lib/api-response";
import type { WardrobeItemRequest, WardrobeItemResponse } from "@/types/api";

export async function GET(request: NextRequest) {
  try {
    console.log("[Wardrobe Get] Fetching wardrobe items");

    // Authenticate user
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    // Get query parameters
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    console.log(
      `[Wardrobe Get] User ${userId}, category: ${category || "all"}, limit: ${limit}, offset: ${offset}`,
    );

    // Build query
    const where: { userId: string; category?: string } = { userId };
    if (category) {
      where.category = category;
    }

    // Get items
    const items = await prisma.wardrobeItem.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    // Get total count for pagination
    const total = await prisma.wardrobeItem.count({ where });

    console.log(
      `[Wardrobe Get] Retrieved ${items.length} items (total: ${total})`,
    );

    const response: WardrobeItemResponse[] = items.map((item) => ({
      id: item.id,
      userId: item.userId,
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
    }));

    return successResponse(
      {
        items: response,
        total,
        limit,
        offset,
      },
      "Wardrobe items fetched successfully",
      200,
    );
  } catch (error) {
    console.error("[Wardrobe Get] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch items",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[Wardrobe Create] Creating new wardrobe item");

    // Authenticate user
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json();

    // Validate required fields
    const validation = validateRequired(body, [
      "name",
      "category",
      "imageUrl",
      "storagePath",
    ]);
    if (validation) return validation;

    const {
      name,
      category,
      imageUrl,
      storagePath,
      colors = [],
      colorNames = [],
      pattern,
      fabric,
      fit,
      formality = 5,
      season = [],
      occasion = [],
      stylistNote,
      tags = [],
    } = body as WardrobeItemRequest;

    console.log(
      `[Wardrobe Create] Creating item: ${name} (${category}) for user ${userId}`,
    );

    // Create item with user isolation
    const item = await prisma.wardrobeItem.create({
      data: {
        userId,
        name,
        category,
        imageUrl,
        storagePath,
        colors,
        colorNames,
        pattern,
        fabric,
        fit,
        formality,
        season,
        occasion,
        stylistNote,
        tags,
      },
    });

    console.log(`[Wardrobe Create] Item created: ${item.id}`);

    return successResponse(
      {
        id: item.id,
        userId: item.userId,
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
      "Item created successfully",
      201,
    );
  } catch (error) {
    console.error("[Wardrobe Create] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to create item",
      500,
    );
  }
}
