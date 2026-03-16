"use client";

import { Box, Stack } from "@mui/material";

export interface ClothingPiece {
  name?: string;
  category?: string;
  colorName?: string;
  colorHex?: string;
  colors?: string[];
  colorNames?: string[];
  formality?: number | string;
  pattern?: string;
  fabric?: string;
  fit?: string;
  season?: string | string[];
  occasion?: string | string[];
  note?: string;
  stylistNote?: string;
  tags?: string[];
  pairsWith?: string[];
}

export interface UploadItem {
  id: number;
  fileName?: string;
  status: "heic" | "reading" | "analyzing" | "error" | "ready";
  previewUrl?: string | null;
  base64?: string | null;
  mediaType?: string | null;
  uploadedUrl?: string | null;
  uploadedStoragePath?: string | null;
  wardrobeItemId?: string; // set when server has already persisted the item
  pieces?: ClothingPiece[] | null;
  piecePreviews?: string[] | null;
  savedPieceIds?: string[];
  savedPieceWardrobeIds?: Record<number, string>;
  savingPieceIds?: string[];
  savingFull?: boolean;
  savingOutfit?: boolean;
  outfitSaved?: boolean;
  intent?: "full_outfit" | "individual" | null;
  error?: string;
  progress?: number;
  source?: string;
  authorName?: string;
}

const OBJ_POS: Record<string, string> = {
  top: "50% 38%",
  outerwear: "50% 32%",
  bottom: "50% 28%",
  dress: "50% 40%",
  footwear: "50% 80%",
  bag: "50% 48%",
  accessory: "50% 32%",
};

interface UploadItemCardProps {
  item: UploadItem;
  onSaveFullOutfit: (item: UploadItem) => void;
  onSavePiece: (item: UploadItem, piece: ClothingPiece, idx: number) => void;
  onSaveAsOutfit: (item: UploadItem) => void;
  onSetIntent: (id: number, intent: UploadItem["intent"]) => void;
  onRemove: (id: number) => void;
}

