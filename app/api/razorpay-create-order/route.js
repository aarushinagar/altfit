/**
 * Razorpay Order Creation Endpoint
 * Creates a new Razorpay order for payment processing
 * Handles payment plan selection and user information
 */

import { NextResponse } from "next/server";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
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
 * Plan pricing configuration (in paise - 1 rupee = 100 paise)
 */
const PLANS = {
  pro: {
    amount: 49900, // ₹499
    currency: "INR",
    description: "Pro Plan - Monthly",
  },
  premium: {
    amount: 199900, // ₹1,999
    currency: "INR",
    description: "Premium Plan - Monthly",
  },
  lifetime: {
    amount: 999900, // ₹9,999
    currency: "INR",
    description: "Lifetime Access",
  },
};

/**
 * POST /api/razorpay-create-order
 * Creates a Razorpay order for the selected plan
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    // Validate environment
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      logError(
        "POST /api/razorpay-create-order",
        "Missing Razorpay credentials"
      );
      return NextResponse.json(
        { error: "Server configuration error: Missing payment gateway credentials" },
        { status: 500 }
      );
    }

    const { plan, userEmail } = await request.json();

    // Validate request
    if (!plan || !PLANS[plan]) {
      return NextResponse.json(
        {
          error: `Invalid plan. Must be one of: ${Object.keys(PLANS).join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!userEmail || typeof userEmail !== "string") {
      return NextResponse.json(
        { error: "Invalid request: missing or invalid userEmail" },
        { status: 400 }
      );
    }

    logSuccess("POST /api/razorpay-create-order", "Request received", {
      plan,
      userEmail: userEmail.replace(/[^@]/g, "*"), // Log anonymized email
    });

    const planConfig = PLANS[plan];

    // Call Razorpay API to create order
    const orderResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Basic Auth: username:password (base64 encoded)
          Authorization: `Basic ${Buffer.from(
            `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
          ).toString("base64")}`,
        },
        body: JSON.stringify({
          amount: planConfig.amount,
          currency: planConfig.currency,
          receipt: `order_${Date.now()}`,
          notes: {
            plan,
            userEmail,
            createdAt: new Date().toISOString(),
          },
        }),
      }
    );

    if (!orderResponse.ok) {
      const errorBody = await orderResponse.text().catch(() => orderResponse.statusText);
      logError("POST /api/razorpay-create-order", "Razorpay API Error", {
        status: orderResponse.status,
        body: errorBody.substring(0, 200),
      });

      throw new Error(
        `Razorpay API Error ${orderResponse.status}: ${errorBody.substring(0, 200)}`
      );
    }

    const orderData = await orderResponse.json();

    if (!orderData.id) {
      logError(
        "POST /api/razorpay-create-order",
        "Invalid Razorpay response",
        { orderData }
      );
      throw new Error("Razorpay returned invalid order response");
    }

    logSuccess("POST /api/razorpay-create-order", "Order created successfully", {
      orderId: orderData.id,
      amount: orderData.amount,
      plan,
      processingTimeMs: Date.now() - startTime,
    });

    // Return order details for frontend
    return NextResponse.json(
      {
        keyId: RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        orderId: orderData.id,
        email: userEmail,
        plan,
      },
      { status: 200 }
    );
  } catch (error) {
    logError("POST /api/razorpay-create-order", error, {
      processingTimeMs: Date.now() - startTime,
    });

    const statusCode = error.message.includes("Invalid request") ? 400 : 500;

    return NextResponse.json(
      {
        error: error.message || "Failed to create payment order",
      },
      { status: statusCode }
    );
  }
}