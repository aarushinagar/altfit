/* eslint-disable @next/next/no-img-element */
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
  status: "heic" | "reading" | "analyzing" | "queued" | "cropping" | "error" | "ready";
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
  /** Number of pieces being cropped (set during "cropping" status) */
  cropCount?: number;
  /** How many pieces have been cropped + uploaded so far */
  cropDone?: number;
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
  // "heic" status is kept in the type for backwards compat but the backend now converts HEIC.
  // Treat it as queued with a "Processing…" placeholder.
  if (item.status === "heic") {
    return (
      <div className="upload-item-card upload-item-queued">
        <div className="upload-item-thumb upload-item-thumb-skeleton" />
        <div className="upload-item-info">
          <span className="upload-item-label upload-item-label-dim">Converting…</span>
          <span className="upload-item-name">{item.fileName ?? "Photo"}</span>
        </div>
      </div>
    );
  }

  if (item.status === "queued") {
    return (
      <div className="upload-item-card upload-item-queued">
        <div className="upload-item-thumb">
          {item.previewUrl
            ? <img src={item.previewUrl} alt="" className="upload-item-thumb-img" />
            : <div className="upload-item-thumb-skeleton" />
          }
        </div>
        <div className="upload-item-info">
          <span className="upload-item-label upload-item-label-dim">In queue</span>
          <span className="upload-item-name">{item.fileName?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") ?? "Photo"}</span>
        </div>
      </div>
    );
  }

  if (item.status === "reading" || item.status === "analyzing") {
    return (
      <div className="upload-item-card upload-item-analyzing">
        {/* Image with scan-line overlay */}
        <div className="upload-item-thumb upload-item-thumb-scanning">
          {item.previewUrl
            ? <img src={item.previewUrl} alt="" className="upload-item-thumb-img" />
            : <div className="upload-item-thumb-skeleton" />
          }
          <div className="upload-scan-overlay">
            <div className="upload-scan-line" />
          </div>
        </div>
        <div className="upload-item-info">
          <span className="upload-item-label upload-item-label-gold">
            {item.status === "reading" ? "Preparing…" : "Identifying your pieces…"}
          </span>
          <span className="upload-item-name" style={{ opacity: 0.5 }}>
            {item.fileName?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") ?? "Photo"}
          </span>
          <div className="upload-progress-bar" style={{ marginTop: 10 }}>
            <div className="upload-progress-fill" style={{ width: `${item.progress ?? 0}%` }} />
          </div>
        </div>
      </div>
    );
  }

  if (item.status === "cropping") {
    const total = item.cropCount ?? 1;
    const done = item.cropDone ?? 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
      <div className="upload-item-card upload-item-analyzing">
        <div className="upload-item-thumb upload-item-thumb-scanning">
          {item.previewUrl
            ? <img src={item.previewUrl} alt="" className="upload-item-thumb-img" style={{ opacity: 0.8 }} />
            : <div className="upload-item-thumb-skeleton" />
          }
          <div className="upload-scan-overlay">
            <div className="upload-scan-line" />
          </div>
        </div>
        <div className="upload-item-info">
          <span className="upload-item-label upload-item-label-gold">Cropping {total === 1 ? "1 piece" : `${total} pieces`}…</span>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 32,
                  height: 32,
                  background: done > i ? "var(--gold)" : "var(--linen)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  transition: "background 0.3s ease",
                  animation: done > i ? "none" : "pulse 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.18}s`,
                }}
              >
                {done > i && <span style={{ color: "var(--cream)", fontSize: 12 }}>✓</span>}
              </div>
            ))}
          </div>
          <div className="upload-progress-bar" style={{ marginTop: 10 }}>
            <div className="upload-progress-fill" style={{ width: `${pct}%`, transition: "width 0.3s ease" }} />
          </div>
        </div>
      </div>
    );
  }
  if (item.status === "error") {
    const errorMsg = item.error?.includes("Rate limit")
      ? "Too many requests — wait a moment and try again."
      : item.error?.includes("No clothing items")
        ? "No clothing detected. Try a clearer photo facing the camera."
        : item.error?.includes("No valid JSON") || item.error?.includes("parse")
          ? "Couldn't read the image. Try a well-lit photo with clear contrast."
          : item.error?.includes("Invalid image")
            ? "Format not supported. Use JPG, PNG, HEIC, or WebP."
            : "Something went wrong. Please try again.";

    return (
      <div className="upload-item-card upload-item-error" style={{ animation: "uploadFadeIn 0.35s ease forwards" }}>
        <div className="upload-item-error-icon">✕</div>
        <div className="upload-item-info">
          <span className="upload-item-label" style={{ color: "var(--error)" }}>Couldn't save</span>
          <span className="upload-item-name" style={{ color: "var(--charcoal)", fontSize: 12, opacity: 0.8 }}>{errorMsg}</span>
          <button className="upload-remove-btn" onClick={() => onRemove(item.id)}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (item.status !== "ready") return null;

  // Success state — clean confirmation with fade-in
  return (
    <div className="upload-item-card upload-item-success" style={{ animation: "uploadFadeIn 0.4s ease forwards" }}>
      <div className="upload-item-thumb">
        {item.previewUrl
          ? <img src={item.previewUrl} alt="" className="upload-item-thumb-img" />
          : <div className="upload-item-thumb-skeleton" style={{ background: "var(--linen)" }} />
        }
        {/* Success checkmark overlay */}
        <div className="upload-success-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <div className="upload-item-info">
        <span className="upload-item-label upload-item-label-gold">Added to wardrobe</span>
        <span
          className="upload-item-name"
          style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 18, fontWeight: 300, lineHeight: 1.3 }}
        >
          {item.fileName?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") || "Clothing item"}
        </span>
        <span style={{ fontSize: 11, color: "var(--taupe)", marginTop: 4, display: "block" }}>
          AI-analysed and saved
        </span>
      </div>
    </div>
  );
}
