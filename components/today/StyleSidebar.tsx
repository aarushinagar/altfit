"use client";

import { Box } from "@mui/material";
import ScoreBar from "@/components/common/ScoreBar";

interface Scores {
  balance: number;
  formality: number;
  color: number;
  novelty: number;
}

interface OutfitPiece {
  role: string;
  item: {
    id: string | number;
    name: string;
    colorHex?: string | null;
    color?: string;
  };
}

interface StyleSidebarProps {
  scores: Scores;
  wardrobeTotal: number;
  outfit: { pieces: OutfitPiece[] } | null;
}

export default function StyleSidebar({
  scores,
  wardrobeTotal,
  outfit,
}: StyleSidebarProps) {
  return (
    <Box className="today-sidebar" sx={{ animationDelay: "0.15s" }}>
      <div className="sidebar-section">
        <p className="sidebar-heading">Style Score</p>
        <div className="style-score-bar">
          <ScoreBar label="Balance" value={scores.balance} />
          <ScoreBar label="Formality" value={scores.formality} />
          <ScoreBar label="Color" value={scores.color} />
          <ScoreBar label="Novelty" value={scores.novelty} />
        </div>
      </div>
      <div className="sidebar-section">
        <p className="sidebar-heading">Your Wardrobe</p>
        <div className="insight-card">
          <div className="insight-label">Collection</div>
          <div className="insight-text">
            {wardrobeTotal > 0
              ? `${wardrobeTotal} piece${wardrobeTotal > 1 ? "s" : ""} saved · outfit engine active`
              : "Upload your clothes to unlock AI styling"}
          </div>
        </div>
      </div>
      {outfit && (
        <div className="sidebar-section">
          <p className="sidebar-heading">Today&apos;s Pieces</p>
          <div className="last-worn-list">
            {outfit.pieces.map(({ role, item }) => (
              <div key={item.id} className="last-worn-item">
                <div
                  className="last-worn-dot"
                  style={{ background: item.colorHex || item.color || "#ccc" }}
                />
                <span className="last-worn-name">{item.name}</span>
                <span className="last-worn-date">{role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Box>
  );
}
