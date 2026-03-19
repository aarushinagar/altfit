/**
 * POST /api/emails/good-morning
 *
 * Good morning email cron — fires at 8:00 AM IST (2:30 AM UTC).
 * Sends a personalized morning outfit card with actual wardrobe pieces displayed.
 * Secured the same way as /api/emails/daily (CRON_SECRET Bearer token).
 *
 * Deduplication: one "good_morning" per user per localDate.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import prisma from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import { personalizeGoodMorningEmail } from "@/lib/email/personalizer";
import { goodMorningEmail, injectUnsubscribeToken } from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://altfit-6fma.onrender.com";

const EMAIL_TYPE = "good_morning" as const;

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
        take:    6,
        orderBy: { createdAt: "desc" },
        select:  { id: true, name: true, category: true, imageUrl: true },
      },
    },
  });

  for (const user of users) {
    const userEmail = user.email;
    const firstName = (user.name ?? userEmail.split("@")[0]).split(" ")[0];
    const userIdStr = user.id.toString();

    try {
      // Idempotency: skip if already sent this morning type today
      const alreadySent = await prisma.emailLog.findFirst({
        where: { userId: user.id, emailType: EMAIL_TYPE, localDate: today },
      });
      if (alreadySent) continue;

      // Build morning context
      const morningCtx = {
        firstName,
        styleProfiles:        user.styleProfiles ?? [],
        favoriteColors:       user.styleProfile?.favoriteColors ?? [],
        wardrobeCount:        user.wardrobeItemCount,
        streak:               0,
        dayOfWeek,
        daysSinceLastVisit:   0,
        previewItemName:      user.wardrobeItems[0]?.name,
        previewItemCategory:  user.wardrobeItems[0]?.category,
      };

      // Generate personalized morning copy via Claude
      const copy = await personalizeGoodMorningEmail(morningCtx);

      // Ensure unsubscribe token exists
      let unsubToken = user.unsubToken;
      if (!unsubToken) {
        unsubToken = crypto.randomBytes(24).toString("hex");
        await prisma.user.update({ where: { id: user.id }, data: { unsubToken } });
      }

      // Prepare outfit pieces for email
      const outfitPieces = user.wardrobeItems.map((item) => ({
        name:     item.name ?? "",
        category: item.category ?? "",
        imageUrl: item.imageUrl ?? undefined,
      }));

      // Render template with outfit pieces grid
      const html = goodMorningEmail({
        firstName,
        dayOfWeek,
        ctaUrl: `${APP_URL}/today`,
        headline:     copy.headline,
        bodyText:     copy.bodyText,
        outfitPieces: outfitPieces.length > 0 ? outfitPieces : undefined,
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
      console.error(`[GoodMorningEmailAgent] Failed for user ${userIdStr}:`, err);
      results.push({ userId: userIdStr, email: userEmail, status: "failed" });
    }
  }

  const sent   = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;
  console.log(`[GoodMorningEmailAgent] Run complete: ${sent} sent, ${failed} failed out of ${users.length} users`);

  return NextResponse.json({ sent, failed, total: users.length, results });
}
