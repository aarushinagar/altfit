/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { Box, Stack } from "@mui/material";
import PieceCard from "@/components/today/PieceCard";

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
}

interface OutfitCardProps {
  animKey: number;
  outfit: Outfit;
  loading: boolean;
  shuffleCount: number;
  onWear: (outfit: Outfit) => void;
  onRegenerate: () => void;
  onShuffle: () => void;
}

export default function OutfitCard({
  animKey,
  outfit,
  loading,
  shuffleCount,
  onWear,
  onRegenerate,
  onShuffle,
}: OutfitCardProps) {
  return (
    <div key={animKey} className="outfit-card fade-up">
      <div className="outfit-card-header">
        <span className="outfit-card-title">Today&apos;s Outfit</span>
        <span className="occasion-tag">{outfit.occasion}</span>
      </div>
      <Box
        className="outfit-pieces"
        sx={{
          gridTemplateColumns: `repeat(${Math.min(outfit.pieces.length, 4)}, 1fr)`,
        }}
      >
        {outfit.pieces.map(({ role, item }) => (
          <PieceCard key={item.id} role={role} item={item} />
        ))}
      </Box>
      {outfit.colorStory && (
        <Stack
          direction="row"
          alignItems="center"
          sx={{ padding: "10px 24px", background: "var(--ink)" }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--gold)",
              mr: 1,
            }}
          >
            Color Story
          </Box>
          <Box
            component="span"
            sx={{ fontSize: 11, color: "var(--cream)", opacity: 0.8 }}
          >
            {outfit.colorStory}
          </Box>
        </Stack>
      )}
      <div className="outfit-reasoning">
        <span className="reasoning-icon">✦</span>
        <p className="reasoning-text">&quot;{outfit.reasoning}&quot;</p>
      </div>
      <div className="outfit-actions">
        <button className="btn-primary" onClick={() => onWear(outfit)}>
          Wear This Today
        </button>
        <button className="btn-secondary" onClick={onRegenerate}>
          Regenerate
        </button>
        <button
          className={`btn-shuffle ${loading ? "spinning" : ""}`}
          onClick={onShuffle}
          title="Different vibe"
          disabled={loading}
        >
          ↻
        </button>
      </div>
    </div>
  );
}
