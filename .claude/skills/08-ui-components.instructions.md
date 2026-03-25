---
applyTo: "components/**,app/(auth)/**,app/(app)/**"
---

# ALTFit — UI Components

## Tech Stack

- **MUI** (`@mui/material`) for all UI components — no Tailwind, no custom CSS classes
- **CSS Custom Properties** injected via MUI `GlobalStyles` in `lib/theme/CssVariables.tsx`
- **Theme tokens** live in `lib/theme/tokens.ts` — never hardcode hex colors or font sizes

## Design Tokens — Never Hardcode

```typescript
// Always reference from lib/theme/tokens.ts
import { COLORS, FONT, SPACING, RADII, SHADOWS } from "@/lib/theme/tokens";

// Wrong: sx={{ color: "#7B5EA7" }}
// Right: sx={{ color: COLORS.accent[500] }}
```

## MUI sx Prop Conventions

```typescript
// Spacing: use multiples of 8px (MUI default)
sx={{ p: 2, mb: 3, gap: 1.5 }}   // 16px, 24px, 12px

// Responsive: mobile-first
sx={{ fontSize: { xs: 14, sm: 16, md: 18 } }}

// Theme-aware colors
sx={{ bgcolor: "background.paper", color: "text.primary" }}

// camelCase for vendor-prefixed: WebkitFontSmoothing not "-webkit-font-smoothing"
```

## Component Organization

```
components/
  auth/        Auth.tsx, Onboarding.tsx, Landing.tsx
  layout/      AppNav.tsx, MobileTopBar.tsx, MobileTabBar.tsx
  today/       TodayPage.tsx, OutfitCard.tsx, CurationSlotCard.tsx (coming)
  wardrobe/    WardrobePage.tsx, PieceCard.tsx, WardrobeGrid.tsx
  upload/      UploadPage.tsx, ImagePreview.tsx, PieceChips.tsx
  common/      Toast.tsx, LoadingSpinner.tsx
  paywall/     Paywall.tsx
```

## Context Access Pattern

In `(app)` pages/components, always use `useAppContext()`:

```typescript
import { useAppContext } from "@/lib/contexts/AppContext";
const { user, plan, savedItems, showToast, handleSaveItem } = useAppContext();
```

Never import `AuthContext` in `(app)` components — use `AppContext` which already has user state.

## Loading / Empty States

Every list or data-driven component must have:
1. **Skeleton loading** — 3-6 skeleton cards while data fetches
2. **Empty state** — descriptive message + CTA button
3. **Error state** — brief message + retry option

## Mobile-First + Responsive

- Bottom navigation on mobile (`MobileTabBar`), side nav on desktop (`AppNav`)
- Cards: full-width on mobile, grid on desktop
- Touch targets: minimum 44×44px
- No hover-only interactions — use `onClick` not `onMouseEnter` for primary actions

## Typography

```typescript
// Use MUI variant system — don't hardcode font-size
<Typography variant="h1">  // 32px brand heading
<Typography variant="h6">  // 20px card title
<Typography variant="body1"> // 16px body
<Typography variant="caption"> // 12px metadata
```

## Accessibility

- All icon buttons must have `aria-label`
- Images must have meaningful `alt` text
- Loading states should include `aria-busy="true"`
