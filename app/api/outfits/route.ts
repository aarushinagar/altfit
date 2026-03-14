/**
 * GET /api/outfits
 * Get outfit history for user (with user isolation)
 *
 * Query parameters:
 * - worn: Filter by worn status (true/false)
 * - limit: Max outfits to return (default: 50)
 * - offset: Pagination offset (default: 0)
 *
 * POST /api/outfits
 * Save a generated outfit (if needed for manual saves, though AI endpoint creates directly)
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import type { OutfitResponse } from "@/types/api";

export async function GET(request: NextRequest) {
  try {
    console.log("[Outfits Get] Fetching outfit history");

    // Authenticate user
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    // Get query parameters
    const url = new URL(request.url);
    const worn = url.searchParams.get("worn");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    console.log(
      `[Outfits Get] User ${userId}, worn: ${worn || "all"}, limit: ${limit}, offset: ${offset}`,
    );

    // Build query
    const where: { userId: string; worn?: boolean } = { userId };
    if (worn !== null) {
      where.worn = worn === "true";
    }

    // Get outfits
    const outfits = await prisma.outfit.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
    });

    // Get total count for pagination
    const total = await prisma.outfit.count({ where });

    console.log(
      `[Outfits Get] Retrieved ${outfits.length} outfits (total: ${total})`,
    );

    const response: OutfitResponse[] = outfits.map((outfit) => ({
      id: outfit.id,
      userId: outfit.userId,
      occasion: outfit.occasion,
      reasoning: outfit.reasoning,
      colorStory: outfit.colorStory,
      scoreBalance: outfit.scoreBalance,
      scoreFormality: outfit.scoreFormality,
      scoreColor: outfit.scoreColor,
      scoreNovelty: outfit.scoreNovelty,
      worn: outfit.worn,
      wornAt: outfit.wornAt?.toISOString() || null,
      createdAt: outfit.createdAt.toISOString(),
      items: outfit.items,
    }));

    return successResponse(
      {
        outfits: response,
        total,
        limit,
        offset,
      },
      "Outfits fetched successfully",
      200,
    );
  } catch (error) {
    console.error("[Outfits Get] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch outfits",
      500,
    );
  }
}

/**
 * POST /api/outfits
 * Manually save an outfit (item IDs must belong to the authenticated user).
 */
export async function POST(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json().catch(() => ({}));

    const { wardrobeItemIds, occasion, reasoning, colorStory } = body as {
      wardrobeItemIds?: string[];
      occasion?: string;
      reasoning?: string;
      colorStory?: string;
    };

    if (!Array.isArray(wardrobeItemIds) || wardrobeItemIds.length === 0) {
      return errorResponse("wardrobeItemIds must be a non-empty array", 400);
    }

    // Verify all items belong to this user
    const ownedItems = await prisma.wardrobeItem.findMany({
      where: { id: { in: wardrobeItemIds }, userId },
      select: { id: true },
    });

    if (ownedItems.length !== wardrobeItemIds.length) {
      return errorResponse(
        "One or more wardrobe items not found or not owned by you",
        403,
      );
    }

    const outfit = await prisma.$transaction(async (tx) => {
      const created = await tx.outfit.create({
        data: {
          userId,
          occasion: occasion ?? null,
          reasoning: reasoning ?? null,
          colorStory: colorStory ?? null,
        },
      });

      await tx.outfitItem.createMany({
        data: ownedItems.map((item, i) => ({
          outfitId: created.id,
          wardrobeItemId: item.id,
          role:
            i === 0 ? "base" : i === ownedItems.length - 1 ? "accent" : "layer",
        })),
      });

      return tx.outfit.findUnique({
        where: { id: created.id },
        include: { items: true },
      });
    });

    console.log(
      `[Outfits POST] Outfit ${outfit?.id} created for user ${userId}`,
    );
    return successResponse(outfit, "Outfit saved", 201);
  } catch (error) {
    console.error("[Outfits POST] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to save outfit",
      500,
    );
  }
}
