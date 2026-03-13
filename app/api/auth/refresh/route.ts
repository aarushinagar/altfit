/**
 * POST /api/auth/refresh
 *
 * Refresh an expired access token using a refresh token
 * Refresh token should be sent in httpOnly cookie or request body
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "accessToken": "new_eyJhbGc...",
 *     "user": { ... }
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import {
  verifyToken,
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
  getRefreshTokenFromCookie,
} from "@/lib/jwt";
import { successResponse, errorResponse } from "@/lib/api-response";
import type { AuthPayload } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    console.log("[Auth Refresh] Processing token refresh request");

    // Get refresh token from cookie or body
    let refreshToken = getRefreshTokenFromCookie(request.headers.get("cookie"));

    if (!refreshToken) {
      const body = await request.json().catch(() => ({}));
      refreshToken = body.refreshToken;
    }

    if (!refreshToken) {
      console.warn("[Auth Refresh] No refresh token provided");
      return errorResponse("No refresh token provided", 401);
    }

    // Verify refresh token
    let payload;
    try {
      payload = verifyToken(refreshToken);
    } catch (error) {
      console.warn("[Auth Refresh] Invalid refresh token");
      return errorResponse("Invalid refresh token", 401);
    }

    // Find user and session
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      console.warn(`[Auth Refresh] User not found: ${payload.userId}`);
      return errorResponse("User not found", 401);
    }

    // Find active session (this is a simplified check)
    // In production, you'd want to verify the session record
    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (!sessions.length) {
      console.warn(`[Auth Refresh] No active session for user: ${user.id}`);
      return errorResponse("Session not found", 401);
    }

    const session = sessions[0];

    // Verify refresh token hash
    const isTokenValid = await bcrypt.compare(refreshToken, session.token);

    if (!isTokenValid) {
      console.warn(`[Auth Refresh] Invalid token hash for user: ${user.id}`);
      return errorResponse("Invalid refresh token", 401);
    }

    // Check if session expired
    if (new Date() > session.expiresAt) {
      console.warn(`[Auth Refresh] Session expired for user: ${user.id}`);
      await prisma.session.delete({ where: { id: session.id } });
      return errorResponse("Session expired", 401);
    }

    console.log(`[Auth Refresh] Token refresh valid for user: ${user.id}`);

    // Generate new tokens
    const newPayload = {
      userId: user.id,
      email: user.email,
      provider: user.provider,
    };

    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    // Update session with new refresh token
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 2);
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newRefreshTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    console.log(`[Auth Refresh] New tokens generated for user: ${user.id}`);

    // Prepare response
    const response = successResponse<AuthPayload>(
      {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          provider: user.provider,
          onboarded: user.onboarded,
        },
      },
      "Token refreshed successfully",
      200,
    );

    // Set new refresh token cookie
    setRefreshTokenCookie(response, newRefreshToken);

    return response;
  } catch (error) {
    console.error("[Auth Refresh] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Token refresh failed",
      500,
    );
  }
}
