/**
 * Email Personalizer
 *
 * Uses Claude to generate personalised subject lines and body copy for
 * each email type based on the user's style profile, wardrobe, and streak.
 * Kept intentionally lightweight — short prompts, low token budgets.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface UserContext {
  firstName:            string;
  styleProfiles:        string[];     // e.g. ["minimal", "editorial"]
  favoriteColors:       string[];     // from UserStyleProfile
  wardrobeCount:        number;
  streak:               number;
  dayOfWeek:            string;       // "Thursday"
  lastOutfitName?:      string;       // e.g. "Monochrome Morning"
  previewItemName?:     string;       // wardrobe item to tease
  previewItemCategory?: string;
  daysSinceLastVisit:   number;
}

interface PersonalizedCopy {
  subject:      string;
  headline:     string;
  subheadline:  string;
  bodyText:     string;
}

/**
 * Generate personalized copy for a daily engagement email.
 * Falls back gracefully if Claude is unreachable.
 */
export async function personalizeDailyEmail(ctx: UserContext): Promise<PersonalizedCopy> {
  const prompt = `You are ALT FIT's editorial voice — refined, warm, fashion-forward. Never sycophantic or pushy.

User context:
- Name: ${ctx.firstName}
- Day: ${ctx.dayOfWeek}
- Style: ${ctx.styleProfiles.join(", ") || "not set"}
- Favorite colors: ${ctx.favoriteColors.join(", ") || "varied"}
- Wardrobe size: ${ctx.wardrobeCount} pieces
- Current streak: ${ctx.streak} days
${ctx.lastOutfitName ? `- Last outfit they saw: "${ctx.lastOutfitName}"` : ""}
${ctx.previewItemName ? `- Featured piece today: ${ctx.previewItemName} (${ctx.previewItemCategory})` : ""}

Write a personalized daily outfit reminder email. Return ONLY valid JSON with these keys:
{
  "subject": "short, intriguing subject line (max 9 words, no punctuation at end)",
  "headline": "one line displayed large in the email (max 10 words, can end with a period)",
  "subheadline": "one short uppercase subtitle (max 7 words, no period)",
  "bodyText": "2-3 sentences in an editorial voice. Mention their style or a specific piece if context given. End with a reason to open the app now."
}

Rules:
- Never use "hey" or "hi" as openers
- No exclamation marks
- Headline should reference ${ctx.dayOfWeek} or the specific occasion
- bodyText should feel like it comes from a personal stylist, not a marketing bot
- Keep total word count under 60 words across all fields`;

  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 300,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = (response.content[0] as { text: string }).text.trim();
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(jsonStr) as PersonalizedCopy;
  } catch (err) {
    console.error("[Personalizer] Claude error, using fallback:", err);
    return fallbackDailyCopy(ctx);
  }
}

export async function personalizeReEngagementEmail(ctx: UserContext): Promise<PersonalizedCopy> {
  const prompt = `You are ALT FIT's editorial voice — refined, warm, never guilt-tripping.

User context:
- Name: ${ctx.firstName}
- Days since last visit: ${ctx.daysSinceLastVisit}
- Wardrobe size: ${ctx.wardrobeCount} pieces
- Style: ${ctx.styleProfiles.join(", ") || "not set"}

Write a re-engagement email for someone who hasn't visited in ${ctx.daysSinceLastVisit} days. Return ONLY valid JSON:
{
  "subject": "short, intriguing subject line (max 9 words)",
  "headline": "one evocative line (max 10 words)",
  "subheadline": "short uppercase subtitle (max 6 words)",
  "bodyText": "2-3 sentences. Warm, curious tone. Remind them their wardrobe is waiting without sounding desperate. Reference their wardrobe count."
}

Rules: No exclamation marks. No guilt. No "we miss you" clichés in the headline. Speak like a trusted stylist checking in.`;

  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 300,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = (response.content[0] as { text: string }).text.trim();
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(jsonStr) as PersonalizedCopy;
  } catch {
    return fallbackReEngagementCopy(ctx);
  }
}

export async function personalizeMilestoneEmail(ctx: UserContext): Promise<PersonalizedCopy> {
  const prompt = `You are ALT FIT's editorial voice.

User: ${ctx.firstName}, ${ctx.streak}-day streak, style: ${ctx.styleProfiles.join(", ") || "not set"}.

Write a milestone celebration email for a ${ctx.streak}-day streak. Return ONLY valid JSON:
{
  "subject": "short celebratory subject line (max 8 words, no exclamation mark)",
  "headline": "one warm, memorable line celebrating the streak (max 10 words)",
  "subheadline": "short uppercase acknowledgement (max 6 words)",
  "bodyText": "2 sentences. Celebratory but understated. Reference what consistent style practice means."
}`;

  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 250,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = (response.content[0] as { text: string }).text.trim();
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(jsonStr) as PersonalizedCopy;
  } catch {
    return fallbackMilestoneCopy(ctx);
  }
}

