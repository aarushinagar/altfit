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

/**
 * Sanitise an image URL before embedding in email.
 * Returns null if the URL is missing or not a valid HTTPS URL
 * (email clients block HTTP images and blob/data URLs silently).
 */
function safeImageUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  return null; // http, blob, data, relative — all unsafe for email
}

function baseWrapper(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ALT FIT</title>
  <style>
    @media only screen and (max-width: 480px) {
      .wrapper { width: 100% !important; }
      .content { padding: 24px 20px !important; }
      .outfit-item {
        width: 31% !important;
        display: inline-block !important;
        vertical-align: top;
      }
      .outfit-item img { width: 100% !important; height: auto !important; }
      .cta-button { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
      .headline { font-size: 24px !important; line-height: 1.2 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.cream};font-family:${FONTS.sans};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cream};padding:40px 16px;">
    <tr>
      <td align="center">
        <table class="wrapper" width="560" cellpadding="0" cellspacing="0" style="background:${COLORS.paper};border:1px solid ${COLORS.linen};max-width:560px;width:100%;">

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

/** Pro upsell block — placed just above the main CTA */
function proUpsellBlock(ctaUrl: string): string {
  return `
  <tr>
    <td style="padding:0 44px 28px;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background:${COLORS.ink};border-radius:2px;">
        <tr>
          <td style="padding:24px 28px;">
            <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${COLORS.gold};margin:0 0 8px;">ALT FIT PRO</p>
            <p style="font-family:${FONTS.serif};font-size:18px;font-weight:300;color:${COLORS.cream};margin:0 0 16px;line-height:1.4;">Unlimited AI outfit curation, every single day.</p>
            <a href="${ctaUrl}" class="cta-button" style="display:inline-block;background:${COLORS.gold};color:${COLORS.cream};text-decoration:none;padding:14px 28px;font-family:${FONTS.sans};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:600;">UPGRADE TO PRO →</a>
            <p style="font-family:${FONTS.sans};font-size:10px;color:${COLORS.taupe};margin:10px 0 0;letter-spacing:0.04em;">Cancel anytime. No questions asked.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export interface OutfitPiece {
  name:      string;
  category:  string;
  imageUrl?: string;
}

export interface DailyEmailData {
  firstName:    string;
  dayOfWeek:    string;
  ctaUrl:       string;
  headline:     string;
  subheadline:  string;
  bodyText:     string;
  streak?:      number;
  outfitPieces?: OutfitPiece[];   // up to 4 actual wardrobe items with photos
  showProUpsell?: boolean;        // show upgrade block when user is on free tier
}

/** Render a single wardrobe card cell for the piece strip */
function pieceCard(piece: OutfitPiece): string {
  const imgUrl = safeImageUrl(piece.imageUrl);
  const photo = imgUrl
    ? `<img src="${imgUrl}" alt="${piece.name}" width="114" height="148" style="display:block;width:114px;height:148px;object-fit:cover;border:0;" />`
    : `<div style="width:114px;height:148px;background:${COLORS.linen};display:flex;align-items:center;justify-content:center;">
        <span style="font-size:22px;opacity:0.25;">✦</span>
       </div>`;
  return `
    <td style="width:114px;padding-right:8px;vertical-align:top;">
      <table cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.linen};overflow:hidden;background:${COLORS.cream};">
        <tr><td style="padding:0;">${photo}</td></tr>
        <tr>
          <td style="padding:8px 10px 10px;">
            <p style="font-family:${FONTS.sans};font-size:8px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 3px;">${piece.category}</p>
            <p style="font-family:${FONTS.serif};font-size:13px;font-weight:300;color:${COLORS.ink};margin:0;line-height:1.3;">${piece.name}</p>
          </td>
        </tr>
      </table>
    </td>`;
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

  // Wardrobe photo strip — full-bleed swipe-card preview
  const pieces = (data.outfitPieces ?? []).slice(0, 4);
  const pieceStrip = pieces.length > 0
    ? `<tr>
        <td style="padding:0 44px 8px;">
          <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 14px;">Today's pieces — from your wardrobe</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 44px 0;overflow:hidden;">
          <table cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;">
            <tr>
              ${pieces.map(pieceCard).join("\n")}
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  // Swipe feature callout
  const swipeCallout = pieces.length > 0
    ? `<tr>
        <td style="padding:20px 44px 0;">
          <table cellpadding="0" cellspacing="0" width="100%" style="background:${COLORS.ink};">
            <tr>
              <td style="padding:16px 22px;">
                <table cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="vertical-align:middle;width:36px;">
                      <div style="font-size:20px;line-height:1;">👆</div>
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;">
                      <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.gold};margin:0 0 4px;">Swipe to style</p>
                      <p style="font-family:${FONTS.serif};font-size:14px;font-weight:300;color:${COLORS.cream};margin:0;line-height:1.4;">Open the app and swipe through full outfits built from these exact pieces.</p>
                    </td>
                    <td style="vertical-align:middle;padding-left:16px;white-space:nowrap;">
                      <a href="${data.ctaUrl}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.cream};text-decoration:none;padding:9px 16px;font-family:${FONTS.sans};font-size:9px;letter-spacing:0.14em;text-transform:uppercase;">Swipe →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const inner = `
  <tr>
    <td style="padding:36px 44px 20px;">
      <h1 class="headline" style="font-family:${FONTS.serif};font-size:34px;font-weight:300;color:${COLORS.ink};margin:0 0 10px;line-height:1.2;letter-spacing:-0.01em;">${data.headline}</h1>
      <p style="font-family:${FONTS.sans};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.warmGray};margin:0 0 24px;">${data.subheadline}</p>
      <p style="font-family:${FONTS.serif};font-size:16px;color:${COLORS.charcoal};line-height:1.7;margin:0 0 32px;font-weight:300;">${data.bodyText}</p>
      ${pieces.length === 0 ? `<a href="${data.ctaUrl}" class="cta-button" style="display:inline-block;background:${COLORS.ink};color:${COLORS.cream};text-decoration:none;padding:14px 28px;font-family:${FONTS.sans};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">See Today's Look</a>` : ""}
    </td>
  </tr>
  ${streakBadge}
  ${pieceStrip}
  ${swipeCallout}
  ${data.showProUpsell ? proUpsellBlock(data.ctaUrl) : ""}
  <tr><td style="padding:28px 44px 4px;"><a href="${data.ctaUrl}" class="cta-button" style="display:inline-block;background:${COLORS.ink};color:${COLORS.cream};text-decoration:none;padding:14px 28px;font-family:${FONTS.sans};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">See Today's Full Look</a></td></tr>`;

  return baseWrapper(inner).replace("{{UNSUBSCRIBE_URL}}", data.ctaUrl.replace(/\/today.*/, "/unsubscribe?token={{TOKEN}}"));
}

export interface ReEngagementEmailData {
  firstName:   string;
  daysSince:   number;
  ctaUrl:      string;
  headline:    string;   // AI-generated
  bodyText:    string;   // AI-generated
  wardrobeCount: number;
  showProUpsell?: boolean;
}

export function reEngagementEmail(data: ReEngagementEmailData): string {
  const inner = `
  <tr>
    <td style="padding:36px 44px 28px;">
      <p style="font-family:${FONTS.sans};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 16px;">We miss you</p>
      <h1 class="headline" style="font-family:${FONTS.serif};font-size:34px;font-weight:300;color:${COLORS.ink};margin:0 0 10px;line-height:1.2;letter-spacing:-0.01em;">${data.headline}</h1>
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
      <a href="${data.ctaUrl}" class="cta-button" style="display:inline-block;background:${COLORS.ink};color:${COLORS.cream};text-decoration:none;padding:14px 28px;font-family:${FONTS.sans};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">
        Get Today's Outfit
      </a>
    </td>
  </tr>
  ${data.showProUpsell ? proUpsellBlock(data.ctaUrl) : ""}`;

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

export interface WelcomeEmailData {
  firstName:   string;
  ctaUrl:      string;
  headline:    string;      // AI-generated
  bodyText:    string;      // AI-generated
  step1:       string;      // AI-generated — first onboarding nudge
  step2:       string;      // AI-generated — second onboarding nudge
  step3:       string;      // AI-generated — third onboarding nudge
  closingLine: string;      // AI-generated — one warm closing sentence
}

export function welcomeEmail(data: WelcomeEmailData): string {
  const inner = `
  <tr>
    <td style="padding:40px 44px 8px;">
      <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${COLORS.gold};margin:0 0 18px;">Welcome to ALT FIT</p>
      <h1 style="font-family:${FONTS.serif};font-size:36px;font-weight:300;color:${COLORS.ink};margin:0 0 20px;line-height:1.2;letter-spacing:-0.01em;">${data.headline}</h1>
      <p style="font-family:${FONTS.serif};font-size:16px;color:${COLORS.charcoal};line-height:1.75;margin:0 0 36px;font-weight:300;">${data.bodyText}</p>
    </td>
  </tr>

  <!-- Getting started steps -->
  <tr>
    <td style="padding:0 44px 32px;">
      <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 20px;">Where to begin</p>
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:14px 0;border-top:1px solid ${COLORS.linen};">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:28px;vertical-align:top;padding-top:2px;">
                  <p style="font-family:${FONTS.sans};font-size:10px;color:${COLORS.gold};margin:0;font-weight:600;">01</p>
                </td>
                <td>
                  <p style="font-family:${FONTS.serif};font-size:15px;font-weight:300;color:${COLORS.charcoal};margin:0;line-height:1.5;">${data.step1}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-top:1px solid ${COLORS.linen};">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:28px;vertical-align:top;padding-top:2px;">
                  <p style="font-family:${FONTS.sans};font-size:10px;color:${COLORS.gold};margin:0;font-weight:600;">02</p>
                </td>
                <td>
                  <p style="font-family:${FONTS.serif};font-size:15px;font-weight:300;color:${COLORS.charcoal};margin:0;line-height:1.5;">${data.step2}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-top:1px solid ${COLORS.linen};border-bottom:1px solid ${COLORS.linen};">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:28px;vertical-align:top;padding-top:2px;">
                  <p style="font-family:${FONTS.sans};font-size:10px;color:${COLORS.gold};margin:0;font-weight:600;">03</p>
                </td>
                <td>
                  <p style="font-family:${FONTS.serif};font-size:15px;font-weight:300;color:${COLORS.charcoal};margin:0;line-height:1.5;">${data.step3}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:0 44px 36px;">
      <p style="font-family:${FONTS.serif};font-size:15px;font-style:italic;color:${COLORS.warmGray};margin:0 0 24px;line-height:1.6;">${data.closingLine}</p>
      <a href="${data.ctaUrl}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.cream};text-decoration:none;padding:14px 32px;font-family:${FONTS.sans};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">
        Build Your Wardrobe
      </a>
    </td>
  </tr>`;

  return baseWrapper(inner).replace("{{UNSUBSCRIBE_URL}}", `${data.ctaUrl.replace(/\/(wardrobe|today).*/, "")}/unsubscribe?token={{TOKEN}}`);
}

export interface EveningEmailData {
  firstName:       string;
  ctaUrl:          string;
  headline:        string;        // AI-generated
  bodyText:        string;        // AI-generated
  challengeText:   string;        // AI-generated — the specific hook/challenge/insight
  challengeLabel:  string;        // AI-generated — e.g. "TONIGHT'S THOUGHT" | "STYLE CHALLENGE" | "WARDROBE INSIGHT"
  tomorrowTeaser:  string;        // AI-generated — one line teasing tomorrow
  wardrobeStat?:   { label: string; value: string }; // e.g. { label: "pieces styled this week", value: "8" }
  streak?:         number;
  outfitPieces?:   OutfitPiece[]; // up to 4 pieces for evening preview
}

export function eveningEngagementEmail(data: EveningEmailData): string {
  const streakBadge = data.streak && data.streak >= 2
    ? `<tr>
        <td style="padding:0 44px 24px;">
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

  const statBlock = data.wardrobeStat
    ? `<tr>
        <td style="padding:0 44px 28px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="background:${COLORS.linen};padding:20px 24px;">
                <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 6px;">${data.wardrobeStat.label}</p>
                <p style="font-family:${FONTS.serif};font-size:28px;font-weight:300;color:${COLORS.ink};margin:0;line-height:1;">${data.wardrobeStat.value}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const inner = `
  <tr>
    <td style="padding:36px 44px 8px;">
      <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 14px;">Good evening, ${data.firstName}</p>
      <h1 style="font-family:${FONTS.serif};font-size:32px;font-weight:300;color:${COLORS.ink};margin:0 0 20px;line-height:1.25;letter-spacing:-0.01em;">${data.headline}</h1>
      <p style="font-family:${FONTS.serif};font-size:16px;color:${COLORS.charcoal};line-height:1.7;margin:0 0 32px;font-weight:300;">${data.bodyText}</p>
    </td>
  </tr>

  <!-- Challenge / Insight block -->
  <tr>
    <td style="padding:0 44px 28px;">
      <table cellpadding="0" cellspacing="0" width="100%" style="border-left:3px solid ${COLORS.gold};">
        <tr>
          <td style="padding:14px 20px;">
            <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.gold};margin:0 0 8px;">${data.challengeLabel}</p>
            <p style="font-family:${FONTS.serif};font-size:15px;font-style:italic;color:${COLORS.charcoal};margin:0;line-height:1.65;font-weight:300;">${data.challengeText}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  ${statBlock}
  ${streakBadge}

  <!-- Tomorrow teaser -->
  <tr>
    <td style="padding:0 44px 28px;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background:${COLORS.ink};">
        <tr>
          <td style="padding:20px 24px;">
            <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.gold};margin:0 0 8px;">Tomorrow's look</p>
            <p style="font-family:${FONTS.serif};font-size:15px;font-weight:300;color:${COLORS.cream};margin:0 0 16px;line-height:1.5;">${data.tomorrowTeaser}</p>
            <a href="${data.ctaUrl}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.cream};text-decoration:none;padding:11px 22px;font-family:${FONTS.sans};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;">
              Plan Tomorrow's Outfit
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return baseWrapper(inner).replace("{{UNSUBSCRIBE_URL}}", `${data.ctaUrl.replace(/\/today.*/, "")}/unsubscribe?token={{TOKEN}}`);
}

// ── Good Morning Email ──────────────────────────────────────────────────────

export interface GoodMorningEmailData {
  firstName:     string;
  dayOfWeek:     string;
  ctaUrl:        string;
  headline:      string;        // AI-generated
  bodyText:      string;        // AI-generated
  outfitPieces?: OutfitPiece[]; // up to 6 pieces from wardrobe for visual grid
  outfitName?:   string;        // e.g. "Friday Minimalist"
  mood?:         string;        // e.g. "Casual"
}

export function goodMorningEmail(data: GoodMorningEmailData): string {
  const pieces = (data.outfitPieces ?? []).slice(0, 6);
  
  // 6-column grid: 78px each (since 560-88 padding = 472 / 6 ~78px, -1px gaps = 77px)
  const outfitGrid = pieces.length > 0
    ? `<tr>
        <td style="padding:0 44px 20px;">
          <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 14px;">Your ${data.dayOfWeek} outfit</p>
          <table cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:1px;width:100%;">
            <tr>
              ${pieces.map(p => {
                const imgUrl = safeImageUrl(p.imageUrl);
                return `
                <td style="width:77px;vertical-align:top;padding:0;">
                  <div style="background:${COLORS.cream};border:1px solid ${COLORS.linen};overflow:hidden;">
                    ${imgUrl
                      ? `<img src="${imgUrl}" alt="${p.name}" width="77" height="100" style="display:block;width:77px;height:100px;object-fit:cover;border:0;" />`
                      : `<div style="width:77px;height:100px;background:${COLORS.linen};display:flex;align-items:center;justify-content:center;"><span style="font-size:18px;opacity:0.25;">✦</span></div>`
                    }
                    <div style="padding:6px 4px;text-align:center;">
                      <p style="font-family:${FONTS.sans};font-size:7px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 2px;">${p.category}</p>
                      <p style="font-family:${FONTS.serif};font-size:10px;font-weight:300;color:${COLORS.ink};margin:0;line-height:1.2;word-break:break-word;">${p.name}</p>
                    </div>
                  </div>
                </td>
              `}).join("")}
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const inner = `
  <tr>
    <td style="padding:36px 44px 20px;">
      <p style="font-family:${FONTS.sans};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 12px;">Good morning, ${data.firstName}</p>
      <h1 style="font-family:${FONTS.serif};font-size:36px;font-weight:300;color:${COLORS.ink};margin:0 0 10px;line-height:1.2;letter-spacing:-0.01em;">${data.headline}</h1>
      <p style="font-family:${FONTS.serif};font-size:16px;color:${COLORS.charcoal};line-height:1.7;margin:0;font-weight:300;">${data.bodyText}</p>
    </td>
  </tr>
  ${outfitGrid}
  <tr>
    <td style="padding:20px 44px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td>
            <a href="${data.ctaUrl}" style="display:inline-block;background:${COLORS.ink};color:${COLORS.cream};text-decoration:none;padding:14px 28px;font-family:${FONTS.sans};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">
              See Full Outfit →
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return baseWrapper(inner).replace("{{UNSUBSCRIBE_URL}}", data.ctaUrl.replace(/\/today.*/, "/unsubscribe?token={{TOKEN}}"));
}

// ── Share Your Outfits Email ────────────────────────────────────────────────

export interface ShareOutfitsEmailData {
  firstName:  string;
  ctaUrl:     string;
  headline:   string;        // AI-generated
  bodyText:   string;        // AI-generated
  savedCount? : number;       // number of saved outfits
}

export function shareOutfitsEmail(data: ShareOutfitsEmailData): string {
  const inner = `
  <tr>
    <td style="padding:36px 44px 28px;">
      <h1 style="font-family:${FONTS.serif};font-size:34px;font-weight:300;color:${COLORS.ink};margin:0 0 12px;line-height:1.2;letter-spacing:-0.01em;">${data.headline}</h1>
      <p style="font-family:${FONTS.serif};font-size:16px;color:${COLORS.charcoal};line-height:1.7;margin:0 0 32px;font-weight:300;">${data.bodyText}</p>
    </td>
  </tr>

  <!-- Share options grid -->
  <tr>
    <td style="padding:0 44px 28px;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <!-- Instagram row -->
        <tr>
          <td style="padding:0 0 16px;">
            <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${COLORS.linen};background:${COLORS.cream};">
              <tr>
                <td style="padding:20px 24px;">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="width:32px;vertical-align:middle;padding-right:12px;">
                        <div style="font-size:24px;">📸</div>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="font-family:${FONTS.sans};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 2px;">Share to Instagram</p>
                        <p style="font-family:${FONTS.serif};font-size:14px;font-weight:300;color:${COLORS.charcoal};margin:0;">Show your saved looks</p>
                      </td>
                      <td style="vertical-align:middle;padding-left:16px;text-align:right;">
                        <a href="${data.ctaUrl}/saved-outfits" style="display:inline-block;background:${COLORS.gold};color:${COLORS.cream};text-decoration:none;padding:10px 18px;font-family:${FONTS.sans};font-size:9px;letter-spacing:0.14em;text-transform:uppercase;">Open</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- WhatsApp row -->
        <tr>
          <td style="padding:0 0 16px;">
            <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${COLORS.linen};background:${COLORS.cream};">
              <tr>
                <td style="padding:20px 24px;">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="width:32px;vertical-align:middle;padding-right:12px;">
                        <div style="font-size:24px;">💚</div>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="font-family:${FONTS.sans};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 2px;">Share with Friends</p>
                        <p style="font-family:${FONTS.serif};font-size:14px;font-weight:300;color:${COLORS.charcoal};margin:0;">Ask advice on your style</p>
                      </td>
                      <td style="vertical-align:middle;padding-left:16px;text-align:right;">
                        <a href="${data.ctaUrl}/saved-outfits" style="display:inline-block;background:${COLORS.gold};color:${COLORS.cream};text-decoration:none;padding:10px 18px;font-family:${FONTS.sans};font-size:9px;letter-spacing:0.14em;text-transform:uppercase;">Open</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Community row -->
        <tr>
          <td style="padding:0;">
            <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${COLORS.linen};background:${COLORS.cream};">
              <tr>
                <td style="padding:20px 24px;">
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="width:32px;vertical-align:middle;padding-right:12px;">
                        <div style="font-size:24px;">✨</div>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="font-family:${FONTS.sans};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.taupe};margin:0 0 2px;">View All Saved</p>
                        <p style="font-family:${FONTS.serif};font-size:14px;font-weight:300;color:${COLORS.charcoal};margin:0;">${data.savedCount ?? "Browse"} curated looks</p>
                      </td>
                      <td style="vertical-align:middle;padding-left:16px;text-align:right;">
                        <a href="${data.ctaUrl}/saved-outfits" style="display:inline-block;background:${COLORS.gold};color:${COLORS.cream};text-decoration:none;padding:10px 18px;font-family:${FONTS.sans};font-size:9px;letter-spacing:0.14em;text-transform:uppercase;">View</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

  return baseWrapper(inner).replace("{{UNSUBSCRIBE_URL}}", `${data.ctaUrl.replace(/\/today.*/, "")}/unsubscribe?token={{TOKEN}}`);
}

/** Replace the {{TOKEN}} placeholder with an actual unsubscribe token. */
export function injectUnsubscribeToken(html: string, token: string): string {
  return html.replace(/{{TOKEN}}/g, encodeURIComponent(token));
}
