/**
 * Razorpay Payment Verification Endpoint
 * Verifies payment signature and saves subscription to database
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/backend/database/prisma";
import { requireAuth } from "@/backend/database/auth-middleware";
import { generateSnowflakeId } from "@/backend/database/snowflake";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim();

const PLAN_AMOUNTS = {
  monthly: 19900, // ₹199 in paise
  yearly: 69900,  // ₹699 in paise
};

function logError(context, error, metadata = {}) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR in ${context}:`, {
    message: error?.message || error,
    metadata,
    stack: error?.stack,
  });
}

function logSuccess(context, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] SUCCESS in ${context}:`, {
    message,
    metadata,
  });
}

/**
 * POST /api/razorpay-verify-payment
 * Verifies payment signature and upserts subscription record
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    if (!RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "Server configuration error: Missing verification key" },
        { status: 500 }
      );
    }

    // Auth check
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
    } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid request: missing order_id, payment_id, or signature" },
        { status: 400 }
      );
    }

    if (!plan || !PLAN_AMOUNTS[plan]) {
      return NextResponse.json(
        { error: `Invalid plan. Must be "monthly" or "yearly".` },
        { status: 400 }
      );
    }

    // Verify HMAC-SHA256 signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      logError("POST /api/razorpay-verify-payment", "Signature mismatch", {
        orderId: razorpay_order_id,
      });
      return NextResponse.json(
        { error: "Payment verification failed: Invalid signature" },
        { status: 400 }
      );
    }

    // Calculate expiry
    const now = new Date();
    const expiresAt = new Date(now);
    if (plan === "yearly") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // Upsert subscription in database
    const subscription = await prisma.subscription.upsert({
      where: { userId: BigInt(userId) },
      update: {
        plan,
        status: "active",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        amount: PLAN_AMOUNTS[plan],
        currency: "INR",
        startedAt: now,
        expiresAt,
        cancelledAt: null,
        updatedAt: now,
      },
      create: {
        id: generateSnowflakeId(),
        userId: BigInt(userId),
        plan,
        status: "active",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        amount: PLAN_AMOUNTS[plan],
        currency: "INR",
        startedAt: now,
        expiresAt,
      },
    });

    logSuccess("POST /api/razorpay-verify-payment", "Payment verified + subscription saved", {
      userId,
      plan,
      subscriptionId: subscription.id.toString(),
      expiresAt,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: true,
        plan,
        message: "Payment verified successfully",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    logError("POST /api/razorpay-verify-payment", error, {
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: error.message || "Payment verification failed" },
      { status: 500 }
    );
  }
}