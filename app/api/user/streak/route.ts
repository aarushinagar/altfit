import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/backend/database/auth-middleware";
import prisma from "@/backend/database/prisma";

// MILESTONES that deserve a celebration
const MILESTONES = [3, 7, 14, 30, 60, 100];

/**
 * POST /api/user/streak
 * Called when the user loads TodayPage and their outfit is ready.
 * Increments or resets the streak based on when they last visited.
 * Returns { currentStreak, longestStreak, newMilestone }
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const userIdBig = BigInt(auth.userId);

  // Use the server's local date in ISO format (YYYY-MM-DD)
  const today = new Date().toLocaleDateString("sv-SE"); // e.g. "2024-06-15"
  const todayDate = new Date(today);

  try {
    const existing = await prisma.userStreak.findUnique({ where: { userId: userIdBig } });

    let currentStreak = existing?.currentStreak ?? 0;
    let longestStreak = existing?.longestStreak ?? 0;
    const seenMilestones: number[] = (existing?.seenMilestones as number[]) ?? [];

    const lastActiveDate = existing?.lastActiveDate
      ? new Date(existing.lastActiveDate).toLocaleDateString("sv-SE")
      : null;

    // Already counted today — return current state
    if (lastActiveDate === today) {
      return NextResponse.json({ currentStreak, longestStreak, newMilestone: null });
    }

    // Check if last active was yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString("sv-SE");

    if (lastActiveDate === yesterdayStr) {
      currentStreak += 1;
    } else {
      // Gap longer than 1 day — reset streak
      currentStreak = 1;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // Check for new milestone
    const newMilestone = MILESTONES.find(
      (m) => currentStreak === m && !seenMilestones.includes(m)
    ) ?? null;

    const updatedSeenMilestones = newMilestone
      ? [...seenMilestones, newMilestone]
      : seenMilestones;

    await prisma.userStreak.upsert({
      where: { userId: userIdBig },
      create: {
        userId: userIdBig,
        currentStreak,
        longestStreak,
        lastActiveDate: todayDate,
        seenMilestones: updatedSeenMilestones,
      },
      update: {
        currentStreak,
        longestStreak,
        lastActiveDate: todayDate,
        seenMilestones: updatedSeenMilestones,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ currentStreak, longestStreak, newMilestone });
  } catch (err) {
    console.error("[Streak] Error:", err);
    return NextResponse.json({ error: "Failed to update streak" }, { status: 500 });
  }
}

/**
 * GET /api/user/streak
 * Returns the current streak without modifying it.
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  const userIdBig = BigInt(auth.userId);

  try {
    const streak = await prisma.userStreak.findUnique({ where: { userId: userIdBig } });
    return NextResponse.json({
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
    });
  } catch {
    return NextResponse.json({ currentStreak: 0, longestStreak: 0 });
  }
}
