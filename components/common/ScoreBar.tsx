"use client";

import { useState, useEffect } from "react";
import { Stack, Box } from "@mui/material";

interface ScoreBarProps {
  label: string;
  value: number;
}

export default function ScoreBar({ label, value }: ScoreBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 300);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <Stack direction="row" alignItems="center" className="score-item">
      <Box component="span" className="score-label">
        {label}
      </Box>
      <Box className="score-track">
        <Box className="score-fill" sx={{ width: `${width}%` }} />
      </Box>
      <Box
        component="span"
        sx={{ fontSize: 10, color: "var(--taupe)", minWidth: 28 }}
      >
        {value}%
      </Box>
    </Stack>
  );
}
