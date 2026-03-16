"use client";

import { Stack } from "@mui/material";
import { CATEGORIES } from "@/lib/constants";

interface FilterBarProps {
  activeFilter: string;
  onChange: (filter: string) => void;
}

export default function FilterBar({ activeFilter, onChange }: FilterBarProps) {
  return (
    <Stack direction="row" className="filter-bar">
      <span className="filter-label">Filter</span>
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          className={`filter-chip ${activeFilter === cat ? "active" : ""}`}
          onClick={() => onChange(cat)}
        >
          {cat}
        </button>
      ))}
    </Stack>
  );
}
