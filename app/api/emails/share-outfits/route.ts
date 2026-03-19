/**
 * POST /api/emails/share-outfits
 *
 * Share your outfits email cron — fires at 10:00 AM IST next day (4:30 PM UTC yesterday).
 * Encourages users to share their saved outfits on Instagram and with friends.
 * Secured the same way as /api/emails/daily (CRON_SECRET Bearer token).
 *
 * Deduplication: one "share_outfits" per user per week.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import prisma from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import { personalizeShareOutfitsEmail } from "@/lib/email/personalizer";
import { shareOutfitsEmail, injectUnsubscribeToken } from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://altfit-6fma.onrender.com";

const EMAIL_TYPE = "share_outfits" as const;

// ── Auth guard ────────────────────────────────────────────────────────────────
function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (provided.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

function getLocalDateStr(): string {
  return new Date().toLocaleDateString("sv-SE"); // "YYYY-MM-DD"
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getLocalDateStr();
  const results: Array<{ userId: string; email: string; status: string }> = [];

  // Fetch opted-in users with saved outfits (and at least 2 wardrobe items)
  const usersWithSavedOutfits = await prisma.user.findMany({
    where: {
      emailOptOut:    false,
      wardrobeItemCount: { gte: 2 },
      savedOutfits:   { some: {} },
    },
    select: {
      id:                true,
      email:             true,
      name:              true,
      unsubToken:        true,
      wardrobeItemCount: true,
      styleProfiles:     true,
      styleProfile: {
        select: { favoriteColors: true },
      },
      _count: {
        select: { savedOutfits: true },
      },
    },
  });

  // Check for recent "share_outfits" sends to avoid sending too often
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const recentShares = await prisma.emailLog.findMany({
    where: {
      emailType: EMAIL_TYPE,
      sentAt: { gte: weekAgo },
    },
    select: { userId: true },
  });
  const recentUserIds = new Set(recentShares.map((r) => r.userId.toString()));

  for (const user of usersWithSavedOutfits) {
    const userIdStr = user.id.toString();
    const userEmail = user.email;
    const firstName = (user.name ?? userEmail.split("@")[0]).split(" ")[0];

    // Skip if already sent in the past week
    if (recentUserIds.has(userIdStr)) continue;

    try {
      // Build share context
      const shareCtx = {
        firstName,
        styleProfiles:       user.styleProfiles ?? [],
        favoriteColors:      user.styleProfile?.favoriteColors ?? [],
        wardrobeCount:       user.wardrobeItemCount,
        streak:              0,
        dayOfWeek:           "today",
        daysSinceLastVisit:  0,
        savedOutfitCount:    user._count.savedOutfits,
      };

      // Generate personalized share copy via Claude
      const copy = await personalizeShareOutfitsEmail(shareCtx);

      // Ensure unsubscribe token exists
      let unsubToken = user.unsubToken;
      if (!unsubToken) {
        unsubToken = crypto.randomBytes(24).toString("hex");
        await prisma.user.update({ where: { id: user.id }, data: { unsubToken } });
      }

      // Render template
      const html = shareOutfitsEmail({
        firstName,
        ctaUrl:      `${APP_URL}`,
        headline:    copy.headline,
        bodyText:    copy.bodyText,
        savedCount:  user._count.savedOutfits,
      });

      const finalHtml = injectUnsubscribeToken(html, unsubToken);

      // Send via Resend
      const sendResult = await resend.emails.send({
        from:    "ALT FIT <contact@altfit.co.in>",
        to:      userEmail,
        subject: copy.subject,
        html:    finalHtml,
      });

      // Log
      const logId = generatePrismaId("EmailLog");
      await prisma.emailLog.create({
        data: {
          id:        typeof logId === "string" ? BigInt(logId) : logId,
          userId:    user.id,
          emailType: EMAIL_TYPE,
          subject:   copy.subject,
          sentAt:    new Date(),
          resendId:  sendResult.data?.id ?? null,
          localDate: today,
        },
      });

      results.push({ userId: userIdStr, email: userEmail, status: "sent" });
    } catch (err) {
      console.error(`[ShareOutfitsEmailAgent] Failed for user ${userIdStr}:`, err);
      results.push({ userId: userIdStr, email: userEmail, status: "failed" });
    }
  }

  const sent   = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(`[ShareOutfitsEmailAgent] Run complete: ${sent} sent, ${failed} failed out of ${usersWithSavedOutfits.length} users`);

  return NextResponse.json({ sent, failed, total: usersWithSavedOutfits.length, results });
}
