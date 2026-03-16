/**
 * Tenant Isolation Middleware
 *
 * Ensures strict Row-Level Security (RLS) across all operations.
 * Every query verifies the authenticated user owns the resource.
 */

import { NextRequest } from "next/server";
import { errorResponse } from "./api-response";
import { getAuthenticatedUserId } from "./auth-middleware";

/**
 * Verify that the authenticated user owns a resource
 * @param request - NextRequest to extract authenticated user
 * @param resourceUserId - The userId of the resource being accessed
 * @returns Error response if unauthorized, null if authorized
 */
export function verifyTenantOwnership(
  request: NextRequest,
  resourceUserId: string,
): ReturnType<typeof errorResponse> | null {
  const authenticatedUserId = getAuthenticatedUserId(request);

  if (authenticatedUserId !== resourceUserId) {
    console.warn(
      `[Tenant Isolation] Unauthorized access: ${authenticatedUserId} tried to access resource of ${resourceUserId}`,
    );
    return errorResponse("Unauthorized: You cannot access this resource", 403);
  }

  return null;
}

/**
 * Verify that authenticated user can perform action on their own user record
 */
export function verifySelfAccess(
  request: NextRequest,
  targetUserId: string,
): ReturnType<typeof errorResponse> | null {
  return verifyTenantOwnership(request, targetUserId);
}

/**
 * Verify multiple resource ownership (e.g., checking if all items in an array belong to the user)
 */
export function verifyTenantOwnershipBatch(
  authenticatedUserId: string,
  resourceUserIds: string[],
): boolean {
  return resourceUserIds.every(
    (resourceUserId) => resourceUserId === authenticatedUserId,
  );
}

/**
 * Return the authenticated user's ID safely
 * Should be used before any database query
 */
export function getAuthenticatedAndVerify(request: NextRequest): string | null {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}
