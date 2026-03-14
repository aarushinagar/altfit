import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";

/**
 * GET /api/user/profile
 * Return authenticated user's public profile (no passwordHash or session tokens).
 */
export async function GET(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        provider: true,
        styleProfiles: true,
        styleIssues: true,
        onboarded: true,
        createdAt: true,
        _count: { select: { wardrobeItems: true, outfits: true } },
      },
    });

    if (!user) {
      return errorResponse("User not found", 404);
    }

    return successResponse(user, "Profile retrieved");
  } catch (error) {
    console.error("[user/profile GET] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to retrieve profile", 500);
  }
}

/**
 * PATCH /api/user/profile
 * Update user name or avatar URL.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json().catch(() => ({}));

    const { name, avatar } = body as { name?: string; avatar?: string };

    if (!name && !avatar) {
      return errorResponse(
        "Provide at least one field to update: name, avatar",
        400,
      );
    }

    const data: { name?: string; avatar?: string } = {};
    if (name !== undefined) data.name = name.trim().slice(0, 100);
    if (avatar !== undefined) data.avatar = avatar;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        provider: true,
        styleProfiles: true,
        styleIssues: true,
        onboarded: true,
        createdAt: true,
      },
    });

    return successResponse(user, "Profile updated");
  } catch (error) {
    console.error("[user/profile PATCH] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Failed to update profile", 500);
  }
}
