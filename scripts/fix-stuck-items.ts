/**
 * One-shot fix: mark all pending WardrobeItems as done and clear stuck AnalysisQueue jobs.
 * Run with: npx tsx scripts/fix-stuck-items.ts
 */

import prisma from "@/backend/database/prisma";

async function main() {
  // 1. Mark all stuck wardrobe items as done
  const itemResult = await prisma.wardrobeItem.updateMany({
    where: { analysisStatus: "pending" },
    data: { analysisStatus: "done" },
  });
  console.log(`✅ Marked ${itemResult.count} wardrobe items as done`);

  // 2. Mark all stuck queue jobs as failed so they don't block future runs
  const queueResult = await prisma.analysisQueue.updateMany({
    where: {
      OR: [{ status: "pending" }, { status: "processing" }],
    },
    data: { status: "failed" },
  });
  console.log(`✅ Cleared ${queueResult.count} stuck queue jobs`);
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
