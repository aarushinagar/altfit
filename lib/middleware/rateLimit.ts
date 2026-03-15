/**
 * Rate Limiting Middleware (Upstash Redis)
 *
 * Production-ready rate limiting for serverless (Vercel).
 * Uses Upstash Redis - in-memory Map fails on serverless due to cold starts.
 *
 * If UPSTASH_REDIS_REST_URL is not set, rate limiting is bypassed (all requests allowed).
 */

import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { extractAccessToken } from "@/lib/auth-middleware";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const limiters = redis
  ? {
      auth: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m") }),
      payment: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 m") }),
      wardrobe: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m") }),
      upload: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 m") }),
    }
  : null;

function getIdentifier(request: NextRequest, byUserId: boolean): string {
  if (byUserId) {
    try {
      const token = extractAccessToken(request);
      if (token) {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString()
        );
        if (payload.userId) return payload.userId;
      }
    } catch {
      /* ignore */
    }
  }
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous"
  );
}

async function applyRateLimit(
  request: NextRequest,
  type: keyof NonNullable<typeof limiters>,
  byUserId: boolean
): Promise<NextResponse | null> {
  if (!limiters) return null;

  const identifier = getIdentifier(request, byUserId);
  const { success, reset } = await limiters[type].limit(identifier);

  if (!success) {
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
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
  return null;
}

export const rateLimitAuth = (req: NextRequest) =>
  applyRateLimit(req, "auth", false);
export const rateLimitPayment = (req: NextRequest) =>
  applyRateLimit(req, "payment", true);
export const rateLimitWardrobe = (req: NextRequest) =>
  applyRateLimit(req, "wardrobe", true);
export const rateLimitUpload = (req: NextRequest) =>
  applyRateLimit(req, "upload", true);
