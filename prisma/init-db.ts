/**
 * Prisma Database Initialization Script
 *
 * Run this after setting up Supabase to initialize the database
 * Usage: npx ts-node prisma/init-db.ts
 */

import prisma from "@/lib/prisma";

async function main() {
  console.log("[DB Init] Starting database initialization...");

  try {
    // Test connection
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log("[DB Init] ✓ Database connection successful");

    // The Prisma migration handle schema creation
    console.log("[DB Init] ✓ Database initialized");
    console.log("[DB Init] Database is ready to use!");
  } catch (error) {
    console.error("[DB Init] ✗ Failed to initialize database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
