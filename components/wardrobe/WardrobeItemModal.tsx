"use client";

import { useState, useRef } from "react";
import { Box, Stack } from "@mui/material";
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
  /** Called with the selected File when user picks a replacement photo */
  onReupload?: (id: string | number, file: File) => void;
}

export default function WardrobeItemModal({
  item,
  onClose,
  onRemove,
  onReupload,
}: WardrobeItemModalProps) {
  const [imageBroken, setImageBroken] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasImage = !!(item.imageUrl || item.previewUrl);
  const showAddPhoto = (!hasImage || imageBroken) && !!onReupload;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <Box>
            <Box
              sx={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--taupe)",
                mb: 0.75,
                fontWeight: 400,
              }}
            >
              {item.category}
            </Box>
            <Box
              sx={{
                fontFamily: "Cormorant Garamond, serif",
                fontSize: 28,
                fontWeight: 300,
                color: "var(--ink)",
              }}
            >
              {item.name}
            </Box>
          </Box>
          <Stack direction="row" gap={1.5} alignItems="center">
            {showAddPhoto && (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background: "none",
                  border: "1px solid var(--gold)",
                  color: "var(--gold)",
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                📷 Add Photo
              </button>
            )}
            <button
              onClick={() => {
                if (
                  window.confirm(`Remove "${item.name}" from your wardrobe?`)
                ) {
                  onRemove(item.id);
                  onClose();
                }
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
          </Stack>
        </div>
        <div className="modal-body">
          <Box>
            <Box
              className="modal-image"
              sx={{
                background:
                  hasImage && !imageBroken
                    ? "#f0ece6"
                    : `${item.colors?.[0] || item.color || item.colorHex || "#ccc"}18`,
                p: 0,
                overflow: "hidden",
              }}
            >
              {hasImage && !imageBroken ? (
                <WardrobeImage item={item} onBroken={() => setImageBroken(true)} />
              ) : showAddPhoto ? (
                <Box
                  sx={{
                    width: "100%", height: "100%", minHeight: 200,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 1.5, background: "var(--linen)", cursor: "pointer",
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Box component="span" sx={{ fontSize: 40, lineHeight: 1 }}>📷</Box>
                  <Box sx={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--taupe)" }}>
                    Click to add photo
                  </Box>
                </Box>
              ) : (
                <Box component="span" sx={{ fontSize: 72 }}>
                  {item.emoji || "👗"}
                </Box>
              )}
            </Box>
          </Box>
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
              <Box
                sx={{
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
                    <Box key={k}>
                      <Box
                        sx={{
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "var(--taupe)",
                          mb: 0.25,
                        }}
                      >
                        {k}
                      </Box>
                      <Box sx={{ fontSize: 12, color: "var(--charcoal)" }}>
                        {v}
                      </Box>
                    </Box>
                  ))}
              </Box>
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
                <Box
                  component="span"
                  sx={{ fontSize: 11, color: "var(--taupe)" }}
                >
                  {item.wornCount || 0}× worn
                </Box>
              </div>
            </div>
          </div>
        </div>
        {/* Hidden file input for re-uploading a missing image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onReupload) {
              onReupload(item.id, file);
              e.target.value = "";
            }
          }}
        />
      </div>
    </div>
  );
}
