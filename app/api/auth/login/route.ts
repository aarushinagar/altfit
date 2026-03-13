/**
 * POST /api/auth/login
 *
 * Authenticate user with email and password
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "accessToken": "eyJhbGc...",
 *     "user": { ... }
 *   }
 * }
 */

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import {
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
} from "@/lib/jwt";
import {
  successResponse,
  errorResponse,
  validateRequired,
  isValidEmail,
} from "@/lib/api-response";
import type { LoginRequest, AuthPayload } from "@/types/api";

export async function POST(request: NextRequest) {
  try {
    console.log("[Auth Login] Processing login request");

    const body = await request.json();
    const { email, password } = body as LoginRequest;

    // Validate required fields
    const validation = validateRequired(body, ["email", "password"]);
    if (validation) return validation;

    // Validate email format
    if (!isValidEmail(email)) {
      console.warn(`[Auth Login] Invalid email format: ${email}`);
      return errorResponse("Invalid email or password", 400);
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      console.warn(`[Auth Login] User not found or no password set: ${email}`);
      return errorResponse("Invalid email or password", 400);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      console.warn(`[Auth Login] Invalid password for user: ${email}`);
      return errorResponse("Invalid email or password", 400);
    }

    console.log(`[Auth Login] User authenticated: ${user.id}`);

    // Generate tokens
    const payload = {
      userId: user.id,
      email: user.email,
      provider: user.provider,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in database (hashed)
    const refreshTokenHash = await bcrypt.hash(refreshToken, 2);
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    console.log(`[Auth Login] Tokens generated for user: ${user.id}`);

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
      "Login successful",
      200,
    );

    // Set refresh token cookie
    setRefreshTokenCookie(response, refreshToken);

    return response;
  } catch (error) {
    console.error("[Auth Login] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Login failed",
      500,
    );
  }
}
