/**
 * Razorpay Payment Verification Endpoint
 * Verifies payment signature to ensure payment authenticity
 */

import crypto from "crypto";
import { NextResponse } from "next/server";

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

/**
 * Logs structured error information
 */
function logError(context, error, metadata = {}) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR in ${context}:`, {
    message: error?.message || error,
    metadata,
    stack: error?.stack,
  });
}

/**
 * Logs structured success information
 */
function logSuccess(context, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] SUCCESS in ${context}:`, {
    message,
    metadata,
  });
}

/**
 * POST /api/razorpay-verify-payment
 * Verifies payment signature and confirms successful payment
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    // Validate environment
    if (!RAZORPAY_KEY_SECRET) {
      logError(
        "POST /api/razorpay-verify-payment",
        "Missing RAZORPAY_KEY_SECRET environment variable"
      );
      return NextResponse.json(
        { error: "Server configuration error: Missing verification key" },
        { status: 500 }
      );
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
    } = await request.json();

    // Validate request
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        {
          error: "Invalid request: missing order_id, payment_id, or signature",
        },
        { status: 400 }
      );
    }

    logSuccess("POST /api/razorpay-verify-payment", "Verification request received", {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      plan,
    });

    // Verify signature (HMAC-SHA256)
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      logError(
        "POST /api/razorpay-verify-payment",
        "Signature verification failed",
        {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
        }
      );

      return NextResponse.json(
        { error: "Payment verification failed: Invalid signature" },
        { status: 400 }
      );
    }

    logSuccess(
      "POST /api/razorpay-verify-payment",
      "Payment verified successfully",
      {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        plan,
        processingTimeMs: Date.now() - startTime,
      }
    );

    return NextResponse.json(
      {
        success: true,
        plan,
        message: "Payment verified successfully",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
      },
      { status: 200 }
    );
  } catch (error) {
    logError("POST /api/razorpay-verify-payment", error, {
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        error: error.message || "Payment verification failed",
      },
      { status: 500 }
    );
  }
}