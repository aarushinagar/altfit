# ALT FIT Frontend Refactoring Plan

## Overview

Refactor the entire frontend from a monolithic ~5000-line `page.jsx` into a modular,
well-organised component architecture. Replace Tailwind CSS with Material UI (heavily
themed to preserve the exact luxury editorial design). All styling, fonts, colors,
animations, and responsive layouts must remain pixel-identical.

---

## Current State

| File                           | Lines  | Problem                                                                                    |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| `app/page.jsx`                 | ~5 000 | Everything in one file: styles, utils, 10+ page-level components, Auth, Landing, App shell |
| `app/globals.css`              | ~18    | Tailwind `@import tailwindcss` only                                                        |
| `app/layout.tsx`               | ~26    | Uses Geist font + `antialiased` Tailwind class                                             |
| `lib/hooks/*.ts`               | OK     | Already extracted                                                                          |
| `lib/contexts/AuthContext.tsx` | OK     | Already extracted                                                                          |
| `lib/api-client.ts`            | OK     | Already extracted                                                                          |

### All Components Currently in `page.jsx`

- `Paywall` — subscription upgrade modal
- `WardrobeImage` — image renderer for wardrobe items
- `ScoreBar` — animated style score bar
- `PieceCard` — outfit piece card
- `TodayPage` — AI outfit of the day
- `WardrobePage` — full wardrobe grid + modal
- `UploadPage` — drag-and-drop upload + AI analysis
- `Onboarding` — 2-step style questionnaire
- `Landing` — public marketing page
- `Auth` — sign-in / register screen
- `App` (default export) — root router/shell

### Utilities Currently Embedded in `page.jsx`

- `inferCategory(item)` — keyword → clothing category
- `logToConsole(context, level, msg, data)` — styled console logger
- `classifyClothingWithAI(base64, mediaType)` — calls `/api/wardrobe/classify`
- `detectRealType(file)` — reads file magic bytes
- `isHeicFile(file)` — HEIC filename check
- `prepareImage(file)` — resize + convert to JPEG
- `cropImageForCategory(dataUrl, category)` — category-aware crop
- `decodeJwt(token)` — manual JWT payload decode
- `loadGisScript()` — load Google Identity Services
- `getHourGreeting()` — time-based greeting string

### Constants Currently Embedded

- `FREE_LIMIT = 10`
- `GOOGLE_FONTS` — font import URL string
- `styles` — 400-line CSS string injected via `<style>`
- `CATEGORIES` — wardrobe filter categories
- `SHUFFLE_VIBES` — outfit shuffle prompts
- `STYLE_TAGS` — onboarding style aesthetic options
- `BODY_TYPES` — onboarding styling issues

---

## Design System (Must Be Preserved Exactly)

### Color Tokens

```
--cream:     #F7F3EC   (background)
--paper:     #EFE9DE   (card background)
--linen:     #E2D9CC   (borders)
--sand:      #D4C8B4   (landing background)
--taupe:     #A89880   (muted text, labels)
--dust:      #C4B8A4   (subtle elements)
--warm-gray: #8C7C6C   (secondary text)
--charcoal:  #4A3828   (text)
--ink:       #2E2118   (primary text, buttons)
--gold:      #A0622C   (accent, CTA)
--gold-light:#C07840   (hover gold)
--blush:     #D4B8A0   (decorative)
```

### Typography

- Serif display: **Cormorant Garamond** (300, 400, 500, 600; italic variants)
- Body/UI: **DM Sans** (300, 400, 500)
- Font loaded via Google Fonts URL

### Animations

- `fadeUp` — opacity 0→1 + translateY 16px→0, 0.5s ease
- `fadeIn` — opacity 0→1, 0.4s ease
- `spin` — rotate 0→360deg (used for loader)

### Responsive Breakpoints

- Mobile: `< 768px` — bottom tab bar, compact layout, full-width modals
- Tablet+: `≥ 768px` — desktop nav, 2-col grid, centered modal dialog

---

## Target Architecture

```
app/
  layout.tsx              — MUI ThemeProvider, font links, base CSS
  page.tsx                — Thin entry: renders <App /> only
  globals.css             — Base reset + CSS variables + keyframe animations

components/
  theme/
    theme.ts              — MUI createTheme() with full luxury palette override

  common/
    WardrobeImage.tsx     — Image component for wardrobe items
    ScoreBar.tsx          — Animated style score bar
    Toast.tsx             — Toast notification overlay
    Paywall.tsx           — Subscription upgrade modal

  layout/
    AppNav.tsx            — Desktop fixed navigation bar (≥768px)
    MobileTopBar.tsx      — Mobile fixed top bar (<768px)
    MobileTabBar.tsx      — Mobile bottom tab bar (<768px)

  auth/
    Landing.tsx           — Public marketing/home page
    Auth.tsx              — Sign in / register screen
    Onboarding.tsx        — 2-step onboarding questionnaire

  today/
    TodayPage.tsx         — Today's AI outfit page
    OutfitCard.tsx        — Full outfit display (pieces + reasoning + actions)
    PieceCard.tsx         — Individual piece within an outfit
    StyleScoreSidebar.tsx — Style scores + wardrobe insight + today's pieces

  wardrobe/
    WardrobePage.tsx      — Wardrobe listing page
    FilterBar.tsx         — Category filter chips
    WardrobeGrid.tsx      — Item grid (skeleton + empty state)
    WardrobeItemCard.tsx  — Single wardrobe item tile
    WardrobeItemModal.tsx — Item detail bottom-sheet / dialog

  upload/
    UploadPage.tsx        — Upload page shell
    UploadZone.tsx        — Drag-and-drop / file input zone
    UploadItemCard.tsx    — Per-image analysis result card (all states)
    PieceGrid.tsx         — Individual pieces picker within an analyzed image

  app/
    App.tsx               — Root screen router (loading/landing/auth/onboarding/app)

lib/
  utils/
    inferCategory.ts      — Moved from page.jsx
    imageUtils.ts         — detectRealType, isHeicFile, prepareImage, cropImageForCategory
    aiUtils.ts            — classifyClothingWithAI, logToConsole
    authUtils.ts          — decodeJwt, loadGisScript

  constants/
    index.ts              — FREE_LIMIT, CATEGORIES, SHUFFLE_VIBES, STYLE_TAGS, BODY_TYPES, GOOGLE_CLIENT_ID

  hooks/                  — Unchanged
  contexts/               — Unchanged
  api-client.ts           — Unchanged
  types/api.ts            — Unchanged
```