export default function UploadItemCard({
  item,
  onSaveFullOutfit,
  onSavePiece,
  onSaveAsOutfit,
  onSetIntent,
  onRemove,
}: UploadItemCardProps) {
  if (item.status === "heic") {
    return (
      <Box
        sx={{
          mb: 3,
          border: "1px solid var(--gold)",
          background: "var(--paper)",
          p: "24px 28px",
        }}
      >
        <Stack direction="row" gap={2} alignItems="flex-start" sx={{ mb: 2 }}>
          <Box sx={{ fontSize: 28 }}>📸</Box>
          <Box>
            <Box
              sx={{
                fontFamily: "Cormorant Garamond, serif",
                fontSize: 18,
                color: "var(--ink)",
                mb: 0.5,
              }}
            >
              iPhone HEIC photo — needs conversion
            </Box>
            <Box sx={{ fontSize: 12, color: "var(--taupe)" }}>
              <strong>{item.fileName}</strong> — convert then re-upload.
            </Box>
          </Box>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          <a
            href="https://heictojpeg.net"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "block",
              padding: "12px",
              background: "var(--ink)",
              color: "var(--cream)",
              textDecoration: "none",
              textAlign: "center",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Convert Online →
          </a>
          <Box
            sx={{
              p: "12px",
              background: "var(--linen)",
              fontSize: 11,
              color: "var(--charcoal)",
              lineHeight: 1.5,
            }}
          >
            Permanent fix: iPhone Settings → Camera → Formats →{" "}
            <strong>Most Compatible</strong>
          </Box>
        </Box>
      </Box>
    );
  }

  if (item.status === "reading" || item.status === "analyzing") {
    return (
      <Stack
        direction="row"
        sx={{
          mb: 3,
          border: "1px solid var(--linen)",
          background: "var(--paper)",
        }}
      >
        <Box
          sx={{
            width: 120,
            flexShrink: 0,
            minHeight: 140,
            background: "var(--linen)",
            position: "relative",
          }}
        >
          {item.previewUrl && (
            <img
              src={item.previewUrl}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center top",
              }}
            />
          )}
        </Box>
        <Box sx={{ flex: 1, p: "20px 24px" }}>
          <Box sx={{ fontSize: 12, color: "var(--taupe)", mb: 1.25 }}>
            {item.status === "reading"
              ? "Preparing image..."
              : `Identifying garments... ${Math.round(item.progress ?? 0)}%`}
          </Box>
          <Box className="progress-bar">
            <Box
              className="progress-fill"
              sx={{ width: `${item.progress ?? 0}%` }}
            />
          </Box>
        </Box>
      </Stack>
    );
  }

  if (item.status === "error") {
    return (
      <Box
        sx={{
          mb: 3,
          border: "1px solid #ecc",
          background: "var(--paper)",
          overflow: "hidden",
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          gap={2}
          sx={{ p: "20px 24px" }}
        >
          <Box sx={{ fontSize: 28, flexShrink: 0 }}>⚠️</Box>
          <Box sx={{ flex: 1 }}>
            <Box
              sx={{ fontSize: 13, fontWeight: 600, color: "#c0392b", mb: 0.75 }}
            >
              Analysis failed
            </Box>
            <Box
              sx={{
                fontSize: 12,
                color: "#a93226",
                wordBreak: "break-word",
                mb: 1.5,
                lineHeight: 1.5,
              }}
            >
              {item.error?.includes("Rate limit")
                ? "Too many requests. Please wait a few seconds and try again."
                : item.error?.includes("No valid JSON") ||
                    item.error?.includes("parse")
                  ? "The image is unclear. Try a clearer photo with good lighting and contrast."
                  : item.error?.includes("Invalid image")
                    ? "Invalid image format. Please use JPG, PNG, or WebP files."
                    : `Error: ${item.error}`}
            </Box>
            <button
              onClick={() => onRemove(item.id)}
              style={{
                fontSize: 11,
                background: "#c0392b",
                color: "white",
                border: "none",
                padding: "8px 14px",
                cursor: "pointer",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              Remove
            </button>
          </Box>
        </Stack>
      </Box>
    );
  }

  if (item.status !== "ready") return null;

  // Auto-saved by server pipeline — show clean confirmation without piece-detection UI
  if (item.intent === "full_outfit" && item.wardrobeItemId) {
    return (
      <Box
        sx={{
          mb: 4,
          border: "1px solid var(--linen)",
          background: "var(--paper)",
        }}
      >
        <Stack direction="row">
          <Box
            sx={{
              width: 160,
              flexShrink: 0,
              minHeight: 200,
              background: "var(--linen)",
              position: "relative",
            }}
          >
            {item.previewUrl && (
              <img
                src={item.previewUrl}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                }}
              />
            )}
          </Box>
          <Box
            sx={{
              flex: 1,
              p: "24px 28px",
              borderLeft: "1px solid var(--linen)",
            }}
          >
            <Box
              sx={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--gold)",
                mb: 1,
              }}
            >
              ✓ Saved to wardrobe
            </Box>
            <Box
              sx={{
                fontFamily: "Cormorant Garamond, serif",
                fontSize: 20,
                fontWeight: 300,
                color: "var(--ink)",
                mb: 0.75,
                lineHeight: 1.3,
              }}
            >
              {item.fileName?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") ||
                "Clothing Item"}
            </Box>
            <Box sx={{ fontSize: 11, color: "var(--taupe)" }}>
              AI-analysed and added to your wardrobe.
            </Box>
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mb: 4,
        border: "1px solid var(--linen)",
        background: "var(--paper)",
      }}
    >
      <Stack direction="row">
        <Box
          sx={{
            width: 160,
            flexShrink: 0,
            minHeight: 210,
            background: "var(--linen)",
            position: "relative",
          }}
        >
          {item.previewUrl && (
            <img
              src={item.previewUrl}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center top",
              }}
            />
          )}
        </Box>
        <Box
          sx={{
            flex: 1,
            p: "24px 28px",
            borderLeft: "1px solid var(--linen)",
          }}
        >
          <Box
            sx={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--gold)",
              mb: 1,
            }}
          >
            {`✦ ${item.pieces?.length || 0} piece${(item.pieces?.length || 0) !== 1 ? "s" : ""} detected`}
          </Box>
          <Box
            sx={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: 21,
              fontWeight: 300,
              color: "var(--ink)",
              mb: 0.75,
              lineHeight: 1.3,
            }}
          >
            {item.pieces?.map((p) => p.name).join(", ")}
          </Box>
          <Box
            sx={{
              fontSize: 11,
              color: "var(--taupe)",
              mb: 2.5,
              lineHeight: 1.6,
            }}
          >
            How would you like to save this?
          </Box>

          {!item.intent && (
            <Stack gap={1.25}>
              <button
                onClick={() => onSaveFullOutfit(item)}
                disabled={item.savingFull}
                style={{
                  background: "var(--ink)",
                  color: "var(--cream)",
                  border: "none",
                  padding: "14px 18px",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontFamily: "DM Sans, sans-serif",
                  cursor: item.savingFull ? "not-allowed" : "pointer",
                  opacity: item.savingFull ? 0.6 : 1,
                  textAlign: "left",
                }}
              >
                {item.savingFull ? "Saving…" : "✦ Save as Full Outfit"}
                <div
                  style={{
                    fontSize: 10,
                    opacity: 0.55,
                    marginTop: 3,
                    letterSpacing: "0.03em",
                    textTransform: "none",
                  }}
                >
                  One wardrobe item · original photo · no crop
                </div>
              </button>
              <button
                onClick={() => onSetIntent(item.id, "individual")}
                style={{
                  background: "transparent",
                  color: "var(--ink)",
                  border: "1px solid var(--ink)",
                  padding: "14px 18px",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontFamily: "DM Sans, sans-serif",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                ▫ Save Individual Pieces
                <div
                  style={{
                    fontSize: 10,
                    opacity: 0.55,
                    marginTop: 3,
                    letterSpacing: "0.03em",
                    textTransform: "none",
                  }}
                >
                  Pick which pieces to save · each gets its own cropped image
                </div>
              </button>
            </Stack>
          )}

          {item.intent === "full_outfit" && (
            <Box
              sx={{
                fontSize: 11,
                color: "var(--gold)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              ✓ Full outfit saved to wardrobe
            </Box>
          )}
          {item.intent === "individual" && (
            <Box sx={{ fontSize: 12, color: "var(--taupe)" }}>
              Tap &quot;+ Save&quot; on the pieces you want below ⇓
            </Box>
          )}
        </Box>
      </Stack>

      {item.intent === "individual" && (item.pieces?.length ?? 0) > 0 && (
        <Box sx={{ borderTop: "1px solid var(--linen)" }}>
          <Box
            sx={{
              p: "14px 20px 10px",
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--taupe)",
            }}
          >
            Save only what you want — accessories are optional
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
              gap: "1px",
              background: "var(--linen)",
            }}
          >
            {item.pieces!.map((piece, idx) => {
              const pieceId = `${item.id}-piece-${idx}`;
              const isSaved = (item.savedPieceIds || []).includes(pieceId);
              const objPos =
                OBJ_POS[(piece.category || "").toLowerCase()] || "50% 40%";
              const previewSrc = item.piecePreviews?.[idx] || item.previewUrl;
              return (
                <Stack
                  key={idx}
                  sx={{ background: "var(--paper)", flexDirection: "column" }}
                >
                  <Box
                    sx={{
                      width: "100%",
                      aspectRatio: "1/1",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {previewSrc && (
                      <img
                        src={previewSrc}
                        alt=""
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: objPos,
                          filter: isSaved ? "brightness(0.6)" : "none",
                        }}
                      />
                    )}
                    {isSaved && (
                      <Stack
                        alignItems="center"
                        justifyContent="center"
                        sx={{
                          position: "absolute",
                          inset: 0,
                        }}
                      >
                        <Box
                          sx={{
                            background: "var(--gold)",
                            color: "var(--ink)",
                            fontSize: 9,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            p: "5px 12px",
                          }}
                        >
                          ✓ Saved
                        </Box>
                      </Stack>
                    )}
                  </Box>
                  <Stack
                    gap={0.5}
                    sx={{
                      p: "10px 12px",
                      flex: 1,
                    }}
                  >
                    <Box
                      sx={{
                        fontSize: 9,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--taupe)",
                      }}
                    >
                      {piece.category}
                    </Box>
                    <Box
                      sx={{
                        fontFamily: "Cormorant Garamond, serif",
                        fontSize: 14,
                        color: "var(--ink)",
                        lineHeight: 1.3,
                      }}
                    >
                      {piece.name}
                    </Box>
                    <Stack direction="row" gap={0.5} sx={{ flexWrap: "wrap" }}>
                      {[piece.colorName, piece.formality]
                        .filter(Boolean)
                        .map((t) => (
                          <span
                            key={String(t)}
                            className="analyzing-tag"
                            style={{ fontSize: 9 }}
                          >
                            {String(t)}
                          </span>
                        ))}
                    </Stack>
                    {!isSaved && (
                      <button
                        onClick={() => onSavePiece(item, piece, idx)}
                        style={{
                          marginTop: "auto",
                          background: "var(--ink)",
                          color: "var(--cream)",
                          border: "none",
                          padding: "7px 10px",
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          fontFamily: "DM Sans, sans-serif",
                          cursor: "pointer",
                          fontWeight: 500,
                          width: "100%",
                        }}
                      >
                        + Save this piece
                      </button>
                    )}
                  </Stack>
                </Stack>
              );
            })}
          </Box>

          {(item.pieces?.length ?? 0) >= 2 && !item.outfitSaved && (
            <Box sx={{ p: "12px 0 4px" }}>
              <button
                onClick={() => onSaveAsOutfit(item)}
                disabled={item.savingOutfit}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "var(--gold)",
                  border: "1px solid var(--gold)",
                  padding: "10px 18px",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontFamily: "DM Sans, sans-serif",
                  cursor: item.savingOutfit ? "not-allowed" : "pointer",
                  opacity: item.savingOutfit ? 0.6 : 1,
                }}
              >
                {item.savingOutfit ? "Saving outfit…" : "✦ Save all as outfit"}
              </button>
            </Box>
          )}
          {item.outfitSaved && (
            <Box
              sx={{
                p: "10px 0 4px",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "var(--gold)",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              ✓ Outfit saved
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
