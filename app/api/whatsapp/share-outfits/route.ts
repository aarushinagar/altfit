/**
 * POST /api/whatsapp/share-outfits
 * Send "Share Your Outfits" WhatsApp messages to users
 *
 * Triggered by: Cron job (Weekly, Wednesday 10:00 AM IST)
 * Auth: Bearer token (CRON_SECRET)
 *
 * Response: { sent, failed, total, results }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import { personalizeShareOutfitsWhatsApp } from "@/lib/whatsapp/personalizer";
import { shareOutfitsWhatsApp } from "@/lib/whatsapp/templates";
import { sendWhatsAppMessage } from "@/lib/whatsapp/sender";
import type { UserContext } from "@/lib/whatsapp/personalizer";

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

    console.log(`[WhatsApp] share-outfits: Starting delivery for ${today}`);

    // Fetch users eligible for share-outfits WhatsApp
    // Only users with saved outfits to encourage sharing
    const users = await prisma.user.findMany({
      where: {
        phone: { not: null },
        emailOptOut: false,
        savedOutfits: { some: {} }, // Has at least one saved outfit
      },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        styleProfiles: true,
        savedOutfits: { select: { id: true } }, // Count saved outfits
      },
    });

    console.log(
      `[WhatsApp] share-outfits: Found ${users.length} eligible users`,
    );

    // Check deduplication: already sent this week?
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
              messageType: "share_outfits",
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

        // Build user context for personalization
        const ctx: UserContext & { savedOutfitCount: number } = {
          name: user.name || "there",
          userId: user.id.toString(),
          styleProfiles: user.styleProfiles || [],
          wardrobeItemCount: 0, // Not needed for share message
          savedOutfitCount: user.savedOutfits.length,
        };

        // Personalize message using Claude
        const copy = await personalizeShareOutfitsWhatsApp(ctx);

        // Render message
        const message = shareOutfitsWhatsApp({
          firstName: user.name || "there",
          headline: copy.headline,
          bodyText: copy.bodyText,
          savedCount: user.savedOutfits.length,
        });

        // Send WhatsApp message
        const sendResult = await sendWhatsAppMessage(user.phone!, message);

        if (sendResult.success) {
          // Log successful send
          await prisma.whatsAppLog.create({
            data: {
              id: generatePrismaId("WhatsAppLog") as never,
              userId: user.id,
              messageType: "share_outfits",
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
      `[WhatsApp] share-outfits: Complete. Sent: ${sent}, Failed: ${failed}`,
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
      "[WhatsApp] share-outfits route error:",
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
