# Today's Page Curation Flow - Quick Reference Guide

**Updated**: March 20, 2026  
**For**: Performance optimization & troubleshooting

---

## 🚀 QUICK STATS

| Metric | Value | Notes |
|--------|-------|-------|
| **Cache Hit (same browser)** | 0-50ms | IndexedDB instant |
| **Cache Hit (diff browser)** | 100-500ms | DB hydration |
| **Cache Miss (full curation)** | 4-8 seconds | LangGraph pipeline |
| **Client timeout** | 55 seconds | Safety net |
| **API timeout** | 60 seconds | Vercel Pro max |
| **Claude timeout** | 45 seconds | Hard limit per LLM call |
| **Geolocation timeout** | 6 seconds | Fallback to Delhi |
| **Typical daily token usage** | 1750 tokens/curation | $0.01-0.015 each |
| **Monthly cost** | $9k-13.5k | 30k active users |
| **Cache efficiency** | ~90% same-day | ~70% cross-device |

---

## 📊 EXECUTION FLOW QUICK MAP

```
User Opens Today Page
    ↓
    ├─ IDB Cache? (0-50ms)
    │  ├─ YES → Instant render ✅
    │  └─ NO → Continue...
    │
    ├─ Request Geolocation (100-500ms, non-blocking)
    │
    └─ POST /api/curations/today (5-55 seconds)
       ├─ DB Cache? (100-300ms)
       │  ├─ YES → Hydrate + return (200-500ms total)
       │  └─ NO → Run LangGraph pipeline...
       │
       └─ LangGraph (3.5-6.5 seconds):
          1. fetch_weather (0.5-2s)
          2. interpret_weather → Claude (1-2s) ⭐
          3. query_wardrobe (0.15-0.4s)
          4. curate_outfits → Claude (1.5-3s) ⭐⭐⭐
          5. validate_outfits (0.05-0.2s, may retry 2×)
          6. persist_curation (0.2-0.5s)
          7. hydrate_slots (0.4-0.8s)

⭐ = Critical path (optimization targets)
```

---

## 🔗 FILE MAP

```
CLIENT FILES:
  app/(app)/today/page.tsx              - Route wrapper
  components/today/TodayPage.tsx        - Main UI component
  lib/hooks/useCuration.ts              - State & API orchestration
  
API ENDPOINTS:
  app/api/curations/today/route.ts      - Main curation endpoint
  app/api/curations/[id]/regen/route.ts - Single slot regen
  app/api/outfit-cache/clear/route.ts   - Cache clearing
  
SERVER LOGIC:
  backend/langgraph/curation/graph.ts   - Pipeline orchestration
  backend/langgraph/curation/nodes.ts   - Individual node implementations
  backend/langgraph/curation/state.ts   - State schema
  
DATABASE:
  Prisma models:
    - DailyCuration (slots cache, regenCount)
    - WardrobeItem (user clothing)
    - User (plan, preferences)
```

---

## 🎯 TIMEOUT HIERARCHY (Client → Server)

```
Level 1: Client geolocation timeout
  ├─ 6000ms (geolocation) → fallback to Delhi
  
Level 2: Client fetch timeout  
  ├─ 50000ms (fetch AbortController)
  
Level 3: Client safety timeout
  ├─ 55000ms (effect guard timer)
  └─ Fallback: "Outfit generation is taking too long"
  
Level 4: API timeout (Vercel Pro)
  ├─ 60000ms maximum (hard limit)
  
Level 5: LLM timeout (per call)
  ├─ 45000ms (hardcoded in callClaude)
  └─ Affects weather interpretation & outfit curation
```

### If any timeout fires:
- **Geolocation**: Use fallback location (28.6139, 77.209)
- **Fetch**: Error toast, user can retry
- **API**: 504 "Taking too long" response
- **LLM**: Retry once, then fail request

---

## 💾 CACHE KEYS & TTL

| Layer | Key Format | TTL | Storage | Size |
|-------|-----------|-----|---------|------|
| **L1: IDB** | `curation:${userId}:${localDate}:${tz}` | Until day changes | IndexedDB | ~100KB |
| **L2: DB** | `(userId, localDate, userTimezone)` | Until day changes | Postgres | ~2-5KB |
| **L3: LLM** | None (no caching, always fresh) | Per-request | API call | N/A |

**Hit Rate Expectations**:
- Same browser, same day: **~90%** (L1)
- Different browser, same day: **~70%** (L2)
- First-time user: **~0%** (L3 full run)
- After regeneration: **~50%** (L2 only)

---

## 🔴 CRITICAL PATH (Performance Bottlenecks)

Ranked by impact on total time:

### 1. Claude Outfit Curation (35-40% of time)
- **Current**: 1.5-3 seconds
- **Bottleneck**: Model inference, token generation
- **Fixes**:
  - Use faster model (Haiku instead of Sonnet) → -40-50% time
  - Reduce candidate items (12 → 8) → -10-15% tokens
  - Better prompt → -5-10% tokens

### 2. Claude Weather Interpretation (15-25% of time)
- **Current**: 1-2 seconds  
- **Bottleneck**: Separate LLM call, runs sequentially
- **Fixes**:
  - Use Haiku model → -40-50% time
  - Cache by lat/lon bucket → -90% time if hit
  - Remove Claude, use rule-based → instant (complex rules)

### 3. Hydration Query (10-15% of time)
- **Current**: 0.4-0.8 seconds
- **Bottleneck**: N+1 potential, multiple image URL fetches
- **Fixes**:
  - Batch query (already done) ✓
  - Cache item metadata → -20-30% time

### 4. Weather API (10-20% of time)
- **Current**: 0.5-2 seconds
- **Bottleneck**: External API call, fallback available
- **Fixes**:
  - Cache by lat/lon → -80% time if hit
  - Use faster API → -20-30% time
  - Pre-compute for common areas → -90% time

