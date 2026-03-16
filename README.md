# ALTFit — Your AI Personal Stylist

**Your personal styling assistant that learns your taste and curates outfits from your own wardrobe using AI vision and LangGraph pipelines.**

---

## 🎯 What is ALTFit?

ALTFit solves the "nothing to wear" problem. With a full wardrobe but no outfits, most people either:

- Wear the same 5 pieces on repeat
- Spend 30+ minutes deciding what to wear
- Make impulse purchases that don't match anything
- Have no idea what their actual style is

**ALTFit changes this by:**

1. **Classifying your wardrobe** — AI vision analyzes each clothing photo to extract color, material, fit, occasion, season, and style aesthetic
2. **Building a styled profile** — Quick onboarding learns your style preferences and pain points
3. **Generating daily outfits** — LangGraph curation pipeline finds perfect combinations based on current weather, your style, and available items
4. **Learning over time** — Tracks what you actually wear and refines suggestions accordingly

---

## ✨ Core Features

### 🎬 Daily Outfit Curation

- **3-slot daily outfit engine** — Morning: get 3 complete outfit suggestions
- **Weather-aware** — Uses real-time weather data + Supabase RPC to find weather-appropriate items
- **Smart tier fallback** — Filters by weather first (Tier 1), falls back to recency if insufficient items (Tier 2)
- **Regeneration** — Swap individual slots up to 5 times/day (pro) or 1 time/day (free)

### 👗 Intelligent Wardrobe Management

- **AI image classification** — Gemini Vision analyzes each garment for:
  - Color (primary, secondary + hex codes)
  - Category & subcategory (top, bottom, outerwear, etc.)
  - Material, fit, formality level, texture, weight
  - Season suitability, weather tags, style aesthetics
  - Brand & confidence score
- **Smart storage** — WebP compression (max 1200px, Q80), EXIF stripped for privacy
- **Wardrobe insights** — See wear frequency, last worn date, style diversity

### 🔐 Authentication & Accounts

- **Email + password** — bcryptjs-hashed, custom JWT-based auth
- **Google OAuth** — One-tap sign-in with google-auth-library
- **Session management** — 15-min access tokens + 30-day refresh tokens
- **Multi-device** — Sessions are per-device; logout one device doesn't log out others

### 💳 Subscription (Razorpay)

- **Free tier** — 10 items, 1 regen/day, basic styling
- **Pro tier** — Unlimited items, 5 regens/day, advanced features
- **Enforcement** — Database trigger prevents free users from exceeding 10 items

---

## 🏗️ Architecture Overview

### Frontend

- **Framework**: Next.js 16 (Turbopack, App Router, React 19)
- **Styling**: MUI (`@mui/material`) + CSS custom properties (design tokens)
- **State**: React Context (AuthContext for auth, AppContext for app data) + custom hooks
- **Payments**: Razorpay integration

### Backend

- **API**: Next.js API routes (no separate backend needed)
- **Database**: Supabase (PostgreSQL) with Prisma ORM
- **Auth**: Custom JWT (jsonwebtoken) + bcryptjs
- **File Storage**: Supabase Storage buckets (wardrobe-images, profile-avatars)
- **Image Processing**: Sharp (server-side WebP conversion)

### AI/LLM

- **Vision Classification**: Gemini 2.5 Flash (`@google/generative-ai`)
- **Curation Reasoning**: Gemini 2.5 Flash with structured JSON output
- **Outfit Generation** (legacy): Anthropic Claude (kept for future use)
- **Orchestration**: LangGraph.js for two 7-12 node pipelines (ingestion + curation)

### IDs & Database

- **ID format**: Snowflake strings (distributed unique IDs) — stored as `String` in Prisma
- **Migrations**: Prisma (schema-first, type-safe)
- **Tenant Isolation**: All queries include `where: { userId }` for multi-tenant safety

---

## 📁 Directory Structure

