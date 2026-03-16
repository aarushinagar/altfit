"use client";

import { Box } from "@mui/material";
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
}

interface WardrobeItemCardProps {
  item: WardrobeItem;
  animDelay?: number;
  onClick: (item: WardrobeItem) => void;
}

export default function WardrobeItemCard({
  item,
  animDelay = 0,
  onClick,
}: WardrobeItemCardProps) {
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
            item.imageUrl || item.previewUrl
              ? "#f0ece6"
              : `${item.colors?.[0] || item.color || item.colorHex || "#ccc"}18`,
        }}
      >
        {item.imageUrl || item.previewUrl ? (
          <WardrobeImage
            item={item}
            style={{ position: "absolute", inset: 0 }}
          />
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
        <div className="item-type">{item.category || item.type}</div>
        <div className="item-name">{item.name}</div>
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
    </Box>
  );
}
