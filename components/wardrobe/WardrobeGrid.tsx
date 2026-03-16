"use client";

import WardrobeItemCard, {
  WardrobeItem,
} from "@/components/wardrobe/WardrobeItemCard";

interface WardrobeGridProps {
  items: WardrobeItem[];
  isLoading: boolean;
  onItemClick: (item: WardrobeItem) => void;
}

export default function WardrobeGrid({
  items,
  isLoading,
  onItemClick,
}: WardrobeGridProps) {
  if (isLoading) {
    return (
      <div className="wardrobe-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="wardrobe-item"
            style={{ opacity: 0.35, pointerEvents: "none" }}
          >
            <div
              className="item-image"
              style={{
                background: "var(--linen)",
                animation: "pulse 1.4s ease-in-out infinite",
              }}
            />
            <div className="item-info">
              <div
                style={{
                  height: 10,
                  width: "60%",
                  background: "var(--linen)",
                  borderRadius: 4,
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "80%",
                  background: "var(--linen)",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>👗</div>
        <div
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: 24,
            fontWeight: 300,
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          Your wardrobe is empty.
        </div>
        <div style={{ fontSize: 12, color: "var(--taupe)", marginBottom: 24 }}>
          Add your first piece to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="wardrobe-grid">
      {items.map((item, i) => (
        <WardrobeItemCard
          key={item.id}
          item={item}
          animDelay={i * 0.04}
          onClick={onItemClick}
        />
      ))}
    </div>
  );
}