### 5. Query Wardrobe (5-10% of time)
- **Current**: 0.15-0.4 seconds
- **Bottleneck**: Database retrieval
- **Fixes**:
  - Cache frequently accessed wardrobe → -50% time
  - Index on (userId, isActive) ✓ (already done)
  - Denormalize commonly used properties → -10-20% time

---

## 🌐 API CALL SEQUENCE

### On Cache Miss (typical first load):

```
CLIENT                              SERVER                      EXTERNAL
───────────────────────────────────────────────────────────────────────
User opens Today page
          │
          ├──► Check IDB (0ms)
          │         ↓ MISS
          │
          ├─► Request geolocation (500ms)
          │         ↓
          │    POST /api/curations/today ──────► Auth middleware (50ms)
          │         │                            │
          │         │                            ├─► Check DB cache (100ms)
          │         │                            │        ↓ MISS
          │         │                            │
          │         │                            ├─► Run LangGraph
          │         │                            │    ├─► OpenWeather API (1s)
          │         │                            │    ├─► Claude interpret (1.5s)
          │         │                            │    ├─► Claude curate (2s)
          │         │                            │    ├─► Validate (0.2s)
          │         │                            │    ├─► Persist DB (0.3s)
          │         │                            │    └─► Hydrate (0.6s)
          │         │◄──────────────────────── response (JSON)
          │
          ├─► Store in IDB (10ms)
          │
          └─► Render UI (100ms)
          
TOTAL TIME: ~5 seconds (cache miss)
```

---

## 📋 TESTING CHECKLIST

### Performance Tests
- [ ] Cache hit (IDB): Should be <50ms
- [ ] Cache hit (DB): Should be <500ms
- [ ] Cache miss (full): Should be <8 seconds
- [ ] Geolocation fallback: Should not exceed 6 seconds
- [ ] Stress test: 100 concurrent requests
- [ ] Token usage: Log and verify under 2500/request

### Functional Tests
- [ ] New user first load: Should work without cache
- [ ] Regenerate slot 1,2,3: Should work independently
- [ ] Same-day refresh: Should use IDB cache
- [ ] Day boundary: Cache should expire properly
- [ ] Different timezone: Cache should key correctly
- [ ] Error states: All timeouts should gracefully fail

### Cache Tests
- [ ] IDB writes on successful curation
- [ ] IDB clears on day boundary
- [ ] DB cache hit returns hydrated slots
- [ ] Cache clear endpoint works
- [ ] Stale cache (0 items) deleted on next load

---

## 🐛 DEBUGGING TIPS

### Check if using cache or doing full curation:
```
Browser DevTools → Console → filter "[Curation]"
Look for:
  "[Curation] IDB result: HIT" → Using cache
  "[Curation] IDB result: MISS" → Fetching fresh
```

### Performance profile:
```javascript
// In browser console:
performance.mark('curation-start');
// ... wait for outfits to load ...
performance.mark('curation-end');
performance.measure('curation', 'curation-start', 'curation-end');
console.table(performance.getEntriesByName('curation'));
```

### Check token usage:
```
Server logs → filter "[CurationGraph]"
Look for token counts in "clothing" node output
```

### Trace bottleneck:
```
API logs → POST /api/curations/today
Each node logs its start/end:
  [fetchWeatherNode] completed in Xms
  [interpretWeatherNode] completed in Xms
  [curateOutfitsNode] completed in Xms
```

---

## 🎨 UI LOADING STATES

The component cycles through these messages while loading:

```
0ms    → "Scanning your wardrobe..."
3000ms → "Matching your pieces..."
6000ms → "Checking the vibe..."
9000ms → "Cooking something good..."
12000ms → "Almost there..."
16000ms → "Worth the wait, promise."
```

If load exceeds 55 seconds, error toast: 
_"Outfit generation is taking too long. Please retry."_

---

## 💡 QUICK FIXES FOR COMMON ISSUES

| Issue | Cause | Fix |
|-------|-------|-----|
| Infinite loading | IDB cache corrupted | `await idb.delete(key)` |
| "No wardrobe" error | User has 0 items | Check: `wardrobeItem.count` |
| Cache hit every time | Day parsing bug | Check: `getUserLocalDate(tz)` |
| Timeouts on slow network | 50s timeout too short | Increase to 60s for poor connections |
| Token explosion | Large candidate set | Reduce `take: 50` → `take: 20` |
| Cross-slot duplicate items | Validation not enforcing | Check: `allowCrossSlotItemReuse` config |

---

## 📈 OPTIMIZATION ROADMAP

### Phase 1 (Quick Wins - Low Effort)
- [ ] Switch weather interpretation to Claude Haiku
- [ ] Improve prompt to reduce validation retries
- [ ] Add cache hit metrics to analytics

### Phase 2 (Medium Effort)
- [ ] Implement weather coordinate bucketing cache
- [ ] Optimize candidate item filtering logic
- [ ] Add geolocation permission check & caching

### Phase 3 (High Effort, High Impact)
- [ ] Parallelize Claude calls (weather + curation)
- [ ] Add Anthropic batch processing for off-peak
- [ ] Implement rule-based weather interpreter (remove Claude)
- [ ] Cache commonly-worn wardrobes by style profile

---

## 📞 SUPPORT REFERENCES

- **LandGraph Docs**: `backend/langgraph/README.md`
- **Curation State Schema**: `backend/langgraph/curation/state.ts`
- **Database Schema**: `backend/database/prisma/schema.prisma`
- **Caching Strategy**: `backend/langgraph/shared/cache.ts`
- **Error Codes**: `backend/database/api-response.ts`