```
root/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group (unauthenticated)
│   │   ├── signin/page.tsx       # /signin route
│   │   ├── register/page.tsx     # /register route
│   │   ├── onboarding/page.tsx   # /onboarding route
│   │   └── layout.tsx            # Auth layout wrapper
│   │
│   ├── (app)/                    # App route group (authenticated, AppContext + AppNav)
│   │   ├── layout.tsx            # Auth guard + app shell (nav, paywall, toast)
│   │   ├── today/page.tsx        # /today route (daily outfit curation)
│   │   ├── wardrobe/page.tsx     # /wardrobe route (wardrobe grid)
│   │   └── upload/page.tsx       # /upload route (add pieces)
│   │
│   ├── api/                      # All API routes
│   │   ├── auth/                 # Authentication routes
│   │   │   ├── login/route.ts
│   │   │   ├── register/route.ts
│   │   │   ├── google/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── refresh/route.ts
│   │   │   ├── me/route.ts
│   │   │   └── verify/route.ts
│   │   │
│   │   ├── wardrobe/             # Wardrobe API
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── [id]/wear/route.ts
│   │   │   └── bulk/route.ts
│   │   │
│   │   ├── outfits/              # Outfit API
│   │   │   ├── route.ts
│   │   │   └── [id]/worn/route.ts
│   │   │
│   │   ├── user/                 # User API
│   │   │   ├── profile/route.ts
│   │   │   ├── onboarding/route.ts
│   │   │   ├── subscription/route.ts
│   │   │   └── account/route.ts
│   │   │
│   │   ├── upload/image/route.ts # Image upload + Sharp processing
│   │   │
│   │   ├── curations/            # Daily curation API (coming)
│   │   │   ├── today/route.ts
│   │   │   └── [id]/regen/route.ts
│   │   │
│   │   └── razorpay-*/           # Payment routes
│   │
│   ├── page.tsx                  # / landing page
│   ├── layout.tsx                # Root layout (MUI ThemeProvider, AuthProvider)
│   └── globals.css               # Reset + CSS variables injection
│
├── backend/
│   ├── database/                 # Core server utilities
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── supabase.ts           # Supabase admin client
│   │   ├── auth-middleware.ts    # JWT verification + userId extraction
│   │   ├── api-response.ts       # successResponse/errorResponse helpers
│   │   ├── jwt.ts                # Token generation + verification
│   │   ├── snowflake.ts          # ID generation
│   │   ├── tenant.ts             # Multi-tenancy helpers
│   │   └── prisma/
│   │       ├── schema.prisma     # Data model (User, WardrobeItem, Outfit, etc.)
│   │       └── migrations/       # Prisma migrations
│   │
│   └── langgraph/                # LLM orchestration
│       ├── ingestion/             # Wardrobe item classification pipeline
│       │   ├── state.ts
│       │   ├── nodes.ts
│       │   └── graph.ts
│       └── curation/              # Daily outfit curation pipeline
│           ├── state.ts
│           ├── nodes.ts
│           └── graph.ts
│
├── components/                    # React components
│   ├── auth/                      # Auth screens
│   │   ├── Auth.tsx              # Sign in / register form
│   │   ├── Landing.tsx           # Public landing page
│   │   └── Onboarding.tsx        # Style + issue selection
│   │
│   ├── layout/                    # Navigation + shell
│   │   ├── AppNav.tsx            # Desktop sidebar nav
│   │   ├── MobileTopBar.tsx      # Mobile top bar
│   │   ├── MobileTabBar.tsx      # Mobile bottom tab bar
│   │   └── ProfileDropdown.tsx   # User menu
│   │
│   ├── today/                     # Today's outfit page
│   │   ├── TodayPage.tsx         # Main component
│   │   ├── OutfitCard.tsx        # Full outfit display
│   │   ├── PieceCard.tsx         # Individual piece
│   │   └── StyleSidebar.tsx      # Style scores + insights
│   │
│   ├── wardrobe/                  # Wardrobe management
│   │   ├── WardrobePage.tsx      # Main component
│   │   ├── FilterBar.tsx         # Category filters
│   │   ├── WardrobeGrid.tsx      # Item grid
│   │   ├── WardrobeItemCard.tsx  # Single item tile
│   │   └── WardrobeItemModal.tsx # Detail modal
│   │
│   ├── upload/                    # Upload + classification
│   │   ├── UploadPage.tsx        # Main component
│   │   ├── UploadZone.tsx        # Drag-and-drop
│   │   ├── UploadItemCard.tsx    # Result card per image
│   │   └── UploadItemGrid.tsx    # Grid of extracted pieces
│   │
│   ├── common/                    # Shared components
│   │   ├── WardrobeImage.tsx     # Optimized image display
│   │   ├── ScoreBar.tsx          # Animated score display
│   │   └── Toast.tsx             # Toast notifications
│   │
│   └── paywall/
│       └── Paywall.tsx           # Subscription upgrade modal
│
├── lib/
│   ├── actions/                   # Server actions (called from components)
│   │   ├── auth.ts
│   │   ├── wardrobe.ts
│   │   ├── outfit.ts
│   │   ├── upload.ts
│   │   └── user.ts
│   │
│   ├── contexts/                  # React contexts
│   │   ├── AuthContext.tsx       # Global auth state
│   │   └── AppContext.tsx        # App-scoped state (plan, wardrobe, handlers)
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useWardrobe.ts
│   │   ├── useOutfit.ts
│   │   ├── useUpload.ts
│   │   └── index.ts (exports)
│   │
│   ├── llm/                       # LLM clients
│   │   └── parse.ts              # Gemini wrapper with Zod validation
│   │
│   ├── tools/                     # AI tools (called in LangGraph)
│   │   ├── vision.ts             # Gemini Vision (image classification)
│   │   ├── weather.ts            # Weather fetcher (Open-Meteo)
│   │   └── query.ts              # Wardrobe candidate query (Supabase RPC)
│   │
│   ├── schemas/                   # Zod validation schemas
│   │   ├── wardrobeItem.ts       # WardrobeItemMetadata schema
│   │   └── curation.ts           # Weather + slot schemas
│   │
│   ├── theme/                     # Design tokens + MUI theme
│   │   ├── tokens.ts             # Colors, fonts, spacing, breakpoints
│   │   ├── muiTheme.ts           # createTheme() with dark mode
│   │   ├── CssVariables.tsx      # CSS variable injection (GlobalStyles)
│   │   └── ThemeRegistry.tsx     # MUI + emotion setup
│   │
│   ├── utils/                     # Pure utilities
│   │   ├── authUtils.ts          # localStorage, decodeJwt, Google GIS
│   │   ├── dateUtils.ts          # Date/timezone helpers
│   │   └── clothing.ts           # clothing-specific helpers
│   │
│   └── constants/                 # App constants
│       └── index.ts              # FREE_LIMIT, CATEGORIES, STYLE_TAGS, etc.
│
├── config/
│   └── regen.ts                  # Regeneration configuration + limits
│
├── types/
│   └── api.ts                    # Shared TypeScript types (API requests/responses)
│
├── public/                        # Static assets
│
├── .claude/
│   └── skills/                   # Cursor/Claude agent instructions (skills)
│       ├── 00-conventions.instructions.md
│       ├── 01-auth-api.instructions.md
│       ├── 02-wardrobe-routes.instructions.md
│       ├── 03-outfit-routes.instructions.md
│       ├── 04-user-routes.instructions.md
│       ├── 05-ai-clients.instructions.md
│       ├── 06-langgraph-ingestion.instructions.md
│       ├── 07-langgraph-curation.instructions.md
│       ├── 08-ui-components.instructions.md
│       └── 09-testing.instructions.md
│
├── AGENT_TODO.md                 # Implementation checklist for agentic curation
├── wardrobe_agent_design_v3.md   # Detailed LangGraph design spec
├── (historical docs)             # REFACTORING_PLAN.md, CORS_FIX_SUMMARY.md, etc.
├── README.md                     # This file
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
└── .env                          # Environment variables (never commit)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Supabase project (free tier works)
- Google OAuth client ID
- Razorpay account (payments)
- Gemini API key

### Installation

1. **Clone & install**

   ```bash
   git clone <repo-url> altfit
   cd altfit
   npm install
   ```

2. **Set up environment**

   ```bash
   cp .env.example .env
   # Fill in Supabase, Google, Razorpay, Gemini keys, JWT secret
   ```

3. **Initialize database**

   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. **Create Supabase buckets**
   - Log into Supabase dashboard
   - Storage → Create bucket `wardrobe-images` (public)
   - Storage → Create bucket `profile-avatars` (public)

5. **Start dev server**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

---

## 📊 Database Schema (Prisma)

### Core Models

- **User** — Authentication + preferences (email, provider, onboarded, styleProfiles, styleIssues)
- **Session** — Refresh tokens (hashed, 30-day expiry)
- **WardrobeItem** — Clothing pieces (name, category, colors, occasion, weather tags, parseConfidence, isActive)
- **Outfit** — Generated outfit combinations (occasion, reasoning, colorStory, scores)
- **OutfitItem** — Join table (outfit → wardrobeItem, with role mapping)
- **Subscription** — Payment records (plan, razorpayOrderId, status)
- **DailyCuration** (coming) — Cached daily outfit suggestions per user/timezone/date

---

## 🔌 API Routes

### Authentication

- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Email + password login
- `POST /api/auth/google` — Google OAuth token verification
- `POST /api/auth/refresh` — Refresh access token
- `GET /api/auth/me` — Get current user
- `GET /api/auth/verify` — Verify token validity
- `POST /api/auth/logout` — Invalidate sessions

### Wardrobe & Outfits

- `GET /api/wardrobe` — List items (paginated)
- `POST /api/wardrobe` — Create item (runs ingestion graph on image)
- `GET/PATCH/DELETE /api/wardrobe/[id]` — Single item operations
- `POST /api/wardrobe/[id]/wear` — Mark as worn
- `POST /api/wardrobe/bulk` — Bulk create items
- `GET /api/outfits` — List generated outfits
- `POST /api/outfits` — Create outfit from item IDs
- `PATCH /api/outfits/[id]/worn` — Mark outfit as worn

### User & Account

- `PATCH /api/user/profile` — Update name, avatar, preferences
- `PATCH /api/user/onboarding` — Set onboarded + styles
- `GET /api/user/subscription` — Get subscription status
- `POST /api/user/account` — Delete account

### Curation (In Progress)

- `POST /api/curations/today` — Get daily outfit suggestions
- `POST /api/curations/[id]/regen` — Regenerate one slot

---

## 🧠 AI Pipelines

### Ingestion Pipeline (LangGraph)

Runs when uploading a new wardrobe item. Classifies and enriches metadata.

1. **validateImageNode** — Check image is reachable, < 8MB
2. **visionParseNode** — Gemini Vision → WardrobeItemMetadata (with retry)
3. **enrichMetadataNode** — Normalize colors, derive temp range
4. **persistItemNode** — Save to Prisma + increment wardrobeItemCount

### Curation Pipeline (LangGraph)

Runs daily (or on-demand). Generates 3 outfit suggestions.

1. **fetchWeatherNode** — Open-Meteo + Nominatim → weather + location
2. **interpretWeatherNode** — Gemini LLM → weatherContext (structured)
3. **queryWardrobeNode** — Supabase RPC → tiered candidate filtering
4. **curateOutfitsNode** — Gemini LLM (senior stylist) → 3 slots
5. **validateOutfitsNode** — Verify slots (no dupe items, valid category role mapping)
6. **persistCurationNode** — Save DailyCuration record
7. **hydrateSlotsNode** — Attach full WardrobeItem data to each slot

---

## 🛠️ Development

### Design Tokens

All colors, fonts, spacing, breakpoints defined in `lib/theme/tokens.ts`.
Never hardcode hex colors or sizes — always reference tokens.

### Styling

- **Framework**: MUI `sx` prop (emotion under the hood)
- **CSS Variables**: Injected via `CssVariables.tsx`
- **Responsive**: Mobile-first breakpoints (xs, sm, md, lg, xl)
- **Dark mode**: Built into `muiTheme.ts`

### Type Safety

- **Zod schemas** for runtime validation (API inputs, LLM outputs)
- **TypeScript strict mode** enforced in `tsconfig.json`
- **No `any` types** — all backend routes properly typed

### Scripts

```bash
npm run dev          # Dev server + Turbopack
npm run build        # Production build
npm start            # Start prod server
npm run lint         # ESLint check
npm run db:push      # Sync schema to DB (no migrations)
npm run db:migrate   # Create migration
npm run db:studio    # Prisma Studio (visual editor)
```

---

## 📚 Documentation

- **[AGENT_TODO.md](AGENT_TODO.md)** — Implementation checklist for LangGraph workflows (14 phases)
- **[wardrobe_agent_design_v3.md](wardrobe_agent_design_v3.md)** — Complete design spec for ingestion + curation pipelines
- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** — Database + storage setup guide
- **[.claude/skills/](.claude/skills/)** — Agent instructions for Cursor/Claude (10 focused skills covering conventions, API routes, AI clients, UI components, testing)

Historical docs (outdated but kept for reference):

- REFACTORING_PLAN.md — Old frontend refactoring (page.jsx → components)
- CORS_FIX_SUMMARY.md — CORS + security fixes
- DEPLOYMENT_CHECKLIST.md — Deployment validation

---

## 🧪 Testing

Jest + Testing Library (configured but not yet integrated).

Test structure:

```
__tests__/
├── api/              # Route handler tests (node env)
├── lib/              # Utility + schema tests
└── components/       # Component tests (jsdom env)
```

See [.claude/skills/09-testing.instructions.md](.claude/skills/09-testing.instructions.md) for full test setup.

---

## 🔒 Security

### Auth

- **Passwords**: bcryptjs (cost 12) + argon2-style defense
- **Tokens**: JWT (RS256 / HS256 hybrid option), 15-min expiry
- **Sessions**: Refresh tokens hashed + stored (30-day expiry)
- **OAuth**: Google verified via `google-auth-library`, email verified flag checked

### API

- **User isolation**: All queries include `where: { userId }`
- **Ownership checks**: ID mutations verify `where: { id, userId }`
- **No secrets in responses**: Never return passwordHash, Session.token, razorpaySignature
- **CORS**: Fixed via nextjs-cors-fix (see CORS_FIX_SUMMARY.md)

### Database

- **RLS on Supabase Storage**: Disabled (we handle auth in API layer with custom JWT)
- **Tenant isolation trigger**: Enforces free tier 10-item limit
- **Soft deletes**: `isActive` flag prevents hard deletes (audit trail)

---

## 📱 Mobile Support

- **Responsive**: Mobile-first design
- **Touch targets**: ≥44px for all buttons/tappables
- **Bottom nav**: MobileTabBar on small screens
- **No hover-only interactions** — all primary actions work with touch

---

## 🚢 Deployment

### Recommended

- **Hosting**: Vercel (free tier, runs Next.js edge functions)
- **Database**: Supabase Postgres (free 500MB)
- **Storage**: Supabase Storage (free 1GB)

### Environment Variables (Production)

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...  (for migrations)
JWT_SECRET=... (32+ chars)
GOOGLE_CLIENT_ID=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
GEMINI_API_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## 🐛 Troubleshooting

See [TROUBLESHOOTING_LOG.md](TROUBLESHOOTING_LOG.md) for known issues and solutions.

Common problems:

- **Google Sign-In not working** → Check CLIENT_ID in env
- **Images not uploading** → Check Supabase Storage RLS + bucket names
- **Database migrations failing** → Ensure DIRECT_URL is set (Prisma needs direct connection for migrations)
- **Token expiration** → Refresh token via `POST /api/auth/refresh` before it expires

---

## 📖 Further Reading

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma ORM](https://www.prisma.io/docs)
- [MUI Material Design](https://mui.com/material/getting-started)
- [LangGraph.js](https://github.com/langchain-ai/langgraph)
- [Google AI SDK](https://ai.google.dev/docs)
- [Supabase Docs](https://supabase.com/docs)

---

## 📄 License

MIT — Use freely in personal & commercial projects.

---

## 🤝 Contributing

Contributions welcome! Please:

1. Follow the [.claude/skills/](.claude/skills/) conventions (00-conventions.instructions.md)
2. Add tests for new features
3. Update README.md if adding user-facing features
4. Use TypeScript strictly

---

**Built with ❤️ for anyone who's ever had "nothing to wear" with a full closet.**

_Last updated: March 16, 2026_
