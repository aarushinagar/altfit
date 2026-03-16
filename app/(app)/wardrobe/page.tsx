"use client";

import { useAppContext } from "@/lib/contexts/AppContext";
import WardrobePage from "@/components/wardrobe/WardrobePage";
import type { WardrobeItem } from "@/components/wardrobe/WardrobeItemCard";

export default function WardrobeRoute() {
  const { savedItems, wardrobeLoading, handleRemoveItem, loadWardrobeItems } =
    useAppContext();

  return (
    <WardrobePage
      savedItems={savedItems as WardrobeItem[]}
      isLoading={wardrobeLoading}
      onRemoveItem={handleRemoveItem}
      onFilterChange={(category) => loadWardrobeItems(category)}
    />
  );
}
