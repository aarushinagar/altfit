/**
 * POST /api/auth/register
 *
 * Register a new user with email and password
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123",
 *   "name": "John Doe" (optional)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "accessToken": "eyJhbGc...",
 *     "user": {
 *       "id": "user_id",
 *       "email": "user@example.com",
 *       "name": "John Doe",
 *       ...
 *     }
 *   }
 * }
 */

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma, { withDbRetry, dbErrorMessage } from "@/backend/database/prisma";
import {
  generateAccessToken,
  generateRefreshToken,
  setRefreshTokenCookie,
} from "@/backend/database/jwt";
import {
  successResponse,
  errorResponse,
  validateRequired,
  isValidEmail,
  validatePassword,
} from "@/backend/database/api-response";
import {
  generatePrismaId,
  toPrismaId,
} from "@/backend/database/prisma-id";
import type { RegisterRequest, AuthPayload } from "@/types/api";
import { sendWelcomeEmail } from "@/lib/email/welcome";

export async function POST(request: NextRequest) {
  try {
    console.log("[Auth Register] Processing registration request");

    const body = await request.json();
    const { email, password, name, phone } = body as RegisterRequest;

    // Validate required fields
    const validation = validateRequired(body, ["email", "password", "phone"]);
    if (validation) return validation;

    // Validate email format
    if (!isValidEmail(email)) {
      console.warn(`[Auth Register] Invalid email format: ${email}`);
      return errorResponse("Invalid email format", 400);
    }

    // Validate phone format (E.164: +[country code][number], at least 10 digits)
    const phoneRegex = /^\+\d{10,}$/;
    const normalizedPhone = phone.replace(/[\s\-()]/g, "");
    if (!phoneRegex.test(normalizedPhone)) {
      console.warn(`[Auth Register] Invalid phone format: ${phone}`);
      return errorResponse("Phone must be in E.164 format (e.g., +919876543210)", 400);
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      console.warn(
        `[Auth Register] Weak password: ${passwordValidation.message}`,
      );
      return errorResponse(
        passwordValidation.message || "Password is too weak",
        400,
      );
    }

    // Check if user already exists
    const existingUser = await withDbRetry(() =>
      prisma.user.findUnique({ where: { email } })
    );

    if (existingUser) {
      console.warn(`[Auth Register] User already exists: ${email}`);
      return errorResponse("User with this email already exists", 400);
    }

    console.log(`[Auth Register] Creating new user: ${email}`);

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log("[Auth Register] Password hashed successfully");

    // Create user
    const user = await prisma.user.create({
      data: {
        id: generatePrismaId("User") as never,
        email,
        phone: normalizedPhone,
        name: name || null,
        passwordHash,
        provider: "email",
      },
    });

    console.log(`[Auth Register] User created successfully: ${user.id}`);

    // Send welcome email (non-blocking — don't await)
    sendWelcomeEmail(user.email, user.name, user.provider).catch((err) =>
      console.error("[Auth Register] Welcome email failed:", err)
    );

    // Generate tokens
    const payload = {
      userId: user.id.toString(),
      email: user.email,
      provider: user.provider,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in database (hashed)
    const refreshTokenHash = await bcrypt.hash(refreshToken, 2); // Lower rounds for token storage
    await prisma.session.create({
      data: {
        id: generatePrismaId("Session") as never,
        userId: toPrismaId("Session", "userId", user.id) as never,
        token: refreshTokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    console.log(`[Auth Register] Tokens generated for user: ${user.id}`);

    // Prepare response
    const response = successResponse<AuthPayload>(
      {
        accessToken,
        user: {
          id: user.id.toString(),
          email: user.email,
          phone: user.phone,
          name: user.name,
          avatar: user.avatar,
          provider: user.provider,
          onboarded: user.onboarded,
        },
      },
      "User registered successfully",
      201,
    );

    // Set refresh token cookie
    setRefreshTokenCookie(response, refreshToken);

    return response;
  } catch (error) {
    console.error("[Auth Register] Error:", error);
    return errorResponse(dbErrorMessage(error, "Registration failed. Please try again."), 500);
  }
}
