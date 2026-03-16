"use client";

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
      <div
        style={{
          marginBottom: 24,
          border: "1px solid var(--gold)",
          background: "var(--paper)",
          padding: "24px 28px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 28 }}>📸</div>
          <div>
            <div
              style={{
                fontFamily: "Cormorant Garamond, serif",
                fontSize: 18,
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              iPhone HEIC photo — needs conversion
            </div>
            <div style={{ fontSize: 12, color: "var(--taupe)" }}>
              <strong>{item.fileName}</strong> — convert then re-upload.
            </div>
          </div>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
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
          <div
            style={{
              padding: "12px",
              background: "var(--linen)",
              fontSize: 11,
              color: "var(--charcoal)",
              lineHeight: 1.5,
            }}
          >
            Permanent fix: iPhone Settings → Camera → Formats →{" "}
            <strong>Most Compatible</strong>
          </div>
        </div>
      </div>
    );
  }

  if (item.status === "reading" || item.status === "analyzing") {
    return (
      <div
        style={{
          marginBottom: 24,
          border: "1px solid var(--linen)",
          background: "var(--paper)",
          display: "flex",
        }}
      >
        <div
          style={{
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
        </div>
        <div style={{ flex: 1, padding: "20px 24px" }}>
          <div
            style={{ fontSize: 12, color: "var(--taupe)", marginBottom: 10 }}
          >
            {item.status === "reading"
              ? "Preparing image..."
              : `Identifying garments... ${Math.round(item.progress ?? 0)}%`}
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${item.progress ?? 0}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (item.status === "error") {
    return (
      <div
        style={{
          marginBottom: 24,
          border: "1px solid #ecc",
          background: "var(--paper)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            padding: "20px 24px",
          }}
        >
          <div style={{ fontSize: 28, flexShrink: 0 }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#c0392b",
                marginBottom: 6,
              }}
            >
              Analysis failed
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#a93226",
                wordBreak: "break-word",
                marginBottom: 12,
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
            </div>
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
          </div>
        </div>
      </div>
    );
  }

  if (item.status !== "ready") return null;

  return (
    <div
      style={{
        marginBottom: 32,
        border: "1px solid var(--linen)",
        background: "var(--paper)",
      }}
    >
      <div style={{ display: "flex" }}>
        <div
          style={{
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
        </div>
        <div
          style={{
            flex: 1,
            padding: "24px 28px",
            borderLeft: "1px solid var(--linen)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 8,
            }}
          >
            {`✦ ${item.pieces?.length || 0} piece${(item.pieces?.length || 0) !== 1 ? "s" : ""} detected`}
          </div>
          <div
            style={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: 21,
              fontWeight: 300,
              color: "var(--ink)",
              marginBottom: 6,
              lineHeight: 1.3,
            }}
          >
            {item.pieces?.map((p) => p.name).join(", ")}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--taupe)",
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            How would you like to save this?
          </div>

          {!item.intent && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            </div>
          )}

          {item.intent === "full_outfit" && (
            <div
              style={{
                fontSize: 11,
                color: "var(--gold)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              ✓ Full outfit saved to wardrobe
            </div>
          )}
          {item.intent === "individual" && (
            <div style={{ fontSize: 12, color: "var(--taupe)" }}>
              Tap &quot;+ Save&quot; on the pieces you want below ↓
            </div>
          )}
        </div>
      </div>

      {item.intent === "individual" && (item.pieces?.length ?? 0) > 0 && (
        <div style={{ borderTop: "1px solid var(--linen)" }}>
          <div
            style={{
              padding: "14px 20px 10px",
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--taupe)",
            }}
          >
            Save only what you want — accessories are optional
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
              gap: 1,
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
                <div
                  key={idx}
                  style={{
                    background: "var(--paper)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
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
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            background: "var(--gold)",
                            color: "var(--ink)",
                            fontSize: 9,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            padding: "5px 12px",
                          }}
                        >
                          ✓ Saved
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "10px 12px",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--taupe)",
                      }}
                    >
                      {piece.category}
                    </div>
                    <div
                      style={{
                        fontFamily: "Cormorant Garamond, serif",
                        fontSize: 14,
                        color: "var(--ink)",
                        lineHeight: 1.3,
                      }}
                    >
                      {piece.name}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
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
                    </div>
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
                  </div>
                </div>
              );
            })}
          </div>

          {(item.pieces?.length ?? 0) >= 2 && !item.outfitSaved && (
            <div style={{ padding: "12px 0 4px" }}>
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
            </div>
          )}
          {item.outfitSaved && (
            <div
              style={{
                padding: "10px 0 4px",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "var(--gold)",
                textAlign: "center",
                textTransform: "uppercase",
              }}
            >
              ✓ Outfit saved
            </div>
          )}
        </div>
      )}
    </div>
  );
}
