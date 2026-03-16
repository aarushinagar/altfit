/**
 * Authentication Middleware Utilities
 *
 * Provides middleware functions to protect API routes and extract user context
 */

import { NextRequest } from "next/server";
import { verifyToken, extractUserIdFromToken } from "./jwt";
import { errorResponse } from "./api-response";

/**
 * Extract JWT access token from Authorization header
 *
 * @param request - Next.js Request object
 * @returns Access token or null
 */
export function extractAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    console.log("[Auth] No authorization header found");
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    console.warn("[Auth] Invalid authorization header format");
    return null;
  }

  return parts[1];
}

/**
 * Get authenticated user ID from request
 * Extracts and verifies JWT from Authorization header
 *
 * @param request - Next.js Request object
 * @returns User ID if authenticated
 * @throws Error if not authenticated
 */
export function getAuthenticatedUserId(request: NextRequest): string {
  const token = extractAccessToken(request);

  if (!token) {
    console.warn("[Auth] No access token found in request");
    throw new Error("Unauthorized: No access token provided");
  }

  const userId = extractUserIdFromToken(token);

  if (!userId) {
    console.warn("[Auth] Failed to extract user ID from token");
    throw new Error("Unauthorized: Invalid token");
  }

  console.log(`[Auth] Authenticated user: ${userId}`);
  return userId;
}

/**
 * Middleware function to authenticate API routes
 * Returns error response if not authenticated
 *
 * Example usage:
 * ```
 * export async function GET(request: NextRequest) {
 *   const authError = authenticateRequest(request)
 *   if (authError) return authError
 *
 *   const userId = getAuthenticatedUserId(request)
 *   // ... rest of handler
 * }
 * ```
 *
 * @param request - Next.js Request object
 * @returns Error response if not authenticated, null if valid
 */
export function authenticateRequest(request: NextRequest) {
  try {
    getAuthenticatedUserId(request);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    console.error(`[Auth] Authentication failed: ${message}`);
    return errorResponse(message, 401);
  }
}

/**
 * Verify that the user is accessing their own data (user isolation)
 *
 * @param requestUserId - User ID from request
 * @param dataOwnerId - User ID of data being accessed
 * @returns true if user is authorized
 */
export function isUserAuthorized(
  requestUserId: string,
  dataOwnerId: string,
): boolean {
  const authorized = requestUserId === dataOwnerId;

  if (!authorized) {
    console.warn(
      `[Auth] Unauthorized access attempt: User ${requestUserId} tried to access data owned by ${dataOwnerId}`,
    );
  }

  return authorized;
}
