/**
 * POST /api/auth/google
 *
 * Authenticate user with Google OAuth token
 *
 * Request body:
 * {
 *   "credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ..." // JWT from Google Identity Services
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
import { OAuth2Client } from "google-auth-library";
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
} from "@/lib/api-response";
import bcrypt from "bcryptjs";
import type { GoogleAuthRequest, AuthPayload } from "@/types/api";

interface GooglePayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleCredential(
  credential: string,
): Promise<GooglePayload> {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Invalid Google credential payload");
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    email_verified: payload.email_verified,
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log("[Auth Google] Processing Google OAuth request");

    const body = await request.json();
    const { credential } = body as GoogleAuthRequest;

    // Validate required fields
    const validation = validateRequired(body, ["credential"]);
    if (validation) return validation;

    // Verify credential with Google's public keys
    let googleData;
    try {
      googleData = await verifyGoogleCredential(credential);
    } catch (error) {
      console.warn("[Auth Google] Invalid credential:", error);
      return errorResponse("Invalid Google credential", 400);
    }

    const { sub: googleId, email, name, picture } = googleData;

    console.log(`[Auth Google] Verified Google user: ${email} (${googleId})`);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { googleId },
    });

    if (!user) {
      // Check if email is already registered
      user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Create new user
        console.log(`[Auth Google] Creating new user from Google: ${email}`);
        user = await prisma.user.create({
          data: {
            email,
            name: name || null,
            avatar: picture || null,
            googleId,
            provider: "google",
          },
        });

        console.log(`[Auth Google] New user created: ${user.id}`);
      } else {
        // Link Google account to existing email user
        console.log(
          `[Auth Google] Linking Google account to existing user: ${email}`,
        );
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            provider: "google",
            avatar: picture || user.avatar, // Update avatar if not set
          },
        });
      }
    } else if (user.avatar !== picture && picture) {
      // Update user's avatar from Google
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatar: picture },
      });
    }

    console.log(`[Auth Google] User authenticated: ${user.id}`);

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

    console.log(`[Auth Google] Tokens generated for user: ${user.id}`);

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
      "Google authentication successful",
      200,
    );

    // Set refresh token cookie
    setRefreshTokenCookie(response, refreshToken);

    return response;
  } catch (error) {
    console.error("[Auth Google] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Google authentication failed",
      500,
    );
  }
}
