/**
 * User Memory Context Builder
 *
 * Gathers three data sources in parallel (<500ms target):
 *   1. Wardrobe wear stats — top 5 most-worn + top 5 never-worn items
 *   2. Last 10 OutfitHistory entries — for variety enforcement
 *   3. UserStyleProfile — AI-maintained style snapshot
 *
 * Returns a compact string injected at the top of every curation prompt
 * so Claude has personal context without reading the full history.
 */

import prisma from "@/backend/database/prisma";

// ─────────────────────────────────────────────────────────────────────────────

interface WearStats {
    mostWorn: Array<{ name: string; category: string; wearCount: number }>;
    neverWorn: Array<{ name: string; category: string }>;
}

interface RecentOutfit {
    vibe: string | null;
    itemNames: string[];
    wasWorn: boolean | null;
    userFeedback: string | null;
    curatedAt: Date;
}

interface StyleProfile {
    preferredAesthetics: string[];
    avoidCombinations: string[];
    favoriteColors: string[];
    occasions: string[];
    fitPreference: string | null;
    styleInsights: string | null;
    leastWornCategories: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a memory context string for the given user.
 * All 3 Prisma queries run in parallel via Promise.all.
 */
export async function buildUserMemoryContext(userId: string): Promise<string> {
    const userIdBigInt = BigInt(userId);

    const [wearStats, recentOutfits, styleProfile] = await Promise.all([
        fetchWearStats(userIdBigInt),
        fetchRecentOutfits(userIdBigInt),
        fetchStyleProfile(userIdBigInt),
    ]);

    return formatMemoryContext(wearStats, recentOutfits, styleProfile);
}

// ─────────────────────────────────────────────────────────────────────────────

async function fetchWearStats(userId: bigint): Promise<WearStats> {
    const [mostWorn, neverWorn] = await Promise.all([
        prisma.wardrobeItem.findMany({
            where: { userId, isActive: true, wearCount: { gt: 0 } },
            orderBy: { wearCount: "desc" },
            take: 5,
            select: {
                name: true,
                category: true,
                wearCount: true,
                subcategory: true,
            },
        }),
        prisma.wardrobeItem.findMany({
            where: { userId, isActive: true, wearCount: 0 },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { name: true, category: true, subcategory: true },
        }),
    ]);

    return {
        mostWorn: mostWorn.map((i) => ({
            name: i.name ?? i.subcategory ?? i.category,
            category: i.category,
            wearCount: i.wearCount,
        })),
        neverWorn: neverWorn.map((i) => ({
            name: i.name ?? i.subcategory ?? i.category,
            category: i.category,
        })),
    };
}

async function fetchRecentOutfits(userId: bigint): Promise<RecentOutfit[]> {
    const rows = await prisma.outfitHistory.findMany({
        where: { userId },
        orderBy: { curatedAt: "desc" },
        take: 10,
        select: {
            vibe: true,
            itemNames: true,
            wasWorn: true,
            userFeedback: true,
            curatedAt: true,
        },
    });
    return rows;
}

async function fetchStyleProfile(
    userId: bigint,
): Promise<StyleProfile | null> {
    const row = await prisma.userStyleProfile.findUnique({
        where: { userId },
        select: {
            preferredAesthetics: true,
            avoidCombinations: true,
            favoriteColors: true,
            occasions: true,
            fitPreference: true,
            styleInsights: true,
            leastWornCategories: true,
        },
    });
    return row;
}

// ─────────────────────────────────────────────────────────────────────────────

function formatMemoryContext(
    wear: WearStats,
    recent: RecentOutfit[],
    profile: StyleProfile | null,
): string {
    const lines: string[] = ["── USER MEMORY CONTEXT ──"];

    // Style profile
    if (profile) {
        if (profile.preferredAesthetics.length > 0) {
            lines.push(
                `Aesthetics they love: ${profile.preferredAesthetics.join(", ")}`,
            );
        }
        if (profile.favoriteColors.length > 0) {
            lines.push(`Favourite colours: ${profile.favoriteColors.join(", ")}`);
        }
        if (profile.fitPreference) {
            lines.push(`Fit preference: ${profile.fitPreference}`);
        }
        if (profile.occasions.length > 0) {
            lines.push(`Dresses for: ${profile.occasions.join(", ")}`);
        }
        if (profile.avoidCombinations.length > 0) {
            lines.push(`Avoid: ${profile.avoidCombinations.join("; ")}`);
        }
        if (profile.leastWornCategories.length > 0) {
            lines.push(
                `Under-worn categories (push these): ${profile.leastWornCategories.join(", ")}`,
            );
        }
        if (profile.styleInsights) {
            lines.push(`AI style note: ${profile.styleInsights}`);
        }
    }

    // Wear stats
    if (wear.mostWorn.length > 0) {
        const worn = wear.mostWorn
            .map((i) => `${i.name} (×${i.wearCount})`)
            .join(", ");
        lines.push(`Most worn items: ${worn} — avoid repeating these today`);
    }
    if (wear.neverWorn.length > 0) {
        const untouched = wear.neverWorn.map((i) => i.name).join(", ");
        lines.push(`Never-worn items to surface: ${untouched}`);
    }

    // Recent outfit history
    if (recent.length > 0) {
        lines.push("Recent outfits curated (newest first):");
        recent.slice(0, 5).forEach((o, idx) => {
            const age = daysSince(o.curatedAt);
            const worn = o.wasWorn === true ? "worn" : o.wasWorn === false ? "skipped" : "unknown";
            const feedback = o.userFeedback ? ` · feedback: "${o.userFeedback}"` : "";
            const vibe = o.vibe ? ` [${o.vibe}]` : "";
            const items =
                o.itemNames.length > 0 ? o.itemNames.slice(0, 3).join(", ") : "unknown";
            lines.push(
                `  ${idx + 1}. ${age}d ago${vibe} — ${items} (${worn})${feedback}`,
            );
        });

        // Extract recently used vibes to push for variety
        const recentVibes = recent
            .slice(0, 3)
            .map((o) => o.vibe)
            .filter(Boolean) as string[];
        if (recentVibes.length > 0) {
            lines.push(
                `Avoid repeating these vibes from the past 3 days: ${[...new Set(recentVibes)].join(", ")}`,
            );
        }
    }

    lines.push("── END OF USER MEMORY ──");
    return lines.join("\n");
}

function daysSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}
