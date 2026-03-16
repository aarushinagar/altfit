"use client";

import { Box } from "@mui/material";
import WardrobeImage from "@/components/common/WardrobeImage";
import type { HydratedSlot } from "@/backend/langgraph/shared/types";

interface CurationSlotCardProps {
  slot: HydratedSlot;
  slotNumber: 1 | 2 | 3;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

const SLOT_LABELS = ["Morning Look", "Daytime Look", "Evening Look"] as const;

export default function CurationSlotCard({
  slot,
  slotNumber,
  onRegenerate,
  isRegenerating,
}: CurationSlotCardProps) {
  const items = slot.items ?? [];
  const label = SLOT_LABELS[slotNumber - 1];

  return (
    <div className="outfit-card fade-up">
      {/* Header */}
      <div className="outfit-card-header">
        <span className="outfit-card-title">{label}</span>
        <span className="occasion-tag">{slot.vibe}</span>
      </div>

      {/* Piece grid */}
      <Box
        className="outfit-pieces"
        sx={{
          gridTemplateColumns: `repeat(${Math.min(Math.max(items.length, 1), 4)}, 1fr)`,
        }}
      >
        {items.map((item) => (
          <div key={item.id} className="outfit-piece">
            <Box
              className="piece-visual"
              sx={{
                background: item.imageUrl ? "#ede9e3" : "var(--paper)",
                overflow: "hidden",
              }}
            >
              {item.imageUrl ? (
                <WardrobeImage
                  item={{
                    name: item.name,
                    imageUrl: item.imageUrl,
                  }}
                />
              ) : (
                <Box component="span" sx={{ fontSize: 32 }}>
                  👗
                </Box>
              )}
            </Box>
            <div className="piece-label">{item.category}</div>
            <div className="piece-name">{item.name}</div>
          </div>
        ))}
      </Box>

      {/* Occasion tags */}
      {slot.occasion_tags.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            padding: "10px 20px",
            borderTop: "1px solid var(--linen)",
          }}
        >
          {slot.occasion_tags.map((tag) => (
            <span key={tag} className="occasion-tag">
              {tag}
            </span>
          ))}
        </Box>
      )}

      {/* Rationale */}
      <div className="outfit-reasoning">
        <span className="reasoning-icon">✦</span>
        <p className="reasoning-text">&quot;{slot.rationale}&quot;</p>
      </div>

      {/* Styling tip */}
      {slot.styling_tip && (
        <Box
          sx={{
            padding: "10px 20px",
            background: "var(--paper)",
            borderTop: "1px solid var(--linen)",
            display: "flex",
            gap: "8px",
            alignItems: "flex-start",
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--gold)",
              fontFamily: "var(--font-sans)",
              flexShrink: 0,
              lineHeight: 1.8,
            }}
          >
            Tip
          </Box>
          <Box
            component="span"
            sx={{
              fontFamily: "var(--font-serif)",
              fontSize: 13,
              color: "var(--charcoal)",
              lineHeight: 1.55,
              fontStyle: "italic",
            }}
          >
            {slot.styling_tip}
          </Box>
        </Box>
      )}

      {/* Actions */}
      <div className="outfit-actions">
        <button
          className={`btn-shuffle ${isRegenerating ? "spinning" : ""}`}
          onClick={onRegenerate}
          disabled={isRegenerating}
          title="Regenerate this look"
          style={{ width: "auto", padding: "0 16px", gap: 6, fontSize: 11 }}
        >
          <span
            style={{
              display: "inline-block",
              animation: isRegenerating ? "spin 0.9s linear infinite" : "none",
            }}
          >
            ↻
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginLeft: 6,
            }}
          >
            {isRegenerating ? "Refreshing…" : "Refresh Look"}
          </span>
        </button>
      </div>
    </div>
  );
}
