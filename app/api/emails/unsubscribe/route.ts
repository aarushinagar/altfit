/**
 * GET /api/emails/unsubscribe?token=<unsubToken>
 *
 * One-click unsubscribe handler linked from every marketing email footer.
 * Sets emailOptOut=true on the matching user.
 * Returns a plain HTML confirmation page (no JS needed, works in all email clients).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/backend/database/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();

  if (!token) {
    return new NextResponse(unsubPage("Invalid link", "This unsubscribe link is missing a token. Contact us if you need help."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { unsubToken: token },
      select: { id: true, emailOptOut: true },
    });

    if (!user) {
      return new NextResponse(unsubPage("Already unsubscribed", "You're already off our list. You won't receive any more marketing emails from ALT FIT."), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!user.emailOptOut) {
      await prisma.user.update({
        where: { id: user.id },
        data:  { emailOptOut: true },
      });
    }

    return new NextResponse(unsubPage("You're unsubscribed", "You've been removed from ALT FIT marketing emails. You can re-enable them any time in your account settings."), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[Unsubscribe] Error:", err);
    return new NextResponse(unsubPage("Something went wrong", "We couldn't process your request. Please try again or contact us at contact@altfit.co.in."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function unsubPage(headline: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ALT FIT — ${headline}</title>
</head>
<body style="margin:0;padding:0;background:#F7F3EC;font-family:'DM Sans',Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:60px 16px;">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#EFE9DE;border:1px solid #E2D9CC;max-width:480px;width:100%;">
          <tr>
            <td style="padding:44px;">
              <p style="font-size:11px;letter-spacing:0.48em;text-transform:uppercase;color:#A0622C;margin:0 0 28px;">ALT FIT</p>
              <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:300;color:#2E2118;margin:0 0 16px;line-height:1.2;">${headline}</h1>
              <p style="font-size:13px;color:#8C7C6C;line-height:1.7;margin:0 0 32px;">${body}</p>
              <a href="https://altfit.co.in" style="display:inline-block;background:#2E2118;color:#F7F3EC;text-decoration:none;padding:13px 26px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;">
                Back to ALT FIT
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
