import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";

/**
 * GET /api/user/subscription
 * Return the authenticated user's subscription record, or null if none exists.
 */
export async function GET(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        plan: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // Deliberately omit razorpaySignature per security policy
      },
    });

    return successResponse(subscription ?? null, "Subscription retrieved");
  } catch (error) {
    console.error("[user/subscription GET] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to retrieve subscription",
      500,
    );
  }
}
