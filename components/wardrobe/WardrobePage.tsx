"use client";

import { useState } from "react";
import { Box } from "@mui/material";
import FilterBar from "@/components/wardrobe/FilterBar";
import WardrobeGrid from "@/components/wardrobe/WardrobeGrid";
import WardrobeItemModal from "@/components/wardrobe/WardrobeItemModal";
import { inferCategory } from "@/lib/utils/clothing";
import type { WardrobeItem } from "@/components/wardrobe/WardrobeItemCard";

interface WardrobePageProps {
  savedItems: WardrobeItem[];
  isLoading: boolean;
  onRemoveItem: (id: string | number) => void;
  onFilterChange?: (category?: string) => void;
}

export default function WardrobePage({
  savedItems,
  isLoading,
  onRemoveItem,
  onFilterChange,
}: WardrobePageProps) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);

  const filtered = savedItems.filter((item) => {
    if (activeFilter === "All") return true;
    const cat = inferCategory(item);
    return cat === activeFilter.toLowerCase();
  });

  const handleFilterChange = (cat: string) => {
    setActiveFilter(cat);
    onFilterChange?.(cat === "All" ? undefined : cat.toLowerCase());
  };

  return (
    <Box className="wardrobe-page page">
      <div className="page-header fade-up">
        <p className="page-eyebrow">Your Collection</p>
        <h1 className="page-title">Wardrobe</h1>
        <p className="page-count">
          {savedItems.length} piece{savedItems.length !== 1 ? "s" : ""}
        </p>
      </div>

      <FilterBar activeFilter={activeFilter} onChange={handleFilterChange} />

      <WardrobeGrid
        items={filtered}
        isLoading={isLoading}
        onItemClick={setSelectedItem}
      />

      {selectedItem && (
        <WardrobeItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRemove={(id) => {
            onRemoveItem(id);
            setSelectedItem(null);
          }}
        />
      )}
    </Box>
  );
}
