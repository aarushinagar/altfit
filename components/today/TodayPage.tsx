"use client";

import { useState, useEffect } from "react";
import { Box, Stack } from "@mui/material";
import { generateOutfit as generateOutfitAction } from "@/lib/actions/outfit";
import { getHourGreeting } from "@/lib/utils/clothing";
import { SHUFFLE_VIBES } from "@/lib/constants";
import OutfitCard from "@/components/today/OutfitCard";
import StyleSidebar from "@/components/today/StyleSidebar";

interface OutfitPiece {
  role: string;
  item: {
    id: string | number;
    name: string;
    imageUrl?: string | null;
    previewUrl?: string | null;
    colors?: string[];
    color?: string;
    colorHex?: string | null;
    emoji?: string;
  };
}

interface Outfit {
  occasion?: string;
  pieces: OutfitPiece[];
  colorStory?: string;
  reasoning?: string;
  scores?: {
    balance: number;
    formality: number;
    color: number;
    novelty: number;
  };
  wardrobeItemIds?: string[];
  outfitId?: string;
  items?: Array<{
    role?: string;
    wardrobeItemId?: string;
    wardrobeItem?: {
      id?: string;
      name?: string;
      imageUrl?: string;
      colors?: string[];
    };
  }>;
}

interface TodayPageProps {
  wardrobeTotal: number;
  onWear: (outfit: Outfit) => void;
  onGoToUpload: () => void;
}

