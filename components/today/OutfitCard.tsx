"use client";

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
      <div
        className="outfit-pieces"
        style={{
          gridTemplateColumns: `repeat(${Math.min(outfit.pieces.length, 4)}, 1fr)`,
        }}
      >
        {outfit.pieces.map(({ role, item }) => (
          <PieceCard key={item.id} role={role} item={item} />
        ))}
      </div>
      {outfit.colorStory && (
        <div
          style={{
            padding: "10px 24px",
            background: "var(--ink)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginRight: 8,
            }}
          >
            Color Story
          </span>
          <span style={{ fontSize: 11, color: "var(--cream)", opacity: 0.8 }}>
            {outfit.colorStory}
          </span>
        </div>
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
