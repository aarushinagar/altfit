import { NextRequest } from "next/server";
import prisma from "@/backend/database/prisma";
import { requireAuth } from "@/backend/database/auth-middleware";
import {
  successResponse,
  errorResponse,
} from "@/backend/database/api-response";

/**
 * GET /api/user/subscription
 * Return the authenticated user's subscription record, or null if none exists.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const subscription = await prisma.subscription.findUnique({
      where: { userId: BigInt(userId) },
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
      error instanceof Error
        ? error.message
        : "Failed to retrieve subscription",
      500,
    );
  }
}
