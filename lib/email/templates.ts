/**
 * ALT FIT Email Templates
 *
 * All templates share the same editorial visual language as the app:
 * cream/paper backgrounds, Cormorant Garamond headings, DM Sans body,
 * gold (#A0622C) accent, ink (#2E2118) CTA.
 */

const COLORS = {
  cream:   "#F7F3EC",
  paper:   "#EFE9DE",
  linen:   "#E2D9CC",
  ink:     "#2E2118",
  charcoal:"#4A3828",
  taupe:   "#A89880",
  warmGray:"#8C7C6C",
  gold:    "#A0622C",
};

const FONTS = {
  serif: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  sans:  "'DM Sans', Arial, Helvetica, sans-serif",
};

function baseWrapper(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ALT FIT</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.cream};font-family:${FONTS.sans};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cream};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:${COLORS.paper};border:1px solid ${COLORS.linen};max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 44px 28px;border-bottom:1px solid ${COLORS.linen};">
              <p style="font-family:${FONTS.sans};font-size:11px;letter-spacing:0.52em;text-transform:uppercase;color:${COLORS.gold};margin:0;">ALT FIT</p>
            </td>
          </tr>

          <!-- Body -->
          ${innerHtml}

          <!-- Footer -->
          <tr>
            <td style="padding:20px 44px;border-top:1px solid ${COLORS.linen};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="font-family:${FONTS.sans};font-size:10px;color:${COLORS.taupe};margin:0;line-height:1.6;">
                      © ALT FIT · Style, elevated by AI<br />
                      You're receiving this because you created an ALT FIT account.<br />
                      <a href="{{UNSUBSCRIBE_URL}}" style="color:${COLORS.taupe};text-decoration:underline;">Unsubscribe</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface DailyEmailData {
  firstName:    string;
  dayOfWeek:    string;   // "Wednesday"
  ctaUrl:       string;
  headline:     string;   // AI-generated, e.g. "Your Wednesday look is ready."
  subheadline:  string;   // AI-generated, e.g. "Three outfits crafted from your wardrobe."
  bodyText:     string;   // AI-generated 2-3 sentences
  streak?:      number;
  previewItem?: { name: string; category: string; imageUrl?: string };
}

export function dailyEngagementEmail(data: DailyEmailData): string {
  const streakBadge = data.streak && data.streak >= 2
    ? `<tr>
        <td style="padding:0 44px 20px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="border:1px solid rgba(160,98,44,0.28);padding:6px 14px;background:rgba(160,98,44,0.05);">
                <p style="font-family:${FONTS.sans};font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.gold};margin:0;">
                  🔥 ${data.streak} day streak
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const previewBlock = data.previewItem
    ? `<tr>
        <td style="padding:0 44px 28px;">
          <table cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.linen};background:${COLORS.cream};width:100%;">
            <tr>
              <td style="padding:16px 20px;">
                <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 4px;">${data.previewItem.category}</p>
                <p style="font-family:${FONTS.serif};font-size:17px;font-weight:300;color:${COLORS.ink};margin:0;line-height:1.2;">${data.previewItem.name}</p>
                <p style="font-family:${FONTS.sans};font-size:11px;color:${COLORS.warmGray};margin:6px 0 0;">Featured in today's look ✦</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const inner = `
  <tr>
    <td style="padding:36px 44px 20px;">
      <h1 style="font-family:${FONTS.serif};font-size:34px;font-weight:300;color:${COLORS.ink};margin:0 0 10px;line-height:1.2;letter-spacing:-0.01em;">${data.headline}</h1>
      <p style="font-family:${FONTS.sans};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.warmGray};margin:0 0 24px;">${data.subheadline}</p>
      <p style="font-family:${FONTS.serif};font-size:16px;color:${COLORS.charcoal};line-height:1.7;margin:0 0 32px;font-weight:300;">${data.bodyText}</p>
      <a href="${data.ctaUrl}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.cream};text-decoration:none;padding:14px 28px;font-family:${FONTS.sans};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">
        See Today's Look
      </a>
    </td>
  </tr>
  ${streakBadge}
  ${previewBlock}`;

  return baseWrapper(inner).replace("{{UNSUBSCRIBE_URL}}", data.ctaUrl.replace(/\/today.*/, "/unsubscribe?token={{TOKEN}}"));
}

export interface ReEngagementEmailData {
  firstName:   string;
  daysSince:   number;
  ctaUrl:      string;
  headline:    string;   // AI-generated
  bodyText:    string;   // AI-generated
  wardrobeCount: number;
}

export function reEngagementEmail(data: ReEngagementEmailData): string {
  const inner = `
  <tr>
    <td style="padding:36px 44px 28px;">
      <p style="font-family:${FONTS.sans};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 16px;">We miss you</p>
      <h1 style="font-family:${FONTS.serif};font-size:34px;font-weight:300;color:${COLORS.ink};margin:0 0 10px;line-height:1.2;letter-spacing:-0.01em;">${data.headline}</h1>
      <p style="font-family:${FONTS.serif};font-size:16px;color:${COLORS.charcoal};line-height:1.7;margin:0 0 24px;font-weight:300;">${data.bodyText}</p>
      <table cellpadding="0" cellspacing="0" style="border-left:2px solid ${COLORS.gold};padding-left:16px;margin-bottom:32px;">
        <tr>
          <td>
            <p style="font-family:${FONTS.serif};font-size:14px;font-style:italic;color:${COLORS.charcoal};margin:0;line-height:1.6;">
              Your ${data.wardrobeCount} piece wardrobe has been waiting — 
              let's put it to work.
            </p>
          </td>
        </tr>
      </table>
      <a href="${data.ctaUrl}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.cream};text-decoration:none;padding:14px 28px;font-family:${FONTS.sans};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">
        Get Today's Outfit
      </a>
    </td>
  </tr>`;

  return baseWrapper(inner).replace("{{UNSUBSCRIBE_URL}}", `${data.ctaUrl.replace(/\/today.*/, "")}/unsubscribe?token={{TOKEN}}`);
}

export interface MilestoneEmailData {
  firstName:  string;
  milestone:  number;   // 7, 14, 30, etc.
  ctaUrl:     string;
  headline:   string;
  bodyText:   string;
}

export function milestoneEmail(data: MilestoneEmailData): string {
  const inner = `
  <tr>
    <td style="padding:36px 44px 28px;text-align:center;">
      <p style="font-size:40px;margin:0 0 20px;">🔥</p>
      <p style="font-family:${FONTS.sans};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${COLORS.gold};margin:0 0 12px;">${data.milestone} Day Streak</p>
      <h1 style="font-family:${FONTS.serif};font-size:34px;font-weight:300;color:${COLORS.ink};margin:0 0 12px;line-height:1.2;letter-spacing:-0.01em;">${data.headline}</h1>
      <p style="font-family:${FONTS.serif};font-size:16px;color:${COLORS.charcoal};line-height:1.7;margin:0 0 32px;font-weight:300;">${data.bodyText}</p>
      <a href="${data.ctaUrl}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.cream};text-decoration:none;padding:14px 28px;font-family:${FONTS.sans};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">
        Keep The Streak Alive
      </a>
    </td>
  </tr>`;

  return baseWrapper(inner).replace("{{UNSUBSCRIBE_URL}}", `${data.ctaUrl.replace(/\/today.*/, "")}/unsubscribe?token={{TOKEN}}`);
}

/** Replace the {{TOKEN}} placeholder with an actual unsubscribe token. */
export function injectUnsubscribeToken(html: string, token: string): string {
  return html.replace(/{{TOKEN}}/g, encodeURIComponent(token));
}
