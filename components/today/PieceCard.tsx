"use client";

import { Box } from "@mui/material";
import WardrobeImage from "@/components/common/WardrobeImage";

interface PieceItem {
  id: string | number;
  name: string;
  imageUrl?: string | null;
  previewUrl?: string | null;
  colors?: string[];
  color?: string;
  colorHex?: string | null;
  emoji?: string;
}

interface PieceCardProps {
  role: string;
  item: PieceItem;
}

export default function PieceCard({ role, item }: PieceCardProps) {
  return (
    <div className="outfit-piece">
      <Box
        className="piece-visual"
        sx={{
          background:
            item.imageUrl || item.previewUrl
              ? "#ede9e3"
              : `${item.colors?.[0] || item.color || item.colorHex || "#ccc"}22`,
          p: 0,
          overflow: "hidden",
        }}
      >
        {item.imageUrl || item.previewUrl ? (
          <WardrobeImage item={item} />
        ) : (
          <Box component="span" sx={{ fontSize: 32 }}>
            {item.emoji || "👗"}
          </Box>
        )}
      </Box>
      <div className="piece-label">{role}</div>
      <div className="piece-name">{item.name}</div>
    </div>
  );
}
