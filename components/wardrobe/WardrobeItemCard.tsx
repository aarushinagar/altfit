"use client";

import { useState, useRef } from "react";
import { Box, CircularProgress } from "@mui/material";
import WardrobeImage from "@/components/common/WardrobeImage";

export interface WardrobeItem {
  id: string | number;
  name: string;
  category?: string;
  type?: string;
  imageUrl?: string | null;
  previewUrl?: string | null;
  colors?: string[];
  color?: string;
  colorHex?: string | null;
  colorName?: string;
  colorNames?: string[];
  formality?: string;
  emoji?: string;
  note?: string;
  pattern?: string;
  fit?: string;
  season?: string;
  wearCount?: number;
  analysisStatus?: string;
}

interface WardrobeItemCardProps {
  item: WardrobeItem;
  animDelay?: number;
  onClick: (item: WardrobeItem) => void;
  /** Called with the selected File when user picks a replacement photo */
  onReupload?: (id: string | number, file: File) => void;
  /** Called once when this item's image fails to load (broken/missing URL) */
  onImageBroken?: () => void;
  /** True while this card's image is being uploaded */
  isReuploading?: boolean;
}

export default function WardrobeItemCard({
  item,
  animDelay = 0,
  onClick,
  onReupload,
  onImageBroken,
  isReuploading = false,
}: WardrobeItemCardProps) {
  const [imageBroken, setImageBroken] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasImage = !!(item.imageUrl || item.previewUrl);
  const isAnalyzing = item.name === 'Analyzing…' || (!item.name?.trim() && item.analysisStatus === 'pending');

  const handleAddPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onReupload) {
      onReupload(item.id, file);
      // Reset so same file can be re-selected if needed
      e.target.value = "";
    }
  };

  const showAddPhoto = (!hasImage || imageBroken) && !!onReupload;

  return (
    <Box
      className="wardrobe-item"
      sx={{ animationDelay: `${animDelay}s` }}
      onClick={() => onClick(item)}
    >
      <Box
        className="item-image"
        sx={{
          background:
            hasImage && !imageBroken
              ? "#f0ece6"
              : `${item.colors?.[0] || item.color || item.colorHex || "#ccc"}18`,
        }}
      >
        {/* Analyzing shimmer overlay */}
        {isAnalyzing && (
          <Box
            sx={{
              position: 'absolute', inset: 0, zIndex: 3,
              background: 'linear-gradient(90deg, var(--linen) 25%, rgba(210,200,188,0.6) 50%, var(--linen) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmerMove 1.5s ease-in-out infinite',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              paddingBottom: '8px',
            }}
          >
            <Box sx={{
              fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--taupe)', fontWeight: 600, opacity: 0.85,
            }}>
              Identifying…
            </Box>
          </Box>
        )}

        {hasImage && !imageBroken ? (
          <WardrobeImage
            item={item}
            style={{ position: "absolute", inset: 0 }}
            onBroken={() => {
              setImageBroken(true);
              onImageBroken?.();
            }}
          />
        ) : showAddPhoto ? (
          /* Missing / broken image — clean add-photo prompt */
          <Box
            sx={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 1,
              background: "var(--linen)",
              cursor: isReuploading ? "default" : "pointer",
              border: "1.5px dashed var(--sand)",
              transition: "border-color 0.2s, background 0.2s",
              "&:hover": isReuploading ? {} : {
                borderColor: "var(--sage)",
                background: "#f6f3ee",
              },
            }}
            onClick={isReuploading ? undefined : handleAddPhoto}
          >
            {isReuploading ? (
              <CircularProgress size={18} sx={{ color: "var(--sage)" }} />
            ) : (
              <>
                {/* Camera icon */}
                <Box
                  component="svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  sx={{ width: 22, height: 22, color: "var(--sand)" }}
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </Box>
                <Box sx={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--taupe)", fontWeight: 500 }}>
                  Add Photo
                </Box>
              </>
            )}
          </Box>
        ) : (
          <Box
            component="span"
            sx={{ fontSize: 44, position: "relative", zIndex: 1 }}
          >
            {item.emoji || "👗"}
          </Box>
        )}
      </Box>
      <div className="item-info">
        <div className="item-type">{isAnalyzing ? '—' : (item.category || item.type)}</div>
        <div className="item-name" style={isAnalyzing ? { opacity: 0.4 } : undefined}>{item.name}</div>
        <div className="item-meta">
          <span className="item-tag">
            {item.colorNames?.[0] || item.colorName}
          </span>
          <span className="item-tag">{item.formality}</span>
        </div>
      </div>
      <div className="item-overlay">
        <span className="item-overlay-text">View Details</span>
      </div>

      {/* Hidden file input for re-upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </Box>
  );
}
