/**
 * Rate Limiting Middleware
 *
 * This module provides rate limiting functionality for API routes
 * Supports both IP-based (for public endpoints) and user-based (for authenticated endpoints) limiting
 *
 * Usage:
 * ```
 * import { rateLimit } from "@/lib/middleware/rateLimit";
 *
 * export async function POST(request: NextRequest) {
 *   const rateLimitError = await rateLimit(request, {
 *     key: "auth-login",
 *     limit: 10,
 *     window: 60 * 1000, // 60 seconds in milliseconds
 *   });
 *
 *   if (rateLimitError) return rateLimitError;
 *   // ... rest of handler
 * }
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { extractAccessToken } from "@/lib/auth-middleware";

/**
 * In-memory store for rate limit tracking
 * Format: { "key:identifier": { count: number, resetAt: number } }
 *
 * NOTE: In production, use Redis instead of in-memory storage
 * For now, this works for single-instance deployments
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired entries to prevent memory leaks
 * Runs periodically in the background
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Get client IP address from request
 * Checks multiple headers for proxy forwarding
 */
function getClientIP(request: NextRequest): string {
  // Check X-Forwarded-For header (set by proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // Check X-Real-IP header
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to connection IP (localhost in development)
  return request.headers.get("cf-connecting-ip") || "unknown";
}

/**
 * Extract userId from JWT token in request
 */
function getUserId(request: NextRequest): string | null {
  try {
    const token = extractAccessToken(request);
    if (!token) return null;

    // Decode JWT payload without verification (for rate limiting only)
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8")
    );
    return payload.userId || null;
  } catch {
    return null;
  }
}

/**
 * Rate limiting options
 */
export interface RateLimitOptions {
  /**
   * Unique key for this rate limit rule
   * Example: "auth-login", "payment-verify", "wardrobe-upload"
   */
  key: string;

  /**
   * Maximum number of requests allowed
   * Default: 10
   */
  limit?: number;

  /**
   * Time window in milliseconds
   * Default: 60000 (1 minute)
   */
  window?: number;

  /**
   * Use user ID instead of IP address for tracking
   * Set to true for authenticated endpoints
   * Default: false
   */
  byUserId?: boolean;

  /**
   * Custom identifier function
   * If provided, overrides default IP/userId logic
   */
  customIdentifier?: (request: NextRequest) => string | null;
}

/**
 * Rate limiting middleware for API routes
 *
 * Returns error response if rate limit exceeded, null otherwise
 *
 * Example:
 * ```
 * const rateLimitError = await rateLimit(request, {
 *   key: "auth-login",
 *   limit: 10,
 *   window: 60 * 1000,
 * });
 *
 * if (rateLimitError) return rateLimitError; // Rate limited
 * ```
 */
export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const {
    key,
    limit = 10,
    window = 60 * 1000,
    byUserId = false,
    customIdentifier,
  } = options;

  // Determine identifier based on options
  let identifier: string | null;

  if (customIdentifier) {
    identifier = customIdentifier(request);
  } else if (byUserId) {
    identifier = getUserId(request);
    if (!identifier) {
      // If user ID cannot be extracted, fall back to IP
      identifier = getClientIP(request);
    }
  } else {
    identifier = getClientIP(request);
  }

  if (!identifier) {
    console.warn("[RateLimit] Could not determine identifier for rate limiting");
    // Don't block if we can't identify, but log it
    return null;
  }

  // Create cache key
  const cacheKey = `${key}:${identifier}`;
  const now = Date.now();

  // Get current rate limit entry
  let entry = rateLimitStore.get(cacheKey);

  // If entry doesn't exist or is expired, create new one
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + window,
    };
    rateLimitStore.set(cacheKey, entry);
  }

  // Increment counter
  entry.count++;

  // Check if limit exceeded
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

    console.warn("[RateLimit] Rate limit exceeded", {
      key,
      identifier,
      count: entry.count,
      limit,
      retryAfter,
    });

    // Return 429 Too Many Requests
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: "Too many requests. Please try again later.",
      }),
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Allow request
  return null;
}

/**
 * Specific rate limiter for authentication endpoints
 * Limits: 10 requests per 60 seconds per IP
 */
export async function rateLimitAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  return rateLimit(request, {
    key: "auth",
    limit: 10,
    window: 60 * 1000,
    byUserId: false,
  });
}

/**
 * Specific rate limiter for payment endpoints
 * Limits: 5 requests per 60 seconds per user
 */
export async function rateLimitPayment(
  request: NextRequest
): Promise<NextResponse | null> {
  return rateLimit(request, {
    key: "payment",
    limit: 5,
    window: 60 * 1000,
    byUserId: true,
  });
}

/**
 * Specific rate limiter for wardrobe endpoints
 * Limits: 30 requests per 60 seconds per user
 */
export async function rateLimitWardrobe(
  request: NextRequest
): Promise<NextResponse | null> {
  return rateLimit(request, {
    key: "wardrobe",
    limit: 30,
    window: 60 * 1000,
    byUserId: true,
  });
}

/**
 * Specific rate limiter for file upload endpoints
 * Limits: 5 uploads per 60 seconds per user
 */
export async function rateLimitUpload(
  request: NextRequest
): Promise<NextResponse | null> {
  return rateLimit(request, {
    key: "upload",
    limit: 5,
    window: 60 * 1000,
    byUserId: true,
  });
}

/**
 * Reset rate limit counter for a specific key/identifier
 * Useful for testing or manual intervention
 */
export function resetRateLimit(key: string, identifier: string): void {
  const cacheKey = `${key}:${identifier}`;
  rateLimitStore.delete(cacheKey);
  console.log("[RateLimit] Reset rate limit counter", { cacheKey });
}

/**
 * Get current rate limit status for debugging
 */
export function getRateLimitStatus(key: string, identifier: string) {
  const cacheKey = `${key}:${identifier}`;
  const entry = rateLimitStore.get(cacheKey);

  if (!entry) {
    return {
      key,
      identifier,
      count: 0,
      status: "no_limit",
    };
  }

  return {
    key,
    identifier,
    count: entry.count,
    resetAt: new Date(entry.resetAt),
    status: "active",
  };
}
