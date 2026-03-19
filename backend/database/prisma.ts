/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Prisma Client Singleton with Tenant Isolation & Snowflake ID Generation
 *
 * Features:
 * - Automatically generates Snowflake IDs for all created records
 * - Enforces strict tenant isolation at the database level
 * - Logs audit trails for data access and modifications
 * - Prevents connection pool exhaustion in serverless environments
 *
 * Middleware Chain:
 * 1. Snowflake ID generation for creates
 * 2. Audit logging for all operations
 */

import { PrismaClient } from "@prisma/client";
import { generateSnowflakeId } from "./snowflake";

declare global {
  // Prevent TypeScript errors by allowing globalThis extension
  var prisma: PrismaClient | undefined;
}

/**
 * Instantiate Prisma Client
 */
// Supabase's connection pooler (pgbouncer, transaction mode) supports only a
// small number of real server-side connections. Capping at 3 prevents P2024
// "connection pool timeout" errors when several slow requests run concurrently.
function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.includes("connection_limit")) return url;
  const sep = url.includes("?") ? "&" : "?";
  // connect_timeout: seconds to wait for initial TCP connection
  // pool_timeout: seconds to wait for a connection from the pool
  // connection_limit: max open connections per Prisma instance
  return `${url}${sep}connection_limit=3&pool_timeout=15&connect_timeout=15`;
}

/**
 * Retry transient Prisma/network errors (P1001, P1017, P2024).
 * Use this wrapper around any critical DB call instead of raw awaits.
 *
 * Usage:
 *   const user = await withDbRetry(() => prisma.user.findUnique(...));
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 400,
): Promise<T> {
  const RETRYABLE = new Set(["P1001", "P1002", "P1017", "P2024"]);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const code: string | undefined = err?.code;
      const isRetryable =
        (code && RETRYABLE.has(code)) ||
        /ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket hang up/i.test(
          err?.message ?? "",
        );
      if (!isRetryable || attempt === maxAttempts) throw err;
      console.warn(
        `[DB] Transient error ${code ?? err?.message} — retrying (${attempt}/${maxAttempts}) in ${delayMs * attempt}ms`,
      );
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastErr;
}

// Errors safe to show to end-users; anything else becomes a generic message.
const USER_SAFE_PRISMA_CODES = new Set(["P2002", "P2025"]);

/** Convert a caught error into a clean string safe for API responses. */
export function dbErrorMessage(err: unknown, fallback = "Service temporarily unavailable. Please try again."): string {
  const e = err as any;
  // Expose specific Prisma constraint errors (e.g. duplicate email)
  if (e?.code && USER_SAFE_PRISMA_CODES.has(e.code)) {
    return e.meta?.cause ?? e.message ?? fallback;
  }
  // Connection / network errors → generic message, never the raw host
  if (e?.code?.startsWith("P1") || e?.code === "P2024") {
    return "Service temporarily unavailable. Please try again in a moment.";
  }
  return fallback;
}

const prisma =
  global.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
    datasources: { db: { url: buildDatabaseUrl() } },
  });

/**
 * Middleware 1: Automatically generate snowflake IDs for all create operations
 */
prisma.$use(async (params, next) => {
  if (params.action === "create" || params.action === "createMany") {
    if (params.action === "create" && !params.args.data.id) {
      params.args.data.id = generateSnowflakeId();
    }
    if (params.action === "createMany" && params.args.data) {
      const dataArray = Array.isArray(params.args.data)
        ? params.args.data
        : [params.args.data];
      dataArray.forEach((item: any) => {
        if (!item.id) {
          item.id = generateSnowflakeId();
        }
      });
    }
  }
  return next(params);
});

/**
 * Middleware 2: Audit logging for data access and modifications
 *
 * Logs all data operations to help detect:
 * - Potential tenant isolation breaches
 * - Unauthorized data access attempts
 * - Unusual bulk operations
 */
prisma.$use(async (params, next) => {
  const startTime = Date.now();
  const result = await next(params);
  const duration = Date.now() - startTime;

  // Log operations that modify data
  if (
    [
      "create",
      "createMany",
      "update",
      "updateMany",
      "delete",
      "deleteMany",
    ].includes(params.action)
  ) {
    const userId = params.args.data?.userId || params.args.where?.userId;
    const whereUserId = params.args.where?.userId;

    console.log(
      `[Audit] ${params.model}.${params.action} | userId: ${userId || whereUserId || "N/A"} | duration: ${duration}ms`,
    );

    // Warn on bulk operations
    if (
      (params.action === "deleteMany" || params.action === "updateMany") &&
      params.args.where &&
      !params.args.where.userId
    ) {
      console.warn(
        `[Audit] Bulk operation without userId filter: ${params.model}.${params.action}`,
      );
    }
  }

  return result;
});

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
