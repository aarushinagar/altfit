/**
 * WhatsApp Message Personalizers
 *
 * Uses Claude to generate WhatsApp-specific, casual, and creative copy
 * WhatsApp tone: Friendly, conversational, emoji-rich, more personal than email
 */

import Anthropic from "@anthropic-ai/sdk";
import type { UserContext } from "@/backend/langgraph/shared/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface WhatsAppPersonalizedCopy {
  headline: string; // Single greeting line (20-30 chars)
  bodyText: string; // Message body (1-3 sentences, personal tone)
}

// ── Good Morning WhatsApp ────────────────────────────────────────────────────

export async function personalizeGoodMorningWhatsApp(
  ctx: UserContext,
): Promise<WhatsAppPersonalizedCopy> {
  try {
    const prompt = `Generate a SHORT, CASUAL good morning WhatsApp message for a fashion app user.

User: ${ctx.name}, style= ${ctx.styleProfiles?.join(", ") || "undefined"}
Day: ${ctx.dayOfWeek || "today"}
Wardrobe: ${ctx.wardrobeItemCount || 0} items

Keep it 2-3 sentences MAX. Casual tone. Add 1 emoji. Make it feel like a close friend texting.

Format:
HEADLINE: [One greeting line, e.g. "Rise and shine! 🌅"]
BODY: [2-3 personal sentences about their outfit or style]

Output ONLY these two lines, no extra text.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const lines = text.split("\n").filter((l) => l.trim());

    const headline =
      lines
        .find((l) => l.includes("HEADLINE:"))
        ?.replace("HEADLINE:", "")
        .trim() || "Good morning! ☀️";

    const bodyText =
      lines
        .find((l) => l.includes("BODY:"))
        ?.replace("BODY:", "")
        .trim() ||
      fallbackGoodMorningWhatsApp().bodyText;

    return { headline, bodyText };
  } catch (err) {
    console.error("[WhatsApp] Good morning personalization failed:", err);
    return fallbackGoodMorningWhatsApp();
  }
}

function fallbackGoodMorningWhatsApp(): WhatsAppPersonalizedCopy {
  const greetings = [
    "Rise and shine! 🌅",
    "Good morning, fashionista! ☀️",
    "Let's get dressed! 👗",
    "New day, new vibe 💫",
  ];
  return {
    headline: greetings[Math.floor(Math.random() * greetings.length)],
    bodyText: "Your outfit is ready and waiting for you. Let's make today look good!",
  };
}

// ── Share Your Outfits WhatsApp ──────────────────────────────────────────────

export async function personalizeShareOutfitsWhatsApp(
  ctx: UserContext & { savedOutfitCount: number },
): Promise<WhatsAppPersonalizedCopy> {
  try {
    const prompt = `Generate a CASUAL WhatsApp message encouraging a user to share their saved outfits.

User: ${ctx.name}, has ${ctx.savedOutfitCount} saved looks
Style: ${ctx.styleProfiles?.join(", ") || "undefined"}

Make it feel like a friend asking them to share, not a corporate ask. 
Be authentic, not pushy. 2-3 sentences MAX.

Format:
HEADLINE: [One line, e.g. "Your style deserves an audience 👀"]
BODY: [2-3 personal sentences about sharing]

Output ONLY these two lines.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const lines = text.split("\n").filter((l) => l.trim());

    const headline =
      lines
        .find((l) => l.includes("HEADLINE:"))
        ?.replace("HEADLINE:", "")
        .trim() || "Your style is inspiring 💚";

    const bodyText =
      lines
        .find((l) => l.includes("BODY:"))
        ?.replace("BODY:", "")
        .trim() ||
      fallbackShareOutfitsWhatsApp().bodyText;

    return { headline, bodyText };
  } catch (err) {
    console.error("[WhatsApp] Share outfits personalization failed:", err);
    return fallbackShareOutfitsWhatsApp();
  }
}

