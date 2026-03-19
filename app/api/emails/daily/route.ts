/**
 * POST /api/emails/daily
 *
 * Cron-triggered email marketing agent.
 * Secured with a shared CRON_SECRET header to prevent unauthorized calls.
 *
 * Logic:
 *   1. Fetch all opted-in users with a wardrobe (≥2 items)
 *   2. For each user, decide which email type to send:
 *      - milestone:        if they just hit a streak milestone (have streak & newMilestone pending)
 *      - re_engagement:    if they haven't visited in 3+ days
 *      - daily_engagement: if they haven't received a daily email today
 *   3. Generate personalised copy via Claude
 *   4. Render HTML template
 *   5. Send via Resend + log to EmailLog
 *
 * Rate: Called once daily (e.g., 7:30 AM IST) from Render cron or external scheduler.
 * Safe to call multiple times — deduplication via EmailLog unique constraint.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import prisma from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import {
  personalizeDailyEmail,
  personalizeReEngagementEmail,
  personalizeMilestoneEmail,
} from "@/lib/email/personalizer";
import {
  dailyEngagementEmail,
  reEngagementEmail,
  milestoneEmail,
  injectUnsubscribeToken,
} from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://altfit-6fma.onrender.com";

// Re-engagement threshold: email users who haven't visited in this many days or more
const RE_ENGAGEMENT_DAYS = 3;

// ── Auth guard ────────────────────────────────────────────────────────────────
function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never allow if secret not configured
  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  // Constant-time comparison to prevent timing attacks
  if (provided.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateUnsubToken(user: { id: bigint; unsubToken?: string | null }): string {
  return user.unsubToken ?? crypto.randomBytes(24).toString("hex");
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

function getDayOfWeek(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
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
  const dayOfWeek = getDayOfWeek();
  const results: Array<{ userId: string; email: string; type: string; status: string }> = [];

  // Fetch all eligible users in one query:
  // - opted in (emailOptOut = false)
  // - have at least 2 wardrobe items
  // - include streak, style profile, and a sample wardrobe item for teasing
  const users = await prisma.user.findMany({
    where: {
      emailOptOut: false,
      wardrobeItemCount: { gte: 2 },
    },
    select: {
      id:            true,
      email:         true,
      name:          true,
      unsubToken:    true,
      emailOptOut:   true,
      wardrobeItemCount: true,
      styleProfiles: true,
      wardrobeItems: {
        where:  { isActive: true },
        take:   1,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, category: true, imageUrl: true },
      },
      styleProfile: {
        select: { favoriteColors: true, styleInsights: true },
      },
    },
  });

  for (const user of users) {
    const userEmail = user.email;
    const firstName = (user.name ?? userEmail.split("@")[0]).split(" ")[0];
    const userIdStr = user.id.toString();

    try {
      // ── Decide email type ─────────────────────────────────────────────────

      // Get streak info
      const streakRow = await prisma.userStreak.findUnique({ where: { userId: user.id } });
      const currentStreak = streakRow?.currentStreak ?? 0;
      const lastActiveDate = streakRow?.lastActiveDate ? new Date(streakRow.lastActiveDate) : null;
      const daysSinceLastVisit = lastActiveDate ? daysBetween(lastActiveDate, new Date()) : 999;

      // Determine type
      const seenMilestones: number[] = (streakRow?.seenMilestones as number[]) ?? [];
      const MILESTONES = [3, 7, 14, 30, 60, 100];
      const pendingMilestone = MILESTONES.find(
        (m) => currentStreak === m && !seenMilestones.includes(m)
      ) ?? null;

      let emailType: "milestone" | "re_engagement" | "daily_engagement";
      if (pendingMilestone) {
        emailType = "milestone";
      } else if (daysSinceLastVisit >= RE_ENGAGEMENT_DAYS) {
        emailType = "re_engagement";
      } else {
        emailType = "daily_engagement";
      }

      // Check if already sent THIS type today (allows evening send to proceed independently)
      const alreadySentToday = await prisma.emailLog.findFirst({
        where: { userId: user.id, emailType, localDate: today },
      });
      if (alreadySentToday) continue;

      // ── Build context for personalizer ───────────────────────────────────
      const previewItem = user.wardrobeItems[0];
      const userCtx = {
        firstName,
        styleProfiles:        user.styleProfiles ?? [],
        favoriteColors:       user.styleProfile?.favoriteColors ?? [],
        wardrobeCount:        user.wardrobeItemCount,
        streak:               currentStreak,
        dayOfWeek,
        previewItemName:      previewItem?.name,
        previewItemCategory:  previewItem?.category ?? undefined,
        daysSinceLastVisit,
      };

      // ── Generate personalised copy via Claude ─────────────────────────────
      let copy;
      if (emailType === "milestone") {
        copy = await personalizeMilestoneEmail(userCtx);
      } else if (emailType === "re_engagement") {
        copy = await personalizeReEngagementEmail(userCtx);
      } else {
        copy = await personalizeDailyEmail(userCtx);
      }

      // ── Ensure user has an unsubscribe token ──────────────────────────────
      let unsubToken = user.unsubToken;
      if (!unsubToken) {
        unsubToken = getOrCreateUnsubToken(user);
        await prisma.user.update({
          where: { id: user.id },
          data:  { unsubToken },
        });
      }

      // ── Render HTML ───────────────────────────────────────────────────────
      const ctaUrl = `${APP_URL}/today`;
      let html: string;

      if (emailType === "milestone") {
        html = milestoneEmail({
          firstName,
          milestone:  currentStreak,
          ctaUrl,
          headline:   copy.headline,
          bodyText:   copy.bodyText,
        });
      } else if (emailType === "re_engagement") {
        html = reEngagementEmail({
          firstName,
          daysSince:     daysSinceLastVisit,
          ctaUrl,
          headline:      copy.headline,
          bodyText:      copy.bodyText,
          wardrobeCount: user.wardrobeItemCount,
        });
      } else {
        html = dailyEngagementEmail({
          firstName,
          dayOfWeek,
          ctaUrl,
          headline:     copy.headline,
          subheadline:  copy.subheadline,
          bodyText:     copy.bodyText,
          streak:       currentStreak,
          previewItem:  previewItem
            ? { name: previewItem.name ?? "", category: previewItem.category ?? "", imageUrl: previewItem.imageUrl ?? undefined }
            : undefined,
        });
      }

      html = injectUnsubscribeToken(html, unsubToken);

      // ── Send via Resend ───────────────────────────────────────────────────
      const sendResult = await resend.emails.send({
        from:    "ALT FIT <contact@altfit.co.in>",
        to:      userEmail,
        subject: copy.subject,
        html,
      });

      // ── Log the send ──────────────────────────────────────────────────────
      const logId = generatePrismaId("EmailLog");
      await prisma.emailLog.create({
        data: {
          id:        typeof logId === "string" ? BigInt(logId) : logId,
          userId:    user.id,
          emailType,
          subject:   copy.subject,
          sentAt:    new Date(),
          resendId:  sendResult.data?.id ?? null,
          localDate: today,
        },
      });

      results.push({ userId: userIdStr, email: userEmail, type: emailType, status: "sent" });
    } catch (err) {
      console.error(`[EmailAgent] Failed for user ${userIdStr}:`, err);
      results.push({ userId: userIdStr, email: userEmail, type: "unknown", status: "failed" });
    }
  }

  const sent    = results.filter((r) => r.status === "sent").length;
  const failed  = results.filter((r) => r.status === "failed").length;
  console.log(`[EmailAgent] Daily run complete: ${sent} sent, ${failed} failed out of ${users.length} users`);

  return NextResponse.json({ sent, failed, total: users.length, results });
}
