/* eslint-disable @next/next/no-img-element */
"use client";

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
  const src = item.imageUrl || item.previewUrl;
  if (!src) return null;
  return (
    <img
      src={src}
      alt={item.name || ""}
      onError={onBroken}
      loading="lazy"
      decoding="async"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center center",
        display: "block",
        ...style,
      }}
    />
  );
}
