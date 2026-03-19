/**
 * POST /api/emails/evening
 *
 * Second daily email cron — fires at 8:30 PM IST (3:00 PM UTC).
 * Sends a creative evening email: style challenge, wardrobe insight, or tonight's thought.
 * Secured the same way as /api/emails/daily (CRON_SECRET Bearer token).
 *
 * Each email type is tracked separately — morning and evening sends don't block each other.
 * Deduplication: one "evening_engagement" per user per localDate.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import prisma from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import { personalizeEveningEmail } from "@/lib/email/personalizer";
import { eveningEngagementEmail, injectUnsubscribeToken } from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://altfit-6fma.onrender.com";

const EMAIL_TYPE = "evening_engagement" as const;

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

function getDayOfWeek(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getLocalDateStr();
  const dayOfWeek = getDayOfWeek();
  const results: Array<{ userId: string; email: string; status: string }> = [];

  // Fetch opted-in users with at least 2 wardrobe items
  const users = await prisma.user.findMany({
    where: {
      emailOptOut: false,
      wardrobeItemCount: { gte: 2 },
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
      wardrobeItems: {
        where:   { isActive: true },
        orderBy: { updatedAt: "asc" }, // least recently touched = most "unworn"
        take:    1,
        select:  { name: true, category: true },
      },
      // Count pieces styled this week from EmailLog sends
      _count: { select: { emailLogs: true } },
    },
  });

  // Count wardrobe items styled (viewed via curation) this week per user in one query
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const weeklyActivity = await prisma.emailLog.groupBy({
    by:      ["userId"],
    where:   { sentAt: { gte: weekAgo }, emailType: "daily_engagement" },
    _count:  { id: true },
  });
  const weeklyMap = new Map(weeklyActivity.map((r) => [r.userId.toString(), r._count.id]));

  for (const user of users) {
    const userEmail = user.email;
    const firstName = (user.name ?? userEmail.split("@")[0]).split(" ")[0];
    const userIdStr = user.id.toString();

    try {
      // Idempotency: skip if already sent this evening type today
      const alreadySent = await prisma.emailLog.findFirst({
        where: { userId: user.id, emailType: EMAIL_TYPE, localDate: today },
      });
      if (alreadySent) continue;

      // Get streak for badge
      const streakRow = await prisma.userStreak.findUnique({ where: { userId: user.id } });
      const currentStreak = streakRow?.currentStreak ?? 0;

      const piecesStyledThisWeek = weeklyMap.get(userIdStr) ?? 0;
      const unwornItem = user.wardrobeItems[0];

      // Build evening context
      const eveningCtx = {
        firstName,
        styleProfiles:        user.styleProfiles ?? [],
        favoriteColors:       user.styleProfile?.favoriteColors ?? [],
        wardrobeCount:        user.wardrobeItemCount,
        totalPieces:          user.wardrobeItemCount,
        streak:               currentStreak,
        dayOfWeek,
        daysSinceLastVisit:   0, // not used for evening
        unwovenItemName:      unwornItem?.name ?? undefined,
        piecesStyledThisWeek,
      };

      // Generate creative copy via Claude
      const copy = await personalizeEveningEmail(eveningCtx);

      // Ensure unsubscribe token exists
      let unsubToken = user.unsubToken;
      if (!unsubToken) {
        unsubToken = crypto.randomBytes(24).toString("hex");
        await prisma.user.update({ where: { id: user.id }, data: { unsubToken } });
      }

      // Render template
      const html = eveningEngagementEmail({
        firstName,
        ctaUrl:          `${APP_URL}/wardrobe`,
        headline:        copy.headline,
        bodyText:        copy.bodyText,
        challengeLabel:  copy.challengeLabel,
        challengeText:   copy.challengeText,
        tomorrowTeaser:  copy.tomorrowTeaser,
        wardrobeStat:    copy.wardrobeStat,
        streak:          currentStreak,
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
      console.error(`[EveningEmailAgent] Failed for user ${userIdStr}:`, err);
      results.push({ userId: userIdStr, email: userEmail, status: "failed" });
    }
  }

  const sent   = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(`[EveningEmailAgent] Run complete: ${sent} sent, ${failed} failed out of ${users.length} users`);

  return NextResponse.json({ sent, failed, total: users.length, results });
}
