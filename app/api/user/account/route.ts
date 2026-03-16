import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/backend/database/prisma";
import { requireAuth } from "@/backend/database/auth-middleware";
import {
  successResponse,
  errorResponse,
} from "@/backend/database/api-response";
import { deleteImage } from "@/backend/database/supabase";

/**
 * DELETE /api/user/account
 * Permanently delete the authenticated user's account and all associated data.
 * Requires password confirmation for email users.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, provider: true, passwordHash: true },
    });

    if (!user) {
      return errorResponse("User not found", 404);
    }

    if (user.provider === "email") {
      const body = await request.json().catch(() => ({}));
      const { password } = body as { password?: string };
      if (!password) {
        return errorResponse("Password confirmation required", 400);
      }
      const valid = await bcrypt.compare(password, user.passwordHash || "");
      if (!valid) {
        return errorResponse("Incorrect password", 403);
      }
    }

    // Clean up Supabase storage — best effort, don't block deletion on storage errors
    try {
      const items = await prisma.wardrobeItem.findMany({
        where: { userId: BigInt(userId) },
        select: { storagePath: true },
      });
      await Promise.allSettled(items.map((i) => deleteImage(i.storagePath)));
    } catch (storageErr) {
      console.warn("[user/account DELETE] Storage cleanup failed:", storageErr);
    }

    // Cascade delete handles sessions, wardrobeItems, outfits, subscription
    await prisma.user.delete({ where: { id: BigInt(userId) } });

    console.log(`[user/account DELETE] User ${userId} deleted`);
    return successResponse({ deleted: true }, "Account deleted");
  } catch (error) {
    console.error("[user/account DELETE] Error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Account deletion failed",
      500,
    );
  }
}
