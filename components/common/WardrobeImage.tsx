"use client";

import { useState, useEffect } from "react";

interface WardrobeItemLike {
  imageUrl?: string | null;
  previewUrl?: string | null;
  name?: string;
}

interface WardrobeImageProps {
  item: WardrobeItemLike;
  style?: React.CSSProperties;
}

export default function WardrobeImage({
  item,
  style = {},
}: WardrobeImageProps) {
  const src = item.imageUrl || item.previewUrl;
  if (!src) return null;
  return (
    <img
      src={src}
      alt={item.name || ""}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center top",
        display: "block",
        ...style,
      }}
    />
  );
}