---

## Phase-by-Phase Implementation Tasks

### Phase 0 — Dependency Changes

- [ ] Install `@mui/material @mui/system @emotion/react @emotion/styled`
- [ ] Remove `tailwindcss` and `@tailwindcss/postcss` from devDependencies
- [ ] Remove Tailwind from `postcss.config.mjs`
- [ ] Convert `next.config.ts` if needed

### Phase 1 — Design Foundations

- [ ] Create `components/theme/theme.ts` — full MUI theme with all palette, typography, component overrides
- [ ] Update `app/globals.css` — remove Tailwind import, add CSS variable declarations, keyframe animations, base reset, scrollbar styles
- [ ] Update `app/layout.tsx` — add Google Fonts link, remove Tailwind classes, wrap with `ThemeProvider` + `CssBaseline`

### Phase 2 — Utilities & Constants (zero UI)

- [ ] Create `lib/constants/index.ts`
- [ ] Create `lib/utils/inferCategory.ts`
- [ ] Create `lib/utils/imageUtils.ts`
- [ ] Create `lib/utils/aiUtils.ts`
- [ ] Create `lib/utils/authUtils.ts`

### Phase 3 — Common Components

- [ ] `components/common/WardrobeImage.tsx`
- [ ] `components/common/ScoreBar.tsx`
- [ ] `components/common/Toast.tsx`
- [ ] `components/common/Paywall.tsx`

### Phase 4 — Layout Shell Components

- [ ] `components/layout/AppNav.tsx`
- [ ] `components/layout/MobileTopBar.tsx`
- [ ] `components/layout/MobileTabBar.tsx`

### Phase 5 — Auth / Landing / Onboarding

- [ ] `components/auth/Landing.tsx`
- [ ] `components/auth/Auth.tsx`
- [ ] `components/auth/Onboarding.tsx`

### Phase 6 — Today Page

- [ ] `components/today/PieceCard.tsx`
- [ ] `components/today/OutfitCard.tsx`
- [ ] `components/today/StyleScoreSidebar.tsx`
- [ ] `components/today/TodayPage.tsx`

### Phase 7 — Wardrobe Page

- [ ] `components/wardrobe/FilterBar.tsx`
- [ ] `components/wardrobe/WardrobeItemCard.tsx`
- [ ] `components/wardrobe/WardrobeItemModal.tsx`
- [ ] `components/wardrobe/WardrobeGrid.tsx`
- [ ] `components/wardrobe/WardrobePage.tsx`

### Phase 8 — Upload Page

- [ ] `components/upload/UploadZone.tsx`
- [ ] `components/upload/PieceGrid.tsx`
- [ ] `components/upload/UploadItemCard.tsx`
- [ ] `components/upload/UploadPage.tsx`

### Phase 9 — App Shell + Entry Point

- [ ] `components/app/App.tsx` — root screen router with all state
- [ ] `app/page.tsx` — replace massive JSX file with `export { default } from "@/components/app/App"`

### Phase 10 — Cleanup & Validation

- [ ] Delete old `app/page.jsx`
- [ ] Remove unused Tailwind/Geist font references from `layout.tsx`
- [ ] Run `npm run build` to verify zero TS/lint errors
- [ ] Visually verify all screens: Landing, Auth, Onboarding, Today, Wardrobe, Upload, Paywall

---

## Key Engineering Decisions

### Styling Strategy

Use MUI's `sx` prop and `styled()` API as the primary styling mechanism. CSS variables
(already defined in globals.css) remain usable inside `sx` as string values:

```tsx
<Box
  sx={{ background: "var(--cream)", borderBottom: "1px solid var(--linen)" }}
/>
```

Custom typography variants in the MUI theme handle Cormorant Garamond usage without
needing to repeat font-family everywhere.

### No Default MUI Visual Style

Every MUI component override in the theme will be set to match the existing design.
Buttons will not have rounded corners, default elevation, or MUI blue — they will
match the flat, border-based, warm-ink-on-cream style.

### Responsive Pattern

MUI `useMediaQuery(theme.breakpoints.up('md'))` replaces the inline CSS media queries
where JS-driven logic is needed. Pure CSS breakpoints use `sx={{ display: { xs: 'flex', md: 'none' } }}`.

### File Naming Convention

- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- All TypeScript (`.tsx` / `.ts`), no `.jsx`

### State Co-location

Each page component owns its own local state. Global state (user, screen, wardrobe)
remains in `App.tsx` passed down as props — no Redux/Zustand needed yet.

---

## What Must NOT Change

- All API calls (`apiClient.*`) — identical
- `useWardrobe` hook interface — identical
- `AuthContext` — identical
- Backend route handlers — untouched
- JSON response shapes
- All user-facing text, copy, and messaging
- Visual design: colors, fonts, spacing, layout structure
- Animations and transitions
- Mobile vs desktop responsive behaviors