function fallbackShareOutfitsWhatsApp(): WhatsAppPersonalizedCopy {
  const headlines = [
    "Your style is inspiring 💚",
    "Friends want to see your looks 👀",
    "Spread the fashion love ✨",
  ];
  return {
    headline: headlines[Math.floor(Math.random() * headlines.length)],
    bodyText: "Share your saved looks with friends on Instagram or WhatsApp. Your style could inspire them!",
  };
}

// ── Daily Engagement WhatsApp ────────────────────────────────────────────────

export async function personalizeDailyEngagementWhatsApp(
  ctx: UserContext,
): Promise<WhatsAppPersonalizedCopy> {
  try {
    const prompt = `Generate a CASUAL WhatsApp message to re-engage a user with the app.

User: ${ctx.name}, style= ${ctx.styleProfiles?.join(", ") || "undefined"}
Wardrobe: ${ctx.wardrobeItemCount || 0} items

Keep it light and fun. 2-3 sentences. Like texting a friend.

Format:
HEADLINE: [One line hook, e.g. "Check what's new 🆕"]
BODY: [2-3 casual sentences]

Output ONLY these two lines.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const lines = text.split("\n").filter((l) => l.trim());

    const headline =
      lines
        .find((l) => l.includes("HEADLINE:"))
        ?.replace("HEADLINE:", "")
        .trim() || "What to wear? 👕";

    const bodyText =
      lines
        .find((l) => l.includes("BODY:"))
        ?.replace("BODY:", "")
        .trim() ||
      "We've curated some fresh looks just for your style.";

    return { headline, bodyText };
  } catch (err) {
    console.error("[WhatsApp] Daily engagement personalization failed:", err);
    return {
      headline: "What to wear? 👕",
      bodyText: "We've curated some fresh looks just for your style.",
    };
  }
}

// ── Evening WhatsApp ────────────────────────────────────────────────────────

export async function personalizeEveningWhatsApp(
  ctx: UserContext,
): Promise<WhatsAppPersonalizedCopy> {
  try {
    const prompt = `Generate a CASUAL evening WhatsApp message about styling for tonight/tomorrow.

User: ${ctx.name}, style= ${ctx.styleProfiles?.join(", ") || "undefined"}
Day: ${ctx.dayOfWeek || "today"}

Keep it fun and vibe-based. 2-3 sentences.

Format:
HEADLINE: [One line, e.g. "Tonight's fit ✨"]
BODY: [2-3 casual sentences]

Output ONLY these two lines.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const lines = text.split("\n").filter((l) => l.trim());

    const headline =
      lines
        .find((l) => l.includes("HEADLINE:"))
        ?.replace("HEADLINE:", "")
        .trim() || "Tonight's fit ✨";

    const bodyText =
      lines
        .find((l) => l.includes("BODY:"))
        ?.replace("BODY:", "")
        .trim() ||
      "Let's make the evening count. Try something bold!";

    return { headline, bodyText };
  } catch (err) {
    console.error("[WhatsApp] Evening personalization failed:", err);
    return {
      headline: "Tonight's fit ✨",
      bodyText: "Let's make the evening count. Try something bold!",
    };
  }
}

// ── Milestone WhatsApp ──────────────────────────────────────────────────────

