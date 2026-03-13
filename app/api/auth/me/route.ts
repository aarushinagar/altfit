/**
 * GET /api/auth/me
 *
 * Get current authenticated user information
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": { ... }
 *   }
 * }
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    console.log("[Auth Me] Getting current user");

    // Authenticate user
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.warn(`[Auth Me] User not found: ${userId}`);
      return successResponse(null, "User not found", 404);
    }

    console.log(`[Auth Me] Retrieved user: ${user.id}`);

    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          provider: user.provider,
          onboarded: user.onboarded,
          styleProfiles: user.styleProfiles,
          styleIssues: user.styleIssues,
        },
      },
      "User retrieved successfully",
      200,
    );
  } catch (error) {
    console.error("[Auth Me] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get user";
    return successResponse(null, message, 500);
  }
}
