/**
 * POST /api/auth/logout
 *
 * Logout user by invalidating their refresh token
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Logged out successfully"
 * }
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse } from "@/lib/api-response";
import { clearRefreshTokenCookie } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    console.log("[Auth Logout] Processing logout request");

    // Authenticate user
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    // Delete all sessions for this user
    await prisma.session.deleteMany({
      where: { userId },
    });

    console.log(`[Auth Logout] Sessions deleted for user: ${userId}`);

    // Prepare response
    const response = successResponse(
      { message: "Logged out successfully" },
      "Logout successful",
      200,
    );

    // Clear refresh token cookie
    clearRefreshTokenCookie(response);

    return response;
  } catch (error) {
    console.error("[Auth Logout] Error:", error);
    const message = error instanceof Error ? error.message : "Logout failed";

    // Still clear cookie on error
    const response = successResponse({ message }, message, 200);
    clearRefreshTokenCookie(response);

    return response;
  }
}
