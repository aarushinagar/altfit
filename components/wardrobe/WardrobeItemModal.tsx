"use client";

import WardrobeImage from "@/components/common/WardrobeImage";
import type { WardrobeItem } from "@/components/wardrobe/WardrobeItemCard";

interface WardrobeItemModalProps {
  item: WardrobeItem & {
    note?: string;
    pairsWith?: string[];
    wornCount?: number;
  };
  onClose: () => void;
  onRemove: (id: string | number) => void;
}

export default function WardrobeItemModal({
  item,
  onClose,
  onRemove,
}: WardrobeItemModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--taupe)",
                marginBottom: 6,
                fontWeight: 400,
              }}
            >
              {item.category}
            </div>
            <div
              style={{
                fontFamily: "Cormorant Garamond, serif",
                fontSize: 28,
                fontWeight: 300,
                color: "var(--ink)",
              }}
            >
              {item.name}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={() => {
                onRemove(item.id);
                onClose();
              }}
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                background: "none",
                border: "1px solid var(--linen)",
                color: "var(--taupe)",
                padding: "6px 12px",
                cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              Remove
            </button>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="modal-body">
          <div>
            <div
              className="modal-image"
              style={{
                background:
                  item.imageUrl || item.previewUrl
                    ? "#f0ece6"
                    : `${item.colors?.[0] || item.color || item.colorHex || "#ccc"}18`,
                padding: 0,
                overflow: "hidden",
              }}
            >
              {item.imageUrl || item.previewUrl ? (
                <WardrobeImage item={item} />
              ) : (
                <span style={{ fontSize: 72 }}>{item.emoji || "👗"}</span>
              )}
            </div>
          </div>
          <div className="modal-details">
            {item.note && (
              <div className="styling-note">
                <div className="detail-block-label">Stylist Note</div>
                <div
                  style={{
                    fontFamily: "Cormorant Garamond, serif",
                    fontSize: 16,
                    fontWeight: 300,
                    color: "var(--charcoal)",
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}
                >
                  &quot;{item.note}&quot;
                </div>
              </div>
            )}
            <div>
              <div className="detail-block-label">Details</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px 16px",
                }}
              >
                {[
                  ["Color", item.colorName],
                  ["Pattern", item.pattern],
                  ["Fit", item.fit || "—"],
                  ["Formality", item.formality],
                  ["Season", item.season],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <div
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "var(--taupe)",
                          marginBottom: 2,
                        }}
                      >
                        {k}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--charcoal)" }}>
                        {v}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            {item.pairsWith && item.pairsWith.length > 0 && (
              <div>
                <div className="detail-block-label">Pairs Well With</div>
                <div className="pairing-chips">
                  {item.pairsWith.map((p) => (
                    <span key={p} className="pairing-chip">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="detail-block-label">Wear History</div>
              <div className="wear-count">
                <div className="wear-dots">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`wear-dot ${i < (item.wornCount || 0) ? "" : "empty"}`}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "var(--taupe)" }}>
                  {item.wornCount || 0}× worn
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
