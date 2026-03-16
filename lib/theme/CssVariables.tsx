"use client";

/**
 * CssVariables — injects CSS custom properties from design tokens into :root
 *
 * This bridges the MUI theme (JS values) with any code that uses
 * CSS variables directly (e.g. `color: 'var(--ink)'` in inline styles or
 * legacy className-based CSS strings still in page.jsx).
 *
 * Source of truth: lib/theme/tokens.ts → CSS_VAR_MAP
 * To rename or change a color: edit tokens.ts only.
 */

import { GlobalStyles } from "@mui/material";
import { CSS_VAR_MAP } from "./tokens";

// ─── Keyframe animations ──────────────────────────────────────────────────────
// Defined here (not in globals.css) so they live alongside the theme system.

const keyframes = {
  "@keyframes fadeUp": {
    from: { opacity: 0, transform: "translateY(16px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
  "@keyframes fadeIn": {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  "@keyframes spin": {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
  },
};

// ─── Utility animation classes ────────────────────────────────────────────────

const animationClasses = {
  ".fade-up": { animation: "fadeUp 0.5s ease forwards" },
  ".fade-in": { animation: "fadeIn 0.4s ease forwards" },
};

// ─── App shell class ──────────────────────────────────────────────────────────

const appShell = {
  ".app": { minHeight: "100vh", background: "var(--cream)" },
};

export default function CssVariables() {
  return (
    <GlobalStyles
      styles={{
        ":root": CSS_VAR_MAP,
        ...keyframes,
        ...animationClasses,
        ...appShell,
      }}
    />
  );
}
