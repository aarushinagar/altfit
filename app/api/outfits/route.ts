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
    const where: any = { userId };
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

    const response: OutfitResponse[] = outfits.map((outfit: any) => ({
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
