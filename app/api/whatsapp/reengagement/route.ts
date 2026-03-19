/**
 * POST /api/whatsapp/reengagement
 * Send "Re-engagement" WhatsApp messages to inactive users
 *
 * Triggered by: Cron job (3:00 PM IST daily - identifies inactive users)
 * Auth: Bearer token (CRON_SECRET)
 *
 * Response: { sent, failed, total, results }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import { personalizeReengagementWhatsApp } from "@/lib/whatsapp/personalizer";
import { reengagementWhatsApp } from "@/lib/whatsapp/templates";
import { sendWhatsAppMessage } from "@/lib/whatsapp/sender";
import type { UserContext } from "@/backend/langgraph/shared/types";

interface WhatsAppResult {
  userId: string;
  phone: string;
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

export async function POST(request: NextRequest) {
  try {
    if (!(await isCronAuthorized(request))) {
      console.warn("[WhatsApp] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toLocaleDateString("sv-SE"); // "YYYY-MM-DD"

    // Consider inactive if not accessed in 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    console.log(
      `[WhatsApp] reengagement: Starting delivery for ${today} (inactive since ${sevenDaysAgo.toLocaleDateString()})`,
    );

    // Fetch users inactive for 7+ days
    const users = await prisma.user.findMany({
      where: {
        phone: { not: null },
        emailOptOut: false,
        lastSeenAt: { lt: sevenDaysAgo },
        wardrobeItemCount: { gte: 1 },
      },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        styleProfiles: true,
        wardrobeItemCount: true,
        lastSeenAt: true,
      },
    });

    console.log(
      `[WhatsApp] reengagement: Found ${users.length} inactive users`,
    );

    // Check deduplication: already sent today?
    const results: WhatsAppResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        // Check if already sent today
        const existing = await prisma.whatsAppLog.findUnique({
          where: {
            userId_messageType_localDate: {
              userId: user.id,
              messageType: "reengagement",
              localDate: today,
            },
          },
        });

        if (existing) {
          console.log(
            `[WhatsApp] Skipping ${user.phone} (already sent today)`,
          );
          continue;
        }

        // Calculate days since last seen
        const daysInactive = Math.floor(
          (Date.now() - (user.lastSeenAt?.getTime() || 0)) /
            (1000 * 60 * 60 * 24),
        );

        // Build user context for personalization
        const ctx: UserContext = {
          name: user.name || "there",
          userId: user.id.toString(),
          styleProfiles: user.styleProfiles || [],
          wardrobeItemCount: user.wardrobeItemCount,
        };

        // Personalize message using Claude
        const copy = await personalizeReengagementWhatsApp(ctx);

        // Render message
        const message = reengagementWhatsApp({
          firstName: user.name || "there",
          headline: copy.headline,
          bodyText: copy.bodyText,
          daysAgo: daysInactive,
        });

        // Send WhatsApp message
        const sendResult = await sendWhatsAppMessage(user.phone!, message);

        if (sendResult.success) {
          // Log successful send
          await prisma.whatsAppLog.create({
            data: {
              id: generatePrismaId("WhatsAppLog") as never,
              userId: user.id,
              messageType: "reengagement",
              localDate: today,
              whatsappId: sendResult.messageId,
              status: "sent",
            },
          });

          sent++;
          results.push({
            userId: user.id.toString(),
            phone: user.phone!,
            status: "sent",
          });
          console.log(`[WhatsApp] ✅ Sent to ${user.phone}`);
        } else {
          failed++;
          results.push({
            userId: user.id.toString(),
            phone: user.phone!,
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
      `[WhatsApp] reengagement: Complete. Sent: ${sent}, Failed: ${failed}`,
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
      "[WhatsApp] reengagement route error:",
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
