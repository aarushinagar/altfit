/**
 * POST /api/auth/reset-password
 *
 * Consumes a password-reset token and sets a new password.
 *
 * Body: { token: string; password: string }
 */

import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma, { withDbRetry } from "@/backend/database/prisma";
import {
  successResponse,
  errorResponse,
  validateRequired,
} from "@/backend/database/api-response";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = validateRequired(body, ["token", "password"]);
    if (validation) return validation;

    const { token, password } = body as { token: string; password: string };

    // Validate password strength
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return errorResponse(
        "Password must be at least 8 characters and contain uppercase, lowercase, and a number.",
        400,
      );
    }

    const tokenHash = sha256(token);

    // Find the token record
    const rows = await withDbRetry(() =>
      prisma.$queryRawUnsafe<
        Array<{
          id: bigint;
          userId: bigint;
          expiresAt: Date;
          usedAt: Date | null;
        }>
      >(
        `SELECT id, "userId", "expiresAt", "usedAt" FROM "PasswordResetToken" WHERE "tokenHash" = $1 LIMIT 1`,
        tokenHash,
      ),
    );

    if (!rows || rows.length === 0) {
      return errorResponse("This reset link is invalid or has already been used.", 400);
    }

    const record = rows[0];

    if (record.usedAt) {
      return errorResponse("This reset link has already been used.", 400);
    }
    if (new Date() > record.expiresAt) {
      return errorResponse("This reset link has expired. Please request a new one.", 400);
    }

    // Hash the new password and update the user
    const passwordHash = await bcrypt.hash(password, 12);

    await withDbRetry(() =>
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
    );

    // Mark the token as used
    await withDbRetry(() =>
      prisma.$executeRawUnsafe(
        `UPDATE "PasswordResetToken" SET "usedAt" = now() WHERE id = $1`,
        record.id,
      ),
    );

    console.log(`[ResetPassword] Password reset for userId ${record.userId}`);

    return successResponse(null, "Password updated successfully.", 200);
  } catch (err) {
    console.error("[ResetPassword] Error:", err);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}
