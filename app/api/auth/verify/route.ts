/**
 * GET /api/auth/verify
 *
 * Verify if a JWT token is valid without refreshing it
 * Useful for frontend to check token validity
 *
 * Headers:
 * - Authorization: Bearer <token>
 *
 * Response (Valid Token):
 * {
 *   "success": true,
 *   "data": {
 *     "valid": true,
 *     "user": {
 *       "id": "...",
 *       "email": "...",
 *       "provider": "email|google"
 *     },
 *     "expiresAt": 1234567890
 *   }
 * }
 *
 * Response (Invalid/Expired Token):
 * {
 *   "success": true,
 *   "data": {
 *     "valid": false,
 *     "reason": "Token expired" | "Invalid token"
 *   }
 * }
 */

import { NextRequest } from "next/server";
import { extractAccessToken } from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { verifyToken } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    console.log("[Auth Verify] Verifying token");

    // Extract token from Authorization header
    const token = extractAccessToken(request);

    if (!token) {
      console.log("[Auth Verify] No token provided");
      return successResponse(
        {
          valid: false,
          reason: "No token provided",
        },
        "Token verification result",
        200
      );
    }

    try {
      // Verify token without refreshing it
      const decoded = verifyToken(token);

      console.log(`[Auth Verify] Token is valid for user: ${decoded.userId}`);

      // Calculate expiration time from token
      const expiresAt = decoded.exp ? decoded.exp * 1000 : null;

      return successResponse(
        {
          valid: true,
          user: {
            id: decoded.userId,
            email: decoded.email,
            provider: decoded.provider,
          },
          expiresAt,
        },
        "Token is valid",
        200
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Token verification failed";

      console.warn(`[Auth Verify] Token verification failed: ${reason}`);

      return successResponse(
        {
          valid: false,
          reason,
        },
        "Token verification result",
        200
      );
    }
  } catch (error) {
    console.error("[Auth Verify] Unexpected error:", error);

    return errorResponse("Token verification failed", 500);
  }
}
