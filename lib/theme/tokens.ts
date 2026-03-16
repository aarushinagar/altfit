/**
 * Design Tokens — Single Source of Truth
 *
 * All visual decisions (colors, typography, spacing) live here.
 * Change a value here and it propagates to:
 *   - MUI theme (palette, typography, component overrides)
 *   - CSS custom properties (var(--ink), var(--gold), etc.)
 *   - Any TypeScript component that imports directly
 */

// ─── Color Palette ────────────────────────────────────────────────────────────

export const COLORS = {
  // Warm neutrals — backgrounds & surfaces
  cream: "#F7F3EC", // primary background
  paper: "#EFE9DE", // card / surface background
  linen: "#E2D9CC", // borders, dividers
  sand: "#D4C8B4", // landing page background
  dust: "#C4B8A4", // subtle decorative, scrollbar

  // Text hierarchy
  ink: "#2E2118", // primary text, dark buttons
  charcoal: "#4A3828", // body text, item names
  warmGray: "#8C7C6C", // secondary text, descriptions
  taupe: "#A89880", // labels, muted elements, disabled
  blush: "#D4B8A0", // decorative accents

  // Brand accent
  gold: "#A0622C", // primary accent, CTAs, active states
  goldLight: "#C07840", // accent hover

  // Semantic (keep minimal — derive from palette above where possible)
  error: "#c0392b",
  errorBg: "rgba(192,57,43,0.06)",
  errorBorder: "rgba(192,57,43,0.2)",
} as const;

export type ColorName = keyof typeof COLORS;

// ─── Typography ───────────────────────────────────────────────────────────────

export const FONTS = {
  serif: "'Cormorant Garamond', serif",
  sans: "'DM Sans', sans-serif",
} as const;

export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap";

// ─── Breakpoints ──────────────────────────────────────────────────────────────

export const BREAKPOINTS = {
  xs: 0,
  sm: 480, // wider mobile (e.g. 4-col outfit grid)
  md: 768, // desktop nav, 2-col layout, centered modals
  lg: 1200, // expanded padding
  xl: 1400, // max-width cap on hero sections
} as const;

// ─── CSS Variable Map ─────────────────────────────────────────────────────────
//
// Maps JS token names → the CSS custom property name used throughout the JSX.
// Changing a color in COLORS above and running the app is all that's needed —
// the CssVariablesInjector component (lib/theme/CssVariables.tsx) reads this
// map and injects them into :root automatically.

export const CSS_VAR_MAP: Record<string, string> = {
  "--cream": COLORS.cream,
  "--paper": COLORS.paper,
  "--linen": COLORS.linen,
  "--sand": COLORS.sand,
  "--taupe": COLORS.taupe,
  "--dust": COLORS.dust,
  "--warm-gray": COLORS.warmGray,
  "--charcoal": COLORS.charcoal,
  "--ink": COLORS.ink,
  "--gold": COLORS.gold,
  "--gold-light": COLORS.goldLight,
  "--blush": COLORS.blush,
};

// ─── Z-Index Scale ────────────────────────────────────────────────────────────

export const Z = {
  nav: 100,
  modal: 200,
  paywall: 300,
  toast: 300,
  dropdown: 150,
  overlay: 149,
} as const;
