"use client";

import { Box, Stack } from "@mui/material";
import WardrobeItemCard, {
  WardrobeItem,
} from "@/components/wardrobe/WardrobeItemCard";

interface WardrobeGridProps {
  items: WardrobeItem[];
  isLoading: boolean;
  onItemClick: (item: WardrobeItem) => void;
  onReupload?: (id: string | number, file: File) => void;
  /** Fired once per card whose image fails to load */
  onImageBroken?: () => void;
  /** ID of the item currently being reuploaded (shows spinner on that card) */
  reuploadingId?: string | number | null;
  /** Hint for skeleton count on initial load */
  skeletonCount?: number;
}

export default function WardrobeGrid({
  items,
  isLoading,
  onItemClick,
  onReupload,
  onImageBroken,
  reuploadingId,
  skeletonCount = 10,
}: WardrobeGridProps) {
  if (isLoading) {
    return (
      <Box className="wardrobe-grid">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Box
            key={i}
            className="wardrobe-item"
            sx={{ opacity: 0.35, pointerEvents: "none" }}
          >
            <Box
              className="item-image"
              sx={{
                background: "var(--linen)",
                animation: "pulse 1.4s ease-in-out infinite",
              }}
            />
            <Box className="item-info">
              <Box
                sx={{
                  height: 10,
                  width: "60%",
                  background: "var(--linen)",
                  borderRadius: 0.5,
                  mb: 0.75,
                }}
              />
              <Box
                sx={{
                  height: 12,
                  width: "80%",
                  background: "var(--linen)",
                  borderRadius: 0.5,
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Stack alignItems="center" sx={{ textAlign: "center", py: 7.5, px: 2.5 }}>
        <Box component="span" sx={{ fontSize: 40, mb: 2 }}>
          👗
        </Box>
        <Box
          sx={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: 24,
            fontWeight: 300,
            color: "var(--ink)",
            mb: 1,
          }}
        >
          Your wardrobe is empty.
        </Box>
        <Box sx={{ fontSize: 12, color: "var(--taupe)", mb: 3 }}>
          Add your first piece to get started.
        </Box>
      </Stack>
    );
  }

  return (
    <Box className="wardrobe-grid">
      {items.map((item, i) => (
        <WardrobeItemCard
          key={item.id}
          item={item}
          animDelay={Math.min(i * 0.04, 0.2)}
          onClick={onItemClick}
          onReupload={onReupload}
          onImageBroken={onImageBroken}
          isReuploading={reuploadingId !== undefined && reuploadingId !== null && reuploadingId === item.id}
        />
      ))}
    </Box>
  );
}