// ── Fallback copy (used when Claude is unavailable) ──────────────────────────

function fallbackDailyCopy(ctx: UserContext): PersonalizedCopy {
  return {
    subject:     `Your ${ctx.dayOfWeek} look is ready`,
    headline:    `Your ${ctx.dayOfWeek} look is waiting.`,
    subheadline: "Curated from your wardrobe",
    bodyText:    `Three outfits, built from your ${ctx.wardrobeCount} pieces. Each one considered, intentional, and uniquely yours. Open the app to see what we put together for you today.`,
  };
}

function fallbackReEngagementCopy(ctx: UserContext): PersonalizedCopy {
  return {
    subject:     `Your wardrobe has been waiting`,
    headline:    `${ctx.wardrobeCount} pieces. Endless possibilities.`,
    subheadline: "Your next outfit is ready",
    bodyText:    `It's been a few days, and your ${ctx.wardrobeCount}-piece wardrobe has been sitting untapped. Come back and let AI show you what you've been missing — a fresh look, built entirely from what you already own.`,
  };
}

function fallbackMilestoneCopy(ctx: UserContext): PersonalizedCopy {
  return {
    subject:     `${ctx.streak} days of intentional style`,
    headline:    `${ctx.streak} days in a row.`,
    subheadline: "A streak worth celebrating",
    bodyText:    `Consistency is the foundation of great personal style. ${ctx.streak} days of showing up for yourself — that's not nothing. Keep going.`,
  };
}

// ── Welcome email personalizer ────────────────────────────────────────────────

export interface WelcomePersonalizedCopy {
  subject:     string;
  headline:    string;
  bodyText:    string;
  step1:       string;
  step2:       string;
  step3:       string;
  closingLine: string;
}

/**
 * Generate a personalized welcome email for a brand-new user.
 * Called immediately after account creation — user has no wardrobe yet.
 */
export async function personalizeWelcomeEmail(ctx: {
  firstName: string;
  provider:  "email" | "google" | string;
}): Promise<WelcomePersonalizedCopy> {
  const prompt = `You are ALT FIT's editorial voice — a refined, warm personal stylist welcoming a new member.

New user: ${ctx.firstName}, signed up via ${ctx.provider === "google" ? "Google" : "email"}.

ALT FIT is an AI-powered wardrobe styling app. Users upload their clothes, then AI curates daily outfits for them. It's about intentional dressing, not fast fashion.

Write a personalized welcome email. Return ONLY valid JSON:
{
  "subject": "a welcoming subject line (max 8 words, no exclamation mark)",
  "headline": "one memorable opening line to ${ctx.firstName} (max 10 words, warm but not gushing)",
  "bodyText": "2-3 sentences. Editorial tone. Explain the promise of ALT FIT in a way that feels personal and exciting — not like a product description. Make them feel like they just joined something special.",
  "step1": "First thing to do: upload wardrobe. Phrase it engagingly, one sentence.",
  "step2": "Second: complete style profile. Make it sound exciting, one sentence.",
  "step3": "Third: check Today tab for first AI-curated outfit. Build anticipation, one sentence.",
  "closingLine": "One warm, closing line. Sign it off as their personal stylist. Understated and sincere."
}

Rules:
- No exclamation marks anywhere
- No "hey" or "hi" as openers
- closingLine should feel like it comes from a person, not a brand
- The tone should be: you just got access to something exclusive and considered`;

  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 400,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = (response.content[0] as { text: string }).text.trim();
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(jsonStr) as WelcomePersonalizedCopy;
  } catch (err) {
    console.error("[Personalizer] Claude error (welcome), using fallback:", err);
    return fallbackWelcomeCopy(ctx.firstName);
  }
}

function fallbackWelcomeCopy(firstName: string): WelcomePersonalizedCopy {
  return {
    subject:     `${firstName}, your wardrobe is about to change`,
    headline:    `Your wardrobe, reimagined.`,
    bodyText:    `ALT FIT uses AI to transform the clothes you already own into daily outfits you'll actually want to wear. No more staring at a full wardrobe and feeling like you have nothing to wear. You're in the right place.`,
    step1:       "Upload your wardrobe — photos, pieces, anything you wear. The more you add, the smarter your outfits become.",
    step2:       "Complete your style profile so ALT FIT understands your aesthetic, your colors, and how you want to dress.",
    step3:       "Open the Today tab tomorrow morning — your first AI-curated outfit will be waiting for you.",
    closingLine: `Looking forward to seeing what we build together, ${firstName}.`,
  };
}

// ── Evening email personalizer ────────────────────────────────────────────────

