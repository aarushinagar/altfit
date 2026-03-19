/**
 * POST /api/whatsapp/welcome
 * Send "Welcome" WhatsApp message to newly registered users
 *
 * Triggered by: Immediately after user registration via `/api/auth/register`
 * Auth: None required (triggered from same origin)
 *
 * Response: { success, messageId?, error? }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/backend/database/prisma";
import { generatePrismaId } from "@/backend/database/prisma-id";
import { personalizeWelcomeWhatsApp } from "@/lib/whatsapp/personalizer";
import { welcomeWhatsApp } from "@/lib/whatsapp/templates";
import { sendWhatsAppMessage } from "@/lib/whatsapp/sender";
import type { UserContext } from "@/backend/langgraph/shared/types";

interface SendWelcomeRequest {
  userId: string;
  phone: string;
  name: string;
  styleProfiles?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: SendWelcomeRequest = await request.json();
    const { userId, phone, name, styleProfiles } = body;

    // Validate required fields
    if (!userId || !phone || !name) {
      return NextResponse.json(
        { error: "Missing required fields: userId, phone, name" },
        { status: 400 },
      );
    }

    console.log(`[WhatsApp] welcome: Sending to ${phone} (user: ${userId})`);

    // Verify user exists in DB
    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, wardrobeItemCount: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    // Build user context for personalization
    const ctx: UserContext = {
      name,
      userId,
      styleProfiles: styleProfiles || [],
      wardrobeItemCount: user.wardrobeItemCount,
    };

    // Personalize message using Claude
    const copy = await personalizeWelcomeWhatsApp(ctx);

    // Render message
    const message = welcomeWhatsApp({
      firstName: name,
      headline: copy.headline,
      bodyText: copy.bodyText,
    });

    // Send WhatsApp message
    const sendResult = await sendWhatsAppMessage(phone, message);

    if (sendResult.success) {
      const today = new Date().toLocaleDateString("sv-SE");

      // Log successful send
      try {
        await prisma.whatsAppLog.create({
          data: {
            id: generatePrismaId("WhatsAppLog") as never,
            userId: BigInt(userId),
            messageType: "welcome",
            localDate: today,
            whatsappId: sendResult.messageId,
            status: "sent",
          },
        });
      } catch (logErr) {
        console.error(`[WhatsApp] Failed to log welcome message:`, logErr);
        // Don't fail if logging fails
      }

      console.log(`[WhatsApp] ✅ Welcome sent to ${phone}`);
      return NextResponse.json(
        {
          success: true,
          messageId: sendResult.messageId,
          phone,
        },
        { status: 200 },
      );
    } else {
      console.error(`[WhatsApp] ❌ Failed to send welcome to ${phone}: ${sendResult.error}`);
      return NextResponse.json(
        {
          success: false,
          error: sendResult.error,
          phone,
        },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error(
      "[WhatsApp] welcome route error:",
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
