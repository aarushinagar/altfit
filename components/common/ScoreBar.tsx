"use client";

import { useState, useEffect } from "react";

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
    <div className="score-item">
      <span className="score-label">{label}</span>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${width}%` }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--taupe)", minWidth: 28 }}>
        {value}%
      </span>
    </div>
  );
}