export async function personalizeMilestoneWhatsApp(
  ctx: UserContext & { streakDays: number },
): Promise<WhatsAppPersonalizedCopy> {
  try {
    const prompt = `Generate a CASUAL WhatsApp celebration for a user hitting ${ctx.streakDays} day streak.

User: ${ctx.name}, style= ${ctx.styleProfiles?.join(", ") || "undefined"}

Make it genuinely congratulatory and fun. 2-3 sentences.

Format:
HEADLINE: [One line celebration, e.g. "7-day legend! 🔥"]
BODY: [2-3 excited sentences]

Output ONLY these two lines.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const lines = text.split("\n").filter((l) => l.trim());

    const headline =
      lines
        .find((l) => l.includes("HEADLINE:"))
        ?.replace("HEADLINE:", "")
        .trim() || `${ctx.streakDays}-day legend! 🔥`;

    const bodyText =
      lines
        .find((l) => l.includes("BODY:"))
        ?.replace("BODY:", "")
        .trim() ||
      `You're on fire! ${ctx.streakDays} days of styling. Keep it going!`;

    return { headline, bodyText };
  } catch (err) {
    console.error("[WhatsApp] Milestone personalization failed:", err);
    return {
      headline: `${ctx.streakDays}-day legend! 🔥`,
      bodyText: `You're on fire! ${ctx.streakDays} days of styling. Keep it going!`,
    };
  }
}

// ── Re-engagement WhatsApp ──────────────────────────────────────────────────

export async function personalizeReengagementWhatsApp(
  ctx: UserContext & { daysInactive: number },
): Promise<WhatsAppPersonalizedCopy> {
  try {
    const prompt = `Generate a CASUAL WhatsApp re-engagement message for a user who's been inactive for ${ctx.daysInactive} days.

User: ${ctx.name}, style= ${ctx.styleProfiles?.join(", ") || "undefined"}

Make it feel like a friend checking in, not desperate. 2-3 sentences.

Format:
HEADLINE: [One line, e.g. "Miss you! 💭"]
BODY: [2-3 casual sentences]

Output ONLY these two lines.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const lines = text.split("\n").filter((l) => l.trim());

    const headline =
      lines
        .find((l) => l.includes("HEADLINE:"))
        ?.replace("HEADLINE:", "")
        .trim() || "Miss you! 💭";

    const bodyText =
      lines
        .find((l) => l.includes("BODY:"))
        ?.replace("BODY:", "")
        .trim() ||
      `It's been ${ctx.daysInactive} days. Your wardrobe has new possibilities waiting!`;

    return { headline, bodyText };
  } catch (err) {
    console.error("[WhatsApp] Re-engagement personalization failed:", err);
    return {
      headline: "Miss you! 💭",
      bodyText: `It's been ${ctx.daysInactive} days. Your wardrobe has new possibilities waiting!`,
    };
  }
}

// ── Welcome WhatsApp ─────────────────────────────────────────────────────

export async function personalizeWelcomeWhatsApp(
  ctx: { name: string; styleProfiles?: string[] },
): Promise<WhatsAppPersonalizedCopy> {
  try {
    const prompt = `Generate a WARM, WELCOMING WhatsApp message for a brand new user who just signed up for an AI fashion styling app.

User: ${ctx.name}, style preferences= ${ctx.styleProfiles?.join(", ") || "their style profile"}

Make it feel like a warm friend welcoming them to a new community. Emphasize the personalization & fun of the app. 2-3 sentences MAX. Add 1-2 emojis.

Format:
HEADLINE: [One greeting line, e.g. "Welcome to ALT FIT! 👗"]
BODY: [2-3 sentences about what they'll experience]

Output ONLY these two lines.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-3-5",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const lines = text.split("\n").filter((l) => l.trim());

    const headline =
      lines
        .find((l) => l.includes("HEADLINE:"))
        ?.replace("HEADLINE:", "")
        .trim() || "Welcome to ALT FIT! 👗";

    const bodyText =
      lines
        .find((l) => l.includes("BODY:"))
        ?.replace("BODY:", "")
        .trim() ||
      `We're excited to help you discover your style. Start by uploading pieces from your wardrobe—our AI will curate personalized looks tailored to you!`;

    return { headline, bodyText };
  } catch (err) {
    console.error("[WhatsApp] Welcome personalization failed:", err);
    return {
      headline: "Welcome to ALT FIT! 👗",
      bodyText: `We're excited to help you discover your style. Start by uploading pieces from your wardrobe—our AI will curate personalized looks tailored to you!`,
    };
  }
}
