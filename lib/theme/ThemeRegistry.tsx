"use client";

/**
 * ThemeRegistry — client-side wrapper for MUI theme providers.
 *
 * Must be a Client Component because ThemeProvider holds theme state.
 * By keeping the theme import here (not in layout.tsx), Next.js never tries
 * to serialize the theme object (which contains functions) across the
 * Server → Client boundary.
 */

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./muiTheme";
import CssVariables from "./CssVariables";

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      {/* MUI CSS reset (box-sizing, body margin, etc.) */}
      <CssBaseline />
      {/* CSS custom properties (var(--ink), var(--gold), …) from tokens */}
      <CssVariables />
      {children}
    </ThemeProvider>
  );
}
