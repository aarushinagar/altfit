#!/usr/bin/env node
/**
 * DEVELOPMENT ONLY: Reset all wardrobe-related data
 *
 * This script deletes:
 * - All images from Supabase Storage (wardrobe-images bucket)
 * - All wardrobe items from the database
 * - All outfit items from the database
 * - All outfits from the database
 * - All daily curations from the database
 *
 * Usage:
 *   npx tsx scripts/reset-dev-data.ts
 *
 * SAFETY: Requires --force flag or interactive confirmation.
 * Never run this on production!
 */

import * as readline from "readline";
import prisma from "@/backend/database/prisma";
import { supabaseAdmin } from "@/backend/database/supabase";

const args = process.argv.slice(2);
const forceFlag = args.includes("--force");

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function deleteAllImages(): Promise<number> {
  if (!supabaseAdmin) {
    console.warn("⚠️  Supabase not configured. Skipping image deletion.");
    return 0;
  }

  try {
    console.log("📸 Deleting all images from Supabase Storage...");
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from("wardrobe-images")
      .list("", { limit: 1000 });

    if (listError) {
      console.error("❌ Failed to list images:", listError.message);
      return 0;
    }

    if (!files || files.length === 0) {
      console.log("✓ No images to delete");
      return 0;
    }

    // Recursively delete all files and folders
    const filesToDelete = files.map((f) => f.name);
    if (filesToDelete.length > 0) {
      const { error: deleteError } = await supabaseAdmin.storage
        .from("wardrobe-images")
        .remove(filesToDelete);

      if (deleteError) {
        console.error(
          "⚠️  Some images could not be deleted:",
          deleteError.message,
        );
      } else {
        console.log(`✓ Deleted ${filesToDelete.length} image(s)`);
      }
    }

    return filesToDelete.length;
  } catch (err) {
    console.error("❌ Error during image deletion:", err);
    return 0;
  }
}

async function deleteAllDatabaseRecords(): Promise<void> {
  try {
    console.log("🗑️  Deleting database records...");

    // Delete in cascade order (respect foreign key constraints)
    // The schema has onDelete: Cascade, but we'll be explicit:

    // 1. Delete all DailyCurations (no dependencies)
    const curationCount = await prisma.dailyCuration.deleteMany({});
    console.log(`✓ Deleted ${curationCount.count} daily curation(s)`);

    // 2. Delete all OutfitItems (depends on Outfit + WardrobeItem)
    const outfitItemCount = await prisma.outfitItem.deleteMany({});
    console.log(`✓ Deleted ${outfitItemCount.count} outfit item(s)`);

    // 3. Delete all Outfits (depends on User)
    const outfitCount = await prisma.outfit.deleteMany({});
    console.log(`✓ Deleted ${outfitCount.count} outfit(s)`);

    // 4. Delete all WardrobeItems (depends on User)
    const wardrobeCount = await prisma.wardrobeItem.deleteMany({});
    console.log(`✓ Deleted ${wardrobeCount.count} wardrobe item(s)`);

    // 5. Reset wardrobeItemCount on all users
    const userUpdate = await prisma.user.updateMany({
      data: { wardrobeItemCount: 0 },
    });
    console.log(`✓ Reset wardrobeItemCount for ${userUpdate.count} user(s)`);
  } catch (err) {
    console.error("❌ Error during database deletion:", err);
    throw err;
  }
}

async function main(): Promise<void> {
  console.log("🚨 DEVELOPMENT DATA RESET SCRIPT");
  console.log("════════════════════════════════════════════════════════════");
  console.log("");

  // Check if running in development
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ENVIRONMENT === "production"
  ) {
    console.error("❌ This script cannot run in production!");
    process.exit(1);
  }

  console.log("ℹ️  This will permanently delete:");
  console.log("   - All images from Supabase Storage (wardrobe-images)");
  console.log("   - All WardrobeItems");
  console.log("   - All OutfitItems");
  console.log("   - All Outfits");
  console.log("   - All DailyCurations");
  console.log("");

  let confirmed = forceFlag;

  if (!confirmed) {
    confirmed = await askConfirmation(
      "Are you sure? This cannot be undone. Type 'yes' to confirm: ",
    );
  }

  if (!confirmed) {
    console.log("✓ Cancelled. No data was deleted.");
    process.exit(0);
  }

  if (forceFlag) {
    console.log(
      "🔓 Force flag detected. Proceeding without further prompts...",
    );
  }

  console.log("");
  console.log("Starting deletion...");
  console.log("────────────────────────────────────────────────────────────");

  try {
    const imageCount = await deleteAllImages();
    await deleteAllDatabaseRecords();

    console.log("");
    console.log("════════════════════════════════════════════════════════════");
    console.log("✅ Reset complete!");
    console.log("");
    console.log(`Summary:`);
    console.log(`  - Deleted ${imageCount} image(s) from Storage`);
    console.log(`  - Deleted all wardrobe items, outfits, and curations`);
    console.log(`  - Reset user wardrobe item counts`);
  } catch (err) {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
