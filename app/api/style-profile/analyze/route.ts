/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/backend/database/prisma";
import { requireAuth } from "@/backend/database/auth-middleware";
import { successResponse, errorResponse } from "@/backend/database/api-response";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const STYLE_ANALYST_PROMPT = `You are a personal stylist building a concise style summary for a client.
Given their recent outfit history and wardrobe wear data, write 2-3 sentences that:
1. Describe their dominant aesthetic / colour palette
2. Note any patterns in what they skip or over-wear
3. Give one actionable suggestion for variety

Be warm, specific, and personal. Do NOT output JSON — just plain prose. Max 80 words.`;

/**
 * POST /api/style-profile/analyze
 * Triggers a Claude analysis of the user's last 10 outfits + wear stats
 * and updates UserStyleProfile.styleInsights + leastWornCategories.
 *
 * Designed to be called after every 5 curations (done by persistCurationNode
 * when interactionCount % 5 === 0) or manually from client.
 */
export async function POST(request: NextRequest) {
    try {
        // Accept both normal auth and internal server-to-server calls
        let userId: string;
        const internalUserId = request.headers.get("x-internal-user-id");
        if (internalUserId) {
            userId = internalUserId;
        } else {
            const auth = requireAuth(request);
            if (!auth.ok) return auth.response;
            userId = auth.userId;
        }

        const userIdBigInt = BigInt(userId);

        // Fetch data in parallel
        const [recentOutfits, wearStats, profile] = await Promise.all([
            prisma.outfitHistory.findMany({
                where: { userId: userIdBigInt },
                orderBy: { curatedAt: "desc" },
                take: 10,
                select: {
                    vibe: true,
                    itemNames: true,
                    occasionTags: true,
                    wasWorn: true,
                    userFeedback: true,
                },
            }),
            prisma.wardrobeItem.findMany({
                where: { userId: userIdBigInt, isActive: true },
                select: { category: true, wearCount: true, primaryColorName: true },
            }),
            prisma.userStyleProfile.findUnique({
                where: { userId: userIdBigInt },
                select: { preferredAesthetics: true, occasions: true, fitPreference: true },
            }),
        ]);

        if (recentOutfits.length === 0) {
            return errorResponse("Not enough outfit history to analyze yet", 400);
        }

        // Compute least-worn categories
        const catWear: Record<string, { total: number; count: number }> = {};
        for (const item of wearStats) {
            if (!catWear[item.category]) catWear[item.category] = { total: 0, count: 0 };
            catWear[item.category].total += item.wearCount;
            catWear[item.category].count++;
        }
        const leastWornCategories = Object.entries(catWear)
            .map(([cat, s]) => ({ cat, avg: s.total / s.count }))
            .sort((a, b) => a.avg - b.avg)
            .slice(0, 3)
            .filter((x) => x.avg < 2)
            .map((x) => x.cat);

        // Compute dominant palette
        const colorCounts: Record<string, number> = {};
        for (const item of wearStats) {
            if (item.primaryColorName) {
                colorCounts[item.primaryColorName] = (colorCounts[item.primaryColorName] ?? 0) + 1;
            }
        }
        const dominantPalette = Object.entries(colorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([color]) => color);

        // Build prompt context
        const outfitLines = recentOutfits.map((o, i) => {
            const worn = o.wasWorn === true ? "worn" : o.wasWorn === false ? "skipped" : "unknown";
            const fb = o.userFeedback ? ` (feedback: "${o.userFeedback}")` : "";
            return `${i + 1}. ${o.vibe ?? "—"} · ${(o.itemNames ?? []).slice(0, 3).join(", ")} · ${worn}${fb}`;
        });

        const wearSummary = Object.entries(catWear)
            .map(([cat, s]) => `${cat}: avg ${(s.total / s.count).toFixed(1)} wears (${s.count} items)`)
            .join(", ");

        const prompt = `${STYLE_ANALYST_PROMPT}

Recent outfits (newest first):
${outfitLines.join("\n")}

Wardrobe wear by category: ${wearSummary}
${profile?.preferredAesthetics?.length ? `Self-described aesthetics: ${profile.preferredAesthetics.join(", ")}` : ""}
${profile?.fitPreference ? `Fit preference: ${profile.fitPreference}` : ""}`;

        const response = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 200,
            messages: [{ role: "user", content: prompt }],
        });

        const styleInsights =
            response.content[0].type === "text" ? response.content[0].text.trim() : null;

        // Update the profile
        const updated = await prisma.userStyleProfile.upsert({
            where: { userId: userIdBigInt },
            create: {
                id: BigInt(Date.now()), // simple fallback ID; normally created by onboarding
                userId: userIdBigInt,
                styleInsights,
                leastWornCategories,
                dominantPalette,
                lastAnalyzedAt: new Date(),
            },
            update: {
                styleInsights,
                leastWornCategories,
                dominantPalette,
                lastAnalyzedAt: new Date(),
                updatedAt: new Date(),
            },
        });

        return successResponse({ styleInsights, leastWornCategories, dominantPalette }, "Style analysis complete");
    } catch (error) {
        console.error("[style-profile/analyze POST] Error:", error);
        return errorResponse(
            error instanceof Error ? error.message : "Analysis failed",
            500,
        );
    }
}
