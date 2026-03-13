/**
 * JWT Authentication Utilities
 *
 * Handles JWT token generation, verification, and refresh logic
 * Uses httpOnly cookies for refresh tokens (secure in browser)
 * Uses in-memory storage for access tokens (can be cleared on logout)
 */

import jwt, { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import { NextResponse } from "next/server";

const JWT_SECRET =
  process.env.JWT_SECRET || "dev-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

/**
 * JWT Payload interface
 */
export interface JWTPayload {
  userId: string;
  email: string;
  provider: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate an access token
 * Short-lived token (15 minutes by default)
 *
 * @param payload - Token payload containing user data
 * @returns Signed JWT access token
 */
export function generateAccessToken(
  payload: Omit<JWTPayload, "iat" | "exp">,
): string {
  console.log(`[JWT] Generating access token for user: ${payload.userId}`);

  const token = jwt.sign(
    payload,
    JWT_SECRET as any,
    {
      expiresIn: JWT_EXPIRES_IN,
      algorithm: "HS256",
    } as any,
  );

  return token;
}

/**
 * Generate a refresh token
 * Long-lived token (30 days by default)
 * Should be stored in httpOnly cookie
 *
 * @param payload - Token payload containing user data
 * @returns Signed JWT refresh token
 */
export function generateRefreshToken(
  payload: Omit<JWTPayload, "iat" | "exp">,
): string {
  console.log(`[JWT] Generating refresh token for user: ${payload.userId}`);

  const token = jwt.sign(
    payload,
    JWT_SECRET as any,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      algorithm: "HS256",
    } as any,
  );

  return token;
}

/**
 * Verify a JWT token
 *
 * @param token - JWT token to verify
 * @returns Decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    console.log(`[JWT] Token verified for user: ${decoded.userId}`);
    return decoded;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      console.warn(`[JWT] Token expired at: ${error.expiredAt}`);
      throw new Error("Token expired");
    }
    if (error instanceof JsonWebTokenError) {
      console.warn(`[JWT] Invalid token: ${error.message}`);
      throw new Error("Invalid token");
    }
    throw error;
  }
}

/**
 * Extract user ID from JWT token
 *
 * @param token - JWT token
 * @returns User ID or null if invalid
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    const payload = verifyToken(token);
    return payload.userId;
  } catch {
    return null;
  }
}

/**
 * Set refresh token as httpOnly cookie
 *
 * @param response - Next.js response object
 * @param token - Refresh token to set
 */
export function setRefreshTokenCookie(
  response: NextResponse,
  token: string,
): void {
  console.log("[JWT] Setting refresh token cookie");

  response.cookies.set("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    path: "/",
  });
}

/**
 * Clear refresh token cookie
 *
 * @param response - Next.js response object
 */
export function clearRefreshTokenCookie(response: NextResponse): void {
  console.log("[JWT] Clearing refresh token cookie");

  response.cookies.set("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

/**
 * Get refresh token from cookie
 *
 * @param cookieHeaderValue - Cookie header value from request
 * @returns Refresh token or null
 */
export function getRefreshTokenFromCookie(
  cookieHeaderValue: string | null,
): string | null {
  if (!cookieHeaderValue) return null;

  const cookies = cookieHeaderValue.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "refreshToken") {
      return decodeURIComponent(value);
    }
  }

  return null;
}
