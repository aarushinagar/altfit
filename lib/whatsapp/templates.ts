/**
 * WhatsApp Message Templates
 *
 * WhatsApp messages are more personal, casual, and creative than emails.
 * Designed for direct messaging with emoji support and conversational tone.
 *
 * Character limit: 4096 characters (but kept under 1000 for readability on mobile)
 * Format: Plain text with emoji (no HTML/CSS)
 */

// ── Good Morning WhatsApp Message ──────────────────────────────────────────

export interface GoodMorningWhatsAppData {
  firstName: string;
  dayOfWeek: string;
  headline: string; // Claude-generated
  bodyText: string; // Claude-generated
  outfitCount?: number; // How many pieces in today's outfit
}

export function goodMorningWhatsApp(data: GoodMorningWhatsAppData): string {
  return `${data.headline}

${data.bodyText}

${data.outfitCount ? `✨ Check out your ${data.outfitCount}-piece outfit for the day` : "✨ Your outfit is ready"}

Tap here to see it 👉 ${process.env.NEXT_PUBLIC_APP_URL}/today`;
}

// ── Share Your Outfits WhatsApp Message ────────────────────────────────────

export interface ShareOutfitsWhatsAppData {
  firstName: string;
  headline: string; // Claude-generated
  bodyText: string; // Claude-generated
  savedCount?: number; // How many saves they have
}

export function shareOutfitsWhatsApp(data: ShareOutfitsWhatsAppData): string {
  return `${data.headline}

${data.bodyText}

${data.savedCount ? `🎨 You have ${data.savedCount} saved looks` : "🎨 Your saved looks are waiting"}

Share on Instagram 📸 or WhatsApp 💚
👉 ${process.env.NEXT_PUBLIC_APP_URL}/saved-outfits`;
}

// ── Daily Engagement WhatsApp ──────────────────────────────────────────────

export interface DailyEngagementWhatsAppData {
  firstName: string;
  headline: string; // Claude-generated
  bodyText: string; // Claude-generated
  lookCount?: number; // Number of looks awaiting
}

export function dailyEngagementWhatsApp(
  data: DailyEngagementWhatsAppData,
): string {
  return `Hey ${data.firstName}! 👋

${data.headline}

${data.bodyText}

${data.lookCount ? `Browse ${data.lookCount} curated looks 👉` : "See what's waiting for you 👉"} ${process.env.NEXT_PUBLIC_APP_URL}/today`;
}

// ── Evening Challenge WhatsApp ─────────────────────────────────────────────

export interface EveningWhatsAppData {
  firstName: string;
  headline: string; // Claude-generated
  bodyText: string; // Claude-generated
  challenge?: string; // E.g., "Try color blocking"
}

export function eveningWhatsAppMessage(data: EveningWhatsAppData): string {
  return `${data.headline} 🌙

${data.bodyText}

${data.challenge ? `Tonight's vibe: ${data.challenge}` : ""}

What did you wear today? 👗 ${process.env.NEXT_PUBLIC_APP_URL}/today`;
}

// ── Re-engagement WhatsApp ─────────────────────────────────────────────────

export interface ReengagementWhatsAppData {
  firstName: string;
  headline: string; // Claude-generated
  bodyText: string; // Claude-generated
  daysAgo?: number; // How many days since last activity
}

export function reengagementWhatsApp(data: ReengagementWhatsAppData): string {
  return `${data.headline}

${data.bodyText}

${data.daysAgo ? `It's been ${data.daysAgo} days since you last checked your wardrobe` : "We miss you!"}

Fresh looks waiting ✨ 👉 ${process.env.NEXT_PUBLIC_APP_URL}/today`;
}

// ── Milestone Celebration WhatsApp ─────────────────────────────────────────

export interface MilestoneWhatsAppData {
  firstName: string;
  headline: string; // Claude-generated
  bodyText: string; // Claude-generated
  milestone?: string; // E.g., "7 days straight"
}

export function milestoneWhatsApp(data: MilestoneWhatsAppData): string {
  return `${data.headline} 🎉

${data.bodyText}

${data.milestone ? `🏆 ${data.milestone}` : "You're on a roll!"}

Keep the streak going 💪 👉 ${process.env.NEXT_PUBLIC_APP_URL}/today`;
}

// ── Welcome WhatsApp Message ───────────────────────────────────────────────

export interface WelcomeWhatsAppData {
  firstName: string;
  headline: string; // Claude-generated
  bodyText: string; // Claude-generated
}

export function welcomeWhatsApp(data: WelcomeWhatsAppData): string {
  return `🎀 Welcome to Altfit, ${data.firstName}!

${data.headline}

${data.bodyText}

Let's start building your wardrobe ✨

📲 Tap here 👉 ${process.env.NEXT_PUBLIC_APP_URL}/upload`;
}
