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

    const [user, subscription] = await prisma.$transaction([
      prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { plan: true },
      }),
      prisma.subscription.findUnique({
        where: { userId: BigInt(userId) },
        select: {
          id: true,
          userId: true,
          plan: true,
          status: true,
          startedAt: true,
          expiresAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
          // Deliberately omit razorpaySignature per security policy
        },
      }),
    ]);

    return successResponse(
      {
        accessPlan: user?.plan ?? "free",
        billingPlan: subscription?.plan ?? null,
        status: subscription?.status ?? null,
        expiresAt: subscription?.expiresAt ?? null,
        startedAt: subscription?.startedAt ?? null,
        cancelledAt: subscription?.cancelledAt ?? null,
        subscriptionId: subscription?.id ?? null,
        createdAt: subscription?.createdAt ?? null,
        updatedAt: subscription?.updatedAt ?? null,
      },
      "Subscription retrieved",
    );
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
