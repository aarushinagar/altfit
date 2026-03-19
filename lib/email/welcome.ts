/**
 * Welcome email sender.
 * Called non-blocking right after user creation in both register and Google OAuth.
 */

import crypto from "crypto";
import { Resend } from "resend";
import prisma from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import { personalizeWelcomeEmail } from "@/lib/email/personalizer";
import { welcomeEmail, injectUnsubscribeToken } from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://altfit-6fma.onrender.com";

export async function sendWelcomeEmail(
  email:    string,
  name:     string | null,
  provider: string
): Promise<void> {
  const firstName = (name ?? email.split("@")[0]).split(" ")[0];

  // Look up user to get/create unsubToken and check opt-out
  const user = await prisma.user.findUnique({
    where:  { email },
    select: { id: true, emailOptOut: true, unsubToken: true },
  });

  if (!user || user.emailOptOut) return;

  // Ensure unsubscribe token
  let unsubToken = user.unsubToken;
  if (!unsubToken) {
    unsubToken = crypto.randomBytes(24).toString("hex");
    await prisma.user.update({ where: { id: user.id }, data: { unsubToken } });
  }

  // Generate copy via Claude
  const copy = await personalizeWelcomeEmail({ firstName, provider });

  // Render HTML
  const html = injectUnsubscribeToken(
    welcomeEmail({
      firstName,
      ctaUrl:      `${APP_URL}/wardrobe`,
      headline:    copy.headline,
      bodyText:    copy.bodyText,
      step1:       copy.step1,
      step2:       copy.step2,
      step3:       copy.step3,
      closingLine: copy.closingLine,
    }),
    unsubToken
  );

  // Send
  const sendResult = await resend.emails.send({
    from:    "ALT FIT <contact@altfit.co.in>",
    to:      email,
    subject: copy.subject,
    html,
  });

  // Log (best-effort — don't throw if this fails)
  try {
    const logId = generatePrismaId("EmailLog");
    await prisma.emailLog.create({
      data: {
        id:        typeof logId === "string" ? BigInt(logId) : logId,
        userId:    user.id,
        emailType: "welcome",
        subject:   copy.subject,
        sentAt:    new Date(),
        resendId:  sendResult.data?.id ?? null,
        localDate: new Date().toLocaleDateString("sv-SE"),
      },
    });
  } catch {
    // Non-fatal — log was best-effort
  }

  console.log(`[WelcomeEmail] Sent to ${email} (Resend ID: ${sendResult.data?.id})`);
}
