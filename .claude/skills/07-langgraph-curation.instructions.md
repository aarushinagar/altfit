---
applyTo: "backend/langgraph/curation/**,app/api/curations/**,lib/tools/weather.ts,lib/tools/query.ts"
---

# ALTFit — LangGraph Curation Pipeline

## Purpose

Generates 3 daily outfit suggestions based on weather, user wardrobe, and style preferences.
Triggered by `POST /api/curations/today`. Results cached in `DailyCuration` table.

## File Structure

```
backend/langgraph/curation/
  state.ts    — CurationAnnotation
  nodes.ts    — 7 node functions
  graph.ts    — buildCurationGraph()
lib/tools/weather.ts          — getWeatherTool(lat, lon)
lib/tools/query.ts            — queryWardrobeCandidates(params)
lib/schemas/curation.ts       — weatherContextSchema, curatedSlotSchema, curationOutputSchema
config/regen.ts               — DEFAULT_REGEN_CONFIG
```

## State Shape (state.ts)

Key fields:
- `userId`, `userLat`, `userLon`, `userTimezone`, `localDate`
- `weatherRaw: WeatherOutput | null`
- `weatherContext: WeatherContext | null`
- `candidateItems: WardrobeCandidate[]`
- `curatedSlots: CuratedSlot[] | null` — 3 slots
- `hydratedSlots` — slots with full WardrobeItem data attached
- `curationId: string | null`
- `excludeWardrobeItemIds: string[]` — for regen
- `regenerateSlot: number | null` — 1|2|3 for regen
- `regenConfig: RegenConfig`
- `queryTierUsed: 1 | 2`
- `validationAttempts: number`

## Node Pipeline

```
fetchWeatherNode → interpretWeatherNode → queryWardrobeNode
  → curateOutfitsNode → validateOutfitsNode → persistCurationNode → hydrateSlotsNode
```

Retry loops:
- `curateOutfitsNode` retries up to 2× if `validateOutfitsNode` fails
- `fetchWeatherNode` retries 2× on network error; falls back to `locationCity` from User record

## Weather Tool (lib/tools/weather.ts)

Use Open-Meteo (no API key) + Nominatim for city name:
- `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code`
- `https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json`

## Wardrobe Candidates Tool (lib/tools/query.ts)

Calls Supabase RPC `get_wardrobe_candidates(p_user_id, p_temp_c, p_condition, p_season)`.
Tier 1: weather-filtered (up to 20 items). Tier 2 fallback: 10 most recent active items.
IDs are strings — never cast to BigInt.

```typescript
const { data, error } = await supabaseAdmin
  .rpc("get_wardrobe_candidates", { p_user_id: userId, p_temp_c: tempC, ... });
```

## DailyCuration Cache Pattern

```typescript
// In POST /api/curations/today:
const existing = await prisma.dailyCuration.findUnique({
  where: { userId_localDate_userTimezone: { userId, localDate, userTimezone: timezone } },
});
if (existing) return successResponse({ slots: hydrateFromDb(existing), fromCache: true }, "OK");
```

Use `Intl.DateTimeFormat` to get localDate in user's timezone — never use UTC date as localDate.

## Slot Schema

Each `CuratedSlot` has: `outfit_ids: string[]` (wardrobeItemIds), `rationale`, `styling_tip`, `occasion_tags`, `vibe`.
`outfit_ids` are `WardrobeItem.id` values — NOT `Outfit.id` values.

## Regen Rules (from config/regen.ts)

- Free: 1 regen/day. Pro: 5 regens/day.
- Check `DailyCuration.regenCount` before running the graph.
- On regen: pass `excludeWardrobeItemIds = oldSlot.outfit_ids` to avoid repeating same items.
