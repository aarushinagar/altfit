/**
 * POST /api/auth/forgot-password
 *
 * Initiates a password reset for an email address.
 * Always returns 200 (even if the email is not found) to prevent user enumeration.
 *
 * Body: { email: string }
 */

import { NextRequest } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import prisma, { withDbRetry } from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import {
  successResponse,
  errorResponse,
  isValidEmail,
} from "@/backend/database/api-response";

const resend = new Resend(process.env.RESEND_API_KEY);

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email: string = (body?.email ?? "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return errorResponse("Invalid email address.", 400);
    }

    // Look up the user — but don't reveal whether they exist
    const user = await withDbRetry(() =>
      prisma.user.findUnique({ where: { email } }),
    );

    if (user && !user.passwordHash) {
      // Google OAuth account — can't reset a password that doesn't exist
      // Still return 200 to avoid enumeration; we just won't send an email
      return successResponse(null, "If that email exists, a reset link has been sent.", 200);
    }

    if (user) {
      // Delete any existing unused tokens for this user
      await withDbRetry(() =>
        prisma.$executeRawUnsafe(
          `DELETE FROM "PasswordResetToken" WHERE "userId" = $1 AND "usedAt" IS NULL`,
          user.id,
        ),
      );

      const rawToken = crypto.randomBytes(32).toString("hex"); // 64 hex chars
      const tokenHash = sha256(rawToken);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
      const id = generatePrismaId("PasswordResetToken");

      await withDbRetry(() =>
        prisma.$executeRawUnsafe(
          `INSERT INTO "PasswordResetToken" (id, "userId", "tokenHash", "expiresAt") VALUES ($1, $2, $3, $4)`,
          id,
          user.id,
          tokenHash,
          expiresAt,
        ),
      );

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://altfit-6fma.onrender.com";
      const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

      if (!process.env.RESEND_API_KEY) {
        // Dev mode — log the link to the console instead
        console.log(`[ForgotPassword] DEV reset link for ${email}: ${resetLink}`);
      } else {
        await resend.emails.send({
          from: "ALT FIT <contact@altfit.co.in>",
          to: email,
          subject: "Reset your ALT FIT password",
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F7F3EC;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EC;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#EFE9DE;border:1px solid #E2D9CC;max-width:520px;width:100%;">
          <tr>
            <td style="padding:40px 44px 32px;">
              <p style="font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#A0622C;margin:0 0 24px;">ALT FIT</p>
              <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;font-weight:300;color:#2E2118;margin:0 0 16px;line-height:1.25;">Reset your password.</h1>
              <p style="font-size:13px;color:#8C7C6C;line-height:1.6;margin:0 0 32px;">Click the button below to set a new password. This link expires in 1 hour.</p>
              <a href="${resetLink}" style="display:inline-block;background:#2E2118;color:#F7F3EC;text-decoration:none;padding:14px 28px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-family:'DM Sans',Arial,sans-serif;">Reset Password</a>
              <p style="font-size:11px;color:#A89880;margin:28px 0 0;line-height:1.6;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 44px;border-top:1px solid #E2D9CC;">
              <p style="font-size:10px;color:#A89880;margin:0;letter-spacing:0.04em;">© ALT FIT · Style, elevated by AI</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        });
      }
    }

    // Always 200 — never reveal whether the account exists
    return successResponse(null, "If that email exists, a reset link has been sent.", 200);
  } catch (err) {
    console.error("[ForgotPassword] Error:", err);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}
