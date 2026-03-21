#!/usr/bin/env npx ts-node
/**
 * send-test-emails.ts
 * Sends every ALT FIT email type to a target address for visual QA.
 * Usage: npx ts-node -r tsconfig-paths/register scripts/send-test-emails.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { Resend } from "resend";
import {
  dailyEngagementEmail,
  reEngagementEmail,
  milestoneEmail,
  welcomeEmail,
  eveningEngagementEmail,
  goodMorningEmail,
  shareOutfitsEmail,
  injectUnsubscribeToken,
} from "../lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY!);
const TO = "aarushi.nagar.work@gmail.com";
const FROM = "ALT FIT <contact@altfit.co.in>";
const APP_URL = "https://altfit-6fma.onrender.com";
const FAKE_TOKEN = "test-unsubscribe-token-12345";

const SAMPLE_PIECES = [
  { name: "White Linen Shirt", category: "Top", imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80" },
  { name: "Straight-Cut Trousers", category: "Bottom", imageUrl: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&q=80" },
  { name: "Tan Leather Belt", category: "Accessory", imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80" },
  { name: "Ivory Sneakers", category: "Shoes", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80" },
];

async function send(subject: string, html: string, label: string) {
  const result = await resend.emails.send({
    from: FROM,
    to: TO,
    subject,
    html: injectUnsubscribeToken(html, FAKE_TOKEN),
  });
  if (result.error) {
    console.error(`❌ ${label}: ${result.error.message}`);
  } else {
    console.log(`✅ ${label} — id: ${result.data?.id}`);
  }
}

async function main() {
  console.log(`\n📧 Sending all email types to ${TO}\n`);

  // 1. Welcome email
  await send(
    "Welcome to ALT FIT — Your AI stylist is ready",
    welcomeEmail({
      firstName: "Aarushi",
      ctaUrl: `${APP_URL}/wardrobe`,
      headline: "Your wardrobe, finally intelligent.",
      bodyText: "We're glad you're here. ALT FIT uses color psychology and AI to build outfits from what you already own — every single morning.",
      step1: "Upload 5–10 pieces from your wardrobe. Even just tops and bottoms is enough to start.",
      step2: "Complete your style profile so our AI understands your vibe — minimal, editorial, casual, or all three.",
      step3: "Come back tomorrow morning for your first AI-curated outfit, built from your exact wardrobe.",
      closingLine: "The best outfit you've ever worn is already in your closet — we're just going to help you find it.",
    }),
    "1. Welcome"
  );

  // 2. Daily engagement (with pieces)
  await send(
    "Saturday Morning — Your curated look is ready",
    dailyEngagementEmail({
      firstName: "Aarushi",
      dayOfWeek: "Saturday",
      ctaUrl: `${APP_URL}/today`,
      headline: "Saturday calls for effortless ease.",
      subheadline: "Curated from your wardrobe · Today's look",
      bodyText: "Your white linen shirt and straight-cut trousers are doing the heavy lifting today. Add the tan belt and you're done — it takes under 3 minutes.",
      streak: 5,
      outfitPieces: SAMPLE_PIECES,
      showProUpsell: true,
    }),
    "2. Daily Engagement"
  );

  // 3. Re-engagement
  await send(
    "Your wardrobe misses you",
    reEngagementEmail({
      firstName: "Aarushi",
      daysSince: 4,
      ctaUrl: `${APP_URL}/today`,
      headline: "Four days of perfect outfits, missed.",
      bodyText: "ALT FIT has been generating looks from your wardrobe every morning. This morning's was particularly good — come see it before the day slips away.",
      wardrobeCount: 74,
      showProUpsell: true,
    }),
    "3. Re-Engagement"
  );

  // 4. Milestone (7-day streak)
  await send(
    "🔥 7-day streak — you're building something real",
    milestoneEmail({
      firstName: "Aarushi",
      milestone: 7,
      ctaUrl: `${APP_URL}/today`,
      headline: "Seven days of intentional dressing.",
      bodyText: "A week of showing up for yourself, every morning. ALT FIT has noticed — your outfit quality, coordination and confidence are all measurably sharper than Day 1.",
    }),
    "4. Milestone (7-day streak)"
  );

  // 5. Evening engagement
  await send(
    "Tonight's style thought — ALT FIT",
    eveningEngagementEmail({
      firstName: "Aarushi",
      ctaUrl: `${APP_URL}/today`,
      headline: "The most underrated move in personal style.",
      bodyText: "It's not about owning more — it's about knowing what you own. Most wardrobes have 3 great outfits buried in 50 pieces. ALT FIT finds them for you.",
      challengeLabel: "TONIGHT'S THOUGHT",
      challengeText: "Tomorrow morning, try wearing something you haven't touched in a month. ALT FIT will build the rest of the outfit around it.",
      tomorrowTeaser: "Tomorrow's look is already queued — something cleaner and more intentional than usual.",
      wardrobeStat: { label: "pieces styled this week", value: "12" },
      streak: 5,
    }),
    "5. Evening Engagement"
  );

  // 6. Good morning (6-column grid)
  await send(
    "Good morning, Aarushi — your Saturday outfit",
    goodMorningEmail({
      firstName: "Aarushi",
      dayOfWeek: "Saturday",
      ctaUrl: `${APP_URL}/today`,
      headline: "A clean Saturday.",
      bodyText: "Linen, straight lines, and a leather accent. Color-balanced and occasion-ready. This look works for brunch, errands, or wherever the day takes you.",
      outfitPieces: [...SAMPLE_PIECES, ...SAMPLE_PIECES.slice(0, 2)],
      outfitName: "Saturday Minimalist",
      mood: "Casual",
    }),
    "6. Good Morning"
  );

  // 7. Share outfits
  await send(
    "Your saved looks are worth sharing",
    shareOutfitsEmail({
      firstName: "Aarushi",
      ctaUrl: APP_URL,
      headline: "You've built something worth showing off.",
      bodyText: "Seven saved outfits. Each one AI-curated from your actual wardrobe. That's a personal style archive — and it's yours to share.",
      savedCount: 7,
    }),
    "7. Share Your Outfits"
  );

  console.log(`\n📬 Done. Check ${TO}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