export interface EveningPersonalizedCopy {
  subject:        string;
  headline:       string;
  bodyText:       string;
  challengeLabel: string;  // "STYLE CHALLENGE" | "WARDROBE INSIGHT" | "TONIGHT'S THOUGHT"
  challengeText:  string;  // the specific hook — a challenge, insight, or reflection
  tomorrowTeaser: string;  // one sentence teasing tomorrow's outfit
  wardrobeStat?: { label: string; value: string };
}

/**
 * Generate creative evening copy.
 * Claude picks the most interesting hook given the user's context.
 * Falls back gracefully if Claude is unreachable.
 */
export async function personalizeEveningEmail(
  ctx: UserContext & {
    unwovenItemName?: string;   // a wardrobe piece they haven't styled recently
    piecesStyledThisWeek?: number;
    totalPieces?: number;
  }
): Promise<EveningPersonalizedCopy> {
  const hookOptions = [
    "STYLE CHALLENGE — a specific, achievable outfit challenge for this week",
    "WARDROBE INSIGHT — a surprising observation about their wardrobe (what's unstyled, underused, or has potential)",
    "TONIGHT'S THOUGHT — an editorial-style reflection on personal style, dressing with intention, or the philosophy behind their aesthetic",
  ];

  const prompt = `You are ALT FIT's editorial voice — a brilliant personal stylist writing a sophisticated evening email to a user.

User context:
- Name: ${ctx.firstName}
- Style profiles: ${ctx.styleProfiles.join(", ") || "not set"}
- Favorite colors: ${ctx.favoriteColors.join(", ") || "varied"}
- Wardrobe size: ${ctx.totalPieces ?? ctx.wardrobeCount} pieces
${ctx.piecesStyledThisWeek !== undefined ? `- Pieces styled this week: ${ctx.piecesStyledThisWeek}` : ""}
${ctx.unwovenItemName ? `- A wardrobe piece they haven't worn recently: "${ctx.unwovenItemName}"` : ""}
- Current streak: ${ctx.streak} days
- Day of week: ${ctx.dayOfWeek}

Your job: Choose the hook type that will be most engaging for THIS user, then write the email.

Hook options (choose the most relevant one):
${hookOptions.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Return ONLY valid JSON:
{
  "subject": "intriguing evening subject line (max 9 words, no exclamation mark)",
  "headline": "one captivating headline (max 10 words, can end with a period)",
  "bodyText": "2-3 sentences. Evening tone — reflective, warm, anticipatory. Don't repeat the headline.",
  "challengeLabel": "one of: STYLE CHALLENGE | WARDROBE INSIGHT | TONIGHT'S THOUGHT",
  "challengeText": "the specific hook — 2-3 sentences. If a challenge: be specific and doable. If insight: be surprising. If thought: be poetic but grounded.",
  "tomorrowTeaser": "one intriguing sentence about what ALT FIT is preparing for them tomorrow. Build anticipation."${ctx.piecesStyledThisWeek !== undefined ? `,
  "wardrobeStat": { "label": "pieces styled this week", "value": "${ctx.piecesStyledThisWeek}" }` : ""}
}

Rules:
- Never use "hey", "hi", or exclamation marks
- challengeText should feel genuinely useful or thought-provoking, not generic
- tomorrowTeaser should create a curiosity gap — make them want to open the app in the morning
${ctx.unwovenItemName ? `- Consider referencing "${ctx.unwovenItemName}" in the challenge or insight — help them see it in a new way` : ""}
- Write for someone who cares deeply about their personal aesthetic`;

  try {
    const response = await anthropic.messages.create({
      model:      "claude-sonnet-4-5",
      max_tokens: 400,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = (response.content[0] as { text: string }).text.trim();
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(jsonStr) as EveningPersonalizedCopy;
  } catch (err) {
    console.error("[Personalizer] Claude error (evening), using fallback:", err);
    return fallbackEveningCopy(ctx);
  }
}

function fallbackEveningCopy(ctx: UserContext): EveningPersonalizedCopy {
  const challenges = [
    `Try building three completely different outfits around one piece from your wardrobe this week. Constraint breeds creativity — you may be surprised what you find.`,
    `Pick the piece in your wardrobe you reach for least. Wear it tomorrow. Sometimes the items we overlook are the ones with the most to say.`,
    `This week's challenge: dress for the version of ${ctx.firstName} you want to be, not the version you're comfortable being.`,
  ];
  const idx = ctx.wardrobeCount % challenges.length;
  return {
    subject:        `Tomorrow's look is almost ready`,
    headline:       `Tonight, a thought on your wardrobe.`,
    bodyText:       `Your ${ctx.wardrobeCount}-piece wardrobe is a canvas — and we've been thinking about what you haven't explored yet. We're building something special for tomorrow morning.`,
    challengeLabel: "STYLE CHALLENGE",
    challengeText:  challenges[idx],
    tomorrowTeaser: `Tomorrow we're pulling from the unexpected corners of your wardrobe — open the app at 8 AM to see what we found.`,
  };
}
