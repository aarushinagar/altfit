"use client";

import { useState } from "react";
import Image from "next/image";

interface WardrobeItemLike {
  imageUrl?: string | null;
  previewUrl?: string | null;
  name?: string;
}

interface WardrobeImageProps {
  item: WardrobeItemLike;
  style?: React.CSSProperties;
  /** Called when the image fails to load (404, network error, etc.) */
  onBroken?: () => void;
}

export default function WardrobeImage({
  item,
  style = {},
  onBroken,
}: WardrobeImageProps) {
  const [loaded, setLoaded] = useState(false);
  const src = item.imageUrl || item.previewUrl;
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={item.name || ""}
      fill
      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 20vw, 280px"
      style={{
        ...style,
        objectFit: "cover",
        objectPosition: "center",
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
      onLoad={() => setLoaded(true)}
      onError={onBroken}
    />
  );
}