export default function TodayPage({
  wardrobeTotal,
  onWear,
  onGoToUpload,
}: TodayPageProps) {
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  // Defer date/greeting to client to avoid SSR hydration mismatch
  const [dateStr, setDateStr] = useState("");
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
    setGreeting(getHourGreeting());
  }, []);

  const hasWardrobe = wardrobeTotal >= 2;

  const fetchOutfit = async (isShuffle = false) => {
    if (!hasWardrobe) return;
    setLoading(true);
    setError(null);
    const vibe = isShuffle
      ? SHUFFLE_VIBES[shuffleCount % SHUFFLE_VIBES.length]
      : undefined;
    try {
      const response = await generateOutfitAction({ mood: vibe });
      if (!response.success || !response.data)
        throw new Error(response.error || "No outfit returned");
      const result = response.data as unknown as Outfit;
      const pieces: OutfitPiece[] = (result.items || []).map((outfitItem) => ({
        role: outfitItem.role || "item",
        item: {
          id: outfitItem.wardrobeItem?.id || outfitItem.wardrobeItemId || "",
          name: outfitItem.wardrobeItem?.name || "Item",
          previewUrl: outfitItem.wardrobeItem?.imageUrl || null,
          colors: outfitItem.wardrobeItem?.colors || [],
          colorHex: outfitItem.wardrobeItem?.colors?.[0] || null,
        },
      }));
      setOutfit({ ...result, pieces });
      setAnimKey((k) => k + 1);
      if (isShuffle) setShuffleCount((c) => c + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate outfit",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasWardrobe) fetchOutfit(false);
  }, [wardrobeTotal]);

  const scores = outfit?.scores || {
    balance: 0,
    formality: 0,
    color: 0,
    novelty: 0,
  };

  return (
    <Box className="today-page page">
      <Box className="today-hero">
        {/* LEFT */}
        <Box className="today-greeting fade-up">
          <div className="greeting-eyebrow">{dateStr}</div>
          <h1 className="greeting-title">
            {greeting ? `${greeting}.` : ""} <br />
            <em>Here&apos;s your look</em> <br />
            for today.
          </h1>
          <p className="greeting-sub">
            Curated from your wardrobe. Intelligent, intentional, yours.
          </p>
          <div className="weather-pill">
            <span>🌤</span>
            <span>Mumbai · 29°C · Partly Cloudy</span>
          </div>

          {loading && (
            <div
              className="outfit-card"
              style={{ padding: 40, textAlign: "center" }}
            >
              <div
                style={{
                  fontSize: 28,
                  marginBottom: 16,
                  animation: "spin 1.2s linear infinite",
                  display: "inline-block",
                }}
              >
                ✦
              </div>
              <div
                style={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: 20,
                  fontWeight: 300,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                {shuffleCount > 0
                  ? "Finding a new look..."
                  : "Curating your outfit..."}
              </div>
              <div style={{ fontSize: 12, color: "var(--taupe)" }}>
                Analyzing your wardrobe with color psychology
              </div>
            </div>
          )}

          {!loading && error && (
            <Box className="outfit-card" sx={{ p: 5, textAlign: "center" }}>
              <Box
                component="span"
                sx={{ fontSize: 32, mb: 2, display: "block" }}
              >
                ⚠️
              </Box>
              <Box
                sx={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: 22,
                  fontWeight: 300,
                  color: "var(--ink)",
                  mb: 1.5,
                }}
              >
                Could not generate outfit
              </Box>
              <Box
                sx={{
                  fontSize: 12,
                  color: "var(--taupe)",
                  mb: 2.5,
                  lineHeight: 1.6,
                  background: "rgba(196,184,164,0.3)",
                  p: "12px 16px",
                  borderLeft: "2px solid var(--gold)",
                }}
              >
                {error.includes("No matching items") ||
                error === "AI returned no matching items" ? (
                  <>
                    <Box sx={{ fontWeight: 500, mb: 0.5 }}>
                      No matching items in wardrobe
                    </Box>
                    <Box>Try adding more pieces to get started.</Box>
                  </>
                ) : error.includes("Rate limit") ? (
                  <>
                    <Box sx={{ fontWeight: 500, mb: 0.5 }}>
                      Too many requests
                    </Box>
                    <Box>Please wait a few minutes before trying again.</Box>
                  </>
                ) : error.includes("No wardrobe items") ? (
                  <>
                    <Box sx={{ fontWeight: 500, mb: 0.5 }}>
                      Your wardrobe is empty
                    </Box>
                    <Box>
                      Upload your first pieces to unlock outfit generation.
                    </Box>
                  </>
                ) : (
                  <>
                    <Box sx={{ fontWeight: 500, mb: 0.5 }}>Error: {error}</Box>
                    <Box>
                      Please try again or contact support if the problem
                      persists.
                    </Box>
                  </>
                )}
              </Box>
              <Stack direction="row" gap={1.5} justifyContent="center">
                {!hasWardrobe && (
                  <button
                    className="btn-primary"
                    onClick={onGoToUpload}
                    style={{
                      padding: "12px 28px",
                      fontSize: 11,
                      letterSpacing: "0.12em",
                    }}
                  >
                    ADD PIECES
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => fetchOutfit(false)}
                  style={{
                    padding: "12px 28px",
                    fontSize: 11,
                    letterSpacing: "0.12em",
                  }}
                >
                  RETRY
                </button>
              </Stack>
            </Box>
          )}

          {!loading && !error && !outfit && !hasWardrobe && (
            <Box className="outfit-card" sx={{ p: 5, textAlign: "center" }}>
              <Box
                component="span"
                sx={{ fontSize: 32, mb: 2, display: "block" }}
              >
                👗
              </Box>
              <Box
                sx={{
                  fontFamily: "Cormorant Garamond, serif",
                  fontSize: 22,
                  fontWeight: 300,
                  color: "var(--ink)",
                  mb: 1,
                }}
              >
                Your wardrobe is waiting.
              </Box>
              <Box
                sx={{
                  fontSize: 12,
                  color: "var(--taupe)",
                  mb: 3,
                  lineHeight: 1.6,
                }}
              >
                Add at least 2 pieces to get your first AI-curated outfit.
              </Box>
            </Box>
          )}

          {!loading && outfit && (
            <OutfitCard
              animKey={animKey}
              outfit={outfit}
              loading={loading}
              shuffleCount={shuffleCount}
              onWear={onWear}
              onRegenerate={() => fetchOutfit(false)}
              onShuffle={() => fetchOutfit(true)}
            />
          )}
        </Box>

        {/* RIGHT SIDEBAR */}
        <StyleSidebar
          scores={scores}
          wardrobeTotal={wardrobeTotal}
          outfit={outfit}
        />
      </Box>
    </Box>
  );
}
