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
 * Upload and AI-analyse a new wardrobe item via the IngestionGraph.
 *
 * Accepts multipart/form-data:
 *   image    File    — the clothing photo (max 8 MB)
 *   name     string  — display name
 *
 * OR application/json (when the image has already been uploaded separately):
 *   imageUrl    string
 *   storagePath string
 *   name        string
 */

import { NextRequest } from "next/server";
import prisma from "@/backend/database/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/backend/database/auth-middleware";
import {
  successResponse,
  errorResponse,
} from "@/backend/database/api-response";
import { generateSnowflakeId } from "@/backend/database/snowflake";
import { processAndUploadImage } from "@/lib/image/process";
import { buildIngestionGraph } from "@/backend/langgraph/ingestion/graph";
import { isWardrobeCapExceeded } from "@/backend/langgraph/shared/regen";
import type { WardrobeItemResponse } from "@/types/api";

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
    const where: { userId: bigint; category?: string } = {
      userId: BigInt(userId),
    };
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
    console.log("[Wardrobe Create] Received upload request");

    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    // ── Free-tier wardrobe cap check ────────────────────────────────────────
    const userRecord = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { plan: true, wardrobeItemCount: true },
    });
    if (
      isWardrobeCapExceeded(
        userRecord?.plan ?? "free",
        userRecord?.wardrobeItemCount ?? 0,
      )
    ) {
      return errorResponse(
        "Free plan is limited to 10 wardrobe items. Upgrade to Pro for unlimited.",
        403,
      );
    }

    let imageUrl: string;
    let storagePath: string;
    let name: string;

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // --- Multipart: client is uploading the raw file ---
      const formData = await request.formData();
      const file = formData.get("image");
      name = String(formData.get("name") || "Untitled Item");

      if (!file || !(file instanceof File)) {
        return errorResponse("Missing required field: image", 400);
      }

      const itemId = generateSnowflakeId().toString();
      const processed = await processAndUploadImage(file, userId, itemId);
      imageUrl = processed.publicUrl;
      storagePath = processed.storagePath;
    } else {
      // --- JSON: client pre-uploaded the image and is passing the URL ---
      const body = await request.json();
      if (!body.imageUrl || !body.storagePath || !body.name) {
        return errorResponse(
          "Missing required fields: name, imageUrl, storagePath",
          400,
        );
      }
      ({ imageUrl, storagePath, name } = body);
    }

    console.log(`[Wardrobe Create] Running IngestionGraph for user ${userId}`);

    const graph = buildIngestionGraph();
    const result = await graph.invoke({
      imageUrl,
      userId,
      itemName: name,
      storagePath,
      parseAttempts: 0,
    });

    if (result.status === "failed" || result.error) {
      console.error("[Wardrobe Create] IngestionGraph failed:", result.error);
      return errorResponse(result.error ?? "Ingestion pipeline failed", 422);
    }

    // Fetch the persisted item to return a full response
    const wardrobeItemId = result.wardrobeItemId;
    if (!wardrobeItemId) {
      return errorResponse(
        "Item was processed but could not be retrieved",
        500,
      );
    }

    const item = await prisma.wardrobeItem.findUnique({
      where: { id: BigInt(wardrobeItemId) },
    });

    if (!item) {
      return errorResponse("Item persisted but not retrievable", 500);
    }

    console.log(
      `[Wardrobe Create] Item created: ${item.id} (needsReview: ${item.needsReview})`,
    );

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
        needsReview: item.needsReview,
        parseConfidence: item.parseConfidence,
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
