/**
 * Theme barrel export
 *
 * Import from here rather than deep-linking into individual files:
 *   import { theme, COLORS, FONTS, Z } from '@/lib/theme';
 */

export { default as theme } from "./muiTheme";
export { default as ThemeRegistry } from "./ThemeRegistry";
export { default as CssVariables } from "./CssVariables";
export {
  COLORS,
  FONTS,
  BREAKPOINTS,
  CSS_VAR_MAP,
  GOOGLE_FONTS_URL,
  Z,
} from "./tokens";
export type { ColorName } from "./tokens";
