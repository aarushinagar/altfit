/**
 * Prisma Client Singleton
 *
 * Ensures we only have one Prisma client instance across the application
 * This prevents connection pool exhaustion in serverless environments
 *
 * In Prisma 7, the database URL is configured in prisma.config.js
 */

import { PrismaClient } from "@prisma/client";

declare global {
  // Prevent TypeScript errors by allowing globalThis extension
  var prisma: PrismaClient | undefined;
}

/**
 * Instantiate Prisma Client
 */
const prisma =
  global.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
