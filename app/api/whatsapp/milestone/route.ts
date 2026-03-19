/**
 * POST /api/whatsapp/milestone
 * Send "Milestone" WhatsApp messages to users hitting streaks (7, 14, 30 days)
 *
 * Triggered by: Cron job (7:00 PM IST daily - checks for milestone dates)
 * Auth: Bearer token (CRON_SECRET)
 *
 * Response: { sent, failed, total, results }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import { personalizeMilestoneWhatsApp } from "@/lib/whatsapp/personalizer";
import { milestoneWhatsApp } from "@/lib/whatsapp/templates";
import { sendWhatsAppMessage } from "@/lib/whatsapp/sender";
import type { UserContext } from "@/backend/langgraph/shared/types";

interface WhatsAppResult {
  userId: string;
  phone: string;
  milestone: number;
  status: "sent" | "failed";
  error?: string;
}

async function isCronAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  const expected = process.env.CRON_SECRET || "";
  if (!expected) {
    console.error("[WhatsApp Auth] CRON_SECRET not configured");
    return false;
  }

  // Timing-safe comparison
  if (token.length !== expected.length) return false;
  let match = true;
  for (let i = 0; i < token.length; i++) {
    if (token[i] !== expected[i]) match = false;
  }
  return match;
}

function getStreakDays(joinedAt: Date | null): number {
  if (!joinedAt) return 0;
  return Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
}

function isMilestoneAchieved(streakDays: number): number | null {
  // Check for 7, 14, 30 day milestones
  if (streakDays % 7 !== 0) return null; // Not a 7-day boundary
  if (streakDays === 7 || streakDays === 14 || streakDays === 30) {
    return streakDays;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isCronAuthorized(request))) {
      console.warn("[WhatsApp] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toLocaleDateString("sv-SE"); // "YYYY-MM-DD"

    console.log(`[WhatsApp] milestone: Starting delivery for ${today}`);

    // Fetch all users with phone
    const users = await prisma.user.findMany({
      where: {
        phone: { not: null },
        emailOptOut: false,
        createdAt: { not: null },
      },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        createdAt: true,
        styleProfiles: true,
        wardrobeItemCount: true,
      },
    });

    console.log(`[WhatsApp] milestone: Checking ${users.length} users`);

    // Check deduplication: already sent today?
    const results: WhatsAppResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const streakDays = getStreakDays(user.createdAt);
        const milestone = isMilestoneAchieved(streakDays);

        if (!milestone) {
          continue; // No milestone today
        }

        // Check if already sent today for this milestone
        const existing = await prisma.whatsAppLog.findUnique({
          where: {
            userId_messageType_localDate: {
              userId: user.id,
              messageType: `milestone_${milestone}`,
              localDate: today,
            },
          },
        });

        if (existing) {
          console.log(
            `[WhatsApp] Skipping ${user.phone} (already sent ${milestone}-day milestone today)`,
          );
          continue;
        }

        // Build user context for personalization
        const ctx: UserContext = {
          name: user.name || "there",
          userId: user.id.toString(),
          styleProfiles: user.styleProfiles || [],
          wardrobeItemCount: user.wardrobeItemCount,
        };

        // Personalize message using Claude
        const copy = await personalizeMilestoneWhatsApp(ctx);

        // Render message
        const message = milestoneWhatsApp({
          firstName: user.name || "there",
          headline: copy.headline,
          bodyText: copy.bodyText,
          milestone,
        });

        // Send WhatsApp message
        const sendResult = await sendWhatsAppMessage(user.phone!, message);

        if (sendResult.success) {
          // Log successful send
          await prisma.whatsAppLog.create({
            data: {
              id: generatePrismaId("WhatsAppLog") as never,
              userId: user.id,
              messageType: `milestone_${milestone}`,
              localDate: today,
              whatsappId: sendResult.messageId,
              status: "sent",
            },
          });

          sent++;
          results.push({
            userId: user.id.toString(),
            phone: user.phone!,
            milestone,
            status: "sent",
          });
          console.log(`[WhatsApp] ✅ Sent ${milestone}-day milestone to ${user.phone}`);
        } else {
          failed++;
          results.push({
            userId: user.id.toString(),
            phone: user.phone!,
            milestone,
            status: "failed",
            error: sendResult.error,
          });
          console.error(
            `[WhatsApp] ❌ Failed to ${user.phone}: ${sendResult.error}`,
          );
        }
      } catch (err) {
        failed++;
        results.push({
          userId: user.id.toString(),
          phone: user.phone || "unknown",
          milestone: 0,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
        console.error(
          `[WhatsApp] Error processing user ${user.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log(
      `[WhatsApp] milestone: Complete. Sent: ${sent}, Failed: ${failed}`,
    );

    return NextResponse.json(
      {
        sent,
        failed,
        total: users.length,
        results,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[WhatsApp] milestone route error:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
