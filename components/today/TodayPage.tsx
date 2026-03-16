"use client";

import { useState, useEffect } from "react";
import { Box, Stack } from "@mui/material";
import { useAuth } from "@/lib/hooks";
import { useCuration } from "@/lib/hooks/useCuration";
import { getHourGreeting } from "@/lib/utils/clothing";
import CurationSlotCard from "@/components/today/CurationSlotCard";

interface TodayPageProps {
  wardrobeTotal: number;
  onGoToUpload: () => void;
}

export default function TodayPage({
  wardrobeTotal,
  onGoToUpload,
}: TodayPageProps) {
  const { user } = useAuth();
  const {
    slots,
    isLoading,
    error,
    weatherSummary,
    reload,
    regenerateSlot,
    regenLoadingSlot,
    dismissSlot,
  } = useCuration(user?.id ?? null);

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

  return (
    <Box className="today-page page">
      <Box className="today-hero">
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
          {weatherSummary && (
            <div className="weather-pill">
              <span>🌤</span>
              <span>{weatherSummary}</span>
            </div>
          )}

          {/* Empty wardrobe */}
          {!hasWardrobe && !isLoading && (
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
            </Box>
          )}

          {/* Loading */}
          {isLoading && (
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
                Curating your looks for today…
              </div>
              <div style={{ fontSize: 12, color: "var(--taupe)" }}>
                Checking weather &amp; analysing your wardrobe
              </div>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
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
                Could not load today&apos;s outfits
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
                {error}
              </Box>
              <Stack direction="row" gap={1.5} justifyContent="center">
                <button
                  className="btn-secondary"
                  onClick={reload}
                  style={{
                    padding: "12px 28px",
                    fontSize: 11,
                    letterSpacing: "0.12em",
                  }}
                >
                  RETRY
                </button>
                {error?.includes("No wardrobe items found") && (
                  <button
                    className="btn-secondary"
                    onClick={onGoToUpload}
                    style={{
                      padding: "12px 28px",
                      fontSize: 11,
                      letterSpacing: "0.12em",
                    }}
                  >
                    UPLOAD ITEMS
                  </button>
                )}
              </Stack>
            </Box>
          )}

          {/* Curation slots */}
          {!isLoading && !error && slots && slots.length > 0 && (
            <Stack sx={{ mt: 3, gap: 3 }}>
              {slots.map((slot, i) => (
                <CurationSlotCard
                  key={i}
                  slot={slot}
                  slotNumber={(i + 1) as 1 | 2 | 3}
                  onRegenerate={() => regenerateSlot((i + 1) as 1 | 2 | 3)}
                  isRegenerating={regenLoadingSlot === i + 1}
                  onDismiss={() => dismissSlot(i)}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
