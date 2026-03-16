/**
 * MUI Theme
 *
 * Builds the Material UI theme entirely from design tokens (lib/theme/tokens.ts).
 * Every palette value, font, breakpoint, and component override references
 * the tokens — never a hard-coded hex string.
 *
 * To change the brand's primary color: update COLORS.ink in tokens.ts.
 * To change the accent gold: update COLORS.gold in tokens.ts.
 * Everything downstream — MUI sx props, styled() calls, component overrides —
 * picks up the change automatically.
 */

import { createTheme } from "@mui/material/styles";
import { COLORS, FONTS, BREAKPOINTS } from "./tokens";

// ─── Extend MUI Palette TypeScript types ─────────────────────────────────────
// Allows theme.palette.gold, theme.palette.ink, etc.

declare module "@mui/material/styles" {
  interface Palette {
    cream: string;
    paper: string;
    linen: string;
    sand: string;
    taupe: string;
    dust: string;
    warmGray: string;
    charcoal: string;
    ink: string;
    gold: string;
    goldLight: string;
    blush: string;
  }
  interface PaletteOptions {
    cream?: string;
    paper?: string;
    linen?: string;
    sand?: string;
    taupe?: string;
    dust?: string;
    warmGray?: string;
    charcoal?: string;
    ink?: string;
    gold?: string;
    goldLight?: string;
    blush?: string;
  }
}

// ─── Theme Definition ─────────────────────────────────────────────────────────

const theme = createTheme({
  // ── Palette ──
  palette: {
    mode: "light",

    background: {
      default: COLORS.cream,
      paper: COLORS.paper,
    },

    // MUI standard slots → mapped to our ink / gold tokens
    primary: {
      main: COLORS.ink,
      light: COLORS.charcoal,
      dark: COLORS.ink,
      contrastText: COLORS.cream,
    },
    secondary: {
      main: COLORS.gold,
      light: COLORS.goldLight,
      dark: COLORS.gold,
      contrastText: COLORS.cream,
    },
    error: {
      main: COLORS.error,
    },

    text: {
      primary: COLORS.charcoal,
      secondary: COLORS.warmGray,
      disabled: COLORS.taupe,
    },
    divider: COLORS.linen,

    // Brand-specific tokens exposed on the palette for direct use in sx props:
    // sx={{ color: 'gold' }} or theme.palette.gold
    cream: COLORS.cream,
    paper: COLORS.paper,
    linen: COLORS.linen,
    sand: COLORS.sand,
    taupe: COLORS.taupe,
    dust: COLORS.dust,
    warmGray: COLORS.warmGray,
    charcoal: COLORS.charcoal,
    ink: COLORS.ink,
    gold: COLORS.gold,
    goldLight: COLORS.goldLight,
    blush: COLORS.blush,
  },

  // ── Typography ──
  typography: {
    fontFamily: FONTS.sans,

    // All heading variants use the editorial serif
    h1: { fontFamily: FONTS.serif, fontWeight: 300, lineHeight: 1.1 },
    h2: { fontFamily: FONTS.serif, fontWeight: 300, lineHeight: 1.15 },
    h3: { fontFamily: FONTS.serif, fontWeight: 300, lineHeight: 1.2 },
    h4: { fontFamily: FONTS.serif, fontWeight: 300, lineHeight: 1.25 },
    h5: { fontFamily: FONTS.serif, fontWeight: 300, lineHeight: 1.3 },
    h6: { fontFamily: FONTS.serif, fontWeight: 300, lineHeight: 1.3 },

    body1: { fontFamily: FONTS.sans, fontWeight: 400 },
    body2: { fontFamily: FONTS.sans, fontWeight: 300 },

    button: {
      fontFamily: FONTS.sans,
      fontWeight: 500,
      fontSize: 11,
      letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
    },

    caption: {
      fontFamily: FONTS.sans,
      fontSize: 10,
      letterSpacing: "0.14em",
      textTransform: "uppercase" as const,
      color: COLORS.taupe,
    },

    overline: {
      fontFamily: FONTS.sans,
      fontSize: 9,
      letterSpacing: "0.18em",
      textTransform: "uppercase" as const,
      color: COLORS.taupe,
    },
  },

  // ── Breakpoints ──
  breakpoints: {
    values: BREAKPOINTS,
  },

  // ── Shape ──
  shape: {
    borderRadius: 0, // The design is sharp/square — no rounded corners
  },

  // ── Shadows ──
  // Remove all default MUI elevation shadows — design uses borders instead
  shadows: [
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
    "none",
  ],

  // ── Component Overrides ──
  components: {
    // Disable ripple globally — this design uses simple CSS transitions
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
    },

    // Contained (primary) button → ink background, cream text
    // Outlined button            → linen border, charcoal text
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: "none",
          fontFamily: FONTS.sans,
          letterSpacing: "0.12em",
          "&:hover": { boxShadow: "none" },
        },
        containedPrimary: {
          background: COLORS.ink,
          color: COLORS.cream,
          "&:hover": { background: COLORS.charcoal },
          "&.Mui-disabled": {
            background: COLORS.linen,
            color: COLORS.taupe,
          },
        },
        containedSecondary: {
          background: COLORS.gold,
          color: COLORS.ink,
          "&:hover": { background: COLORS.goldLight },
        },
        outlinedPrimary: {
          border: `1px solid ${COLORS.linen}`,
          color: COLORS.charcoal,
          "&:hover": { borderColor: COLORS.taupe, background: "transparent" },
        },
        text: {
          color: COLORS.warmGray,
          letterSpacing: "0.1em",
          "&:hover": { background: "transparent", color: COLORS.ink },
        },
      },
    },

    // Paper — flat, no shadow, cream background
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundImage: "none",
          background: COLORS.paper,
        },
      },
    },

    // Dialog — centered modal on desktop, bottom sheet on mobile
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          backgroundImage: "none",
          background: COLORS.cream,
          margin: 16,
        },
      },
    },

    // Chip — square corners, linen border
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontFamily: FONTS.sans,
          fontSize: 10,
          letterSpacing: "0.08em",
          height: "auto",
          padding: "3px 0",
        },
        label: { padding: "0 10px" },
      },
    },

    // Input — matches the auth form inputs
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: FONTS.sans,
          fontSize: 13,
          color: COLORS.charcoal,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          background: COLORS.paper,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: COLORS.linen,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: COLORS.taupe,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: COLORS.gold,
            borderWidth: 1,
          },
        },
      },
    },

    // CssBaseline — replaces globals.css reset
    MuiCssBaseline: {
      styleOverrides: {
        "*, *::before, *::after": {
          margin: 0,
          padding: 0,
          boxSizing: "border-box",
          WebkitTapHighlightColor: "transparent",
        },
        html: {
          WebkitTextSizeAdjust: "100%",
        },
        body: {
          background: COLORS.cream,
          fontFamily: FONTS.sans,
          color: COLORS.charcoal,
          overscrollBehavior: "none",
          "-webkit-font-smoothing": "antialiased",
        },
        "input, button, select, textarea": {
          WebkitAppearance: "none",
          fontFamily: "inherit",
        },
        a: {
          color: "inherit",
          textDecoration: "none",
        },
        // Custom scrollbar styling
        "::-webkit-scrollbar": { width: 4 },
        "::-webkit-scrollbar-track": { background: COLORS.cream },
        "::-webkit-scrollbar-thumb": { background: COLORS.dust },
      },
    },
  },
});

export default theme;
