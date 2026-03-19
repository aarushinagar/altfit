# Curation Flow - Scenario Breakdowns with Exact Timings

**Reference for**: Performance testing, user experience expectations, optimization decisions

---

## Scenario 1: Cache Hit (Same Browser, Same Day)

**User**: Refreshes Today page or opens the browser again  
**Expected Total Time**: ~500ms  

### Timeline

```
T=0ms      User clicks Today tab / page refreshes
T=5ms      useCuration hook effect runs
T=10ms     Geolocation request fires (non-blocking)
T=15ms     Generate IDB key: `curation:userId:localDate:timezone`
T=20-40ms  IDB.get(key) returns cached entry ✅
T=45ms     Validate: Has 3 slots? Has items? YES ✅
T=50-100ms React setState: setSlots, setCurationId, etc.
T=100-150ms TodayPage re-renders with SwipeCard
T=150-500ms Load images from cached URLs
T=500ms    ✅ UI fully interactive, outfits visible

Console logs:
  [Curation] IDB result: HIT (3 slots)
  [Curation] serving from IDB cache
  [Curation] done — clearing loading
```

---

## Scenario 2: Cache Miss - First Load of Day

**User**: Opens Today page for first time today  
**Expected Total Time**: ~5.5 seconds  

### Timeline

```
T=0ms          User opens Today page
T=5ms          useCuration hook effect runs
T=10ms         Generate IDB key
T=20-40ms      IDB.get(key) returns null ❌
T=50-100ms     Request geolocation → device's GPS/network
T=100ms        Token refresh for auth
T=105ms        POST /api/curations/today initiated
               ├─ Geolocation fires, may still be pending...

────────────── SERVER PROCESSES REQUEST ──────────────

T=150ms        [Server] Auth middleware (50ms)
T=200ms        [Server] Check DB cache
               └─ DailyCuration.findUnique(userId, localDate, tz)
               └─ No entry from yesterday (localDate changed)

T=250ms        [Server] Start LangGraph pipeline

T=250-1000ms   ├─ fetch_weather
               │  └─ OpenWeather API call
               │  └─ Retry up to 2× if fails
               └─ Output: { temp_c, condition, humidity, etc. }

T=1000-2500ms  ├─ interpret_weather (Claude)
               │  └─ Model: claude-opus-5
               │  └─ Max tokens: 500
               │  └─ Timeout: 45s
               │  └─ Input: Raw weather
               └─ Output: { dressing_temp_band, layering_needed, etc. }

T=2500-2800ms  ├─ query_wardrobe (Prisma)
               │  └─ WardrobeItem.findMany(userId, isActive=true)
               │  └─ Take: 50 items max
               │  └─ Sort: createdAt DESC
               └─ Output: candidateItems[]

T=2800-5500ms  ├─ curate_outfits (Claude)
               │  └─ Model: claude-sonnet-4-6
               │  └─ Max tokens: 1500
               │  └─ Timeout: 45s
               │  └─ Input: candidates + weather context
               │  └─ May retry validation 1-2× on failure
               └─ Output: 3 curated slots with outfit_ids

T=5500-5600ms  ├─ validate_outfits (CPU)
               │  └─ Check: 3 slots, valid IDs, no duplicates?
               └─ Status: ✅ Valid

T=5600-5900ms  ├─ persist_curation (Prisma)
               │  └─ DailyCuration.upsert()
               │  └─ Save slots to slot1, slot2, slot3 columns
               └─ Output: Persisted row

T=5900-6400ms  ├─ hydrate_slots (Prisma)
               │  └─ WardrobeItem.findMany(id IN outfit_ids)
               │  └─ Build HydratedSlot[] with full metadata
               └─ Output: hydratedSlots[]

T=6400ms       └─ Graph complete, state ready to return

────────────── BACK TO CLIENT ──────────────

T=6450ms       [Client] API response received

T=6460ms       Parse JSON response:
               ├─ slots: HydratedSlot[3]
               ├─ curationId: string
               ├─ weatherContext: {...}
               └─ weatherAvailable: boolean

T=6470-6480ms  ├─ Validate response (totalItems > 0)
               └─ YES ✅

T=6480-6495ms  ├─ IDB.set(key, { slots, curationId, ... })
               └─ Wait for write completion

T=6500ms       ├─ React setState:
               │  ├─ setSlots(newSlots)
               │  ├─ setCurationId(newId)
               │  ├─ setWeatherSummary(summary)
               │  └─ setIsLoading(false)

T=6550ms       ├─ TodayPage renders
               │  └─ LookItemGrid × 3 visible
               │  └─ SwipeCard animates in

T=6600-7000ms  └─ Image loading starts (parallel)

T=7000ms       ✅ UI fully interactive, outfits visible

Console logs:
  [Curation] IDB result: MISS
  [Curation] requesting geolocation…
  [Curation] geo resolved: { lat, lon }
  [Curation] fetching /api/curations/today…
  [CurationGraph] curate_outfits: calling Sonnet for 50 candidates
  [CurationGraph] curate_outfits: returned 3 slots
  [Validation] All slots valid ✅
  [Curation] slots received: 3, total items: 9
  [Curation] storing in IDB

TOTAL TIME: ~6.5-7 seconds
BREAKDOWN:
  - Geolocation: ~0.5s (10%)
  - DB checks: ~0.2s (3%)
  - Weather API: ~0.75s (12%)
  - Weather Claude: ~1.5s (20%)
  - Wardrobe query: ~0.3s (4%)
  - Outfit Claude: ~2.7s (40%) ⭐ CRITICAL PATH
  - Validation+Persist+Hydrate: ~0.8s (11%)
```

---

## Scenario 3: Different Browser, Same Day

**User**: Opens Today page on mobile (IDB miss, but DB cache exists)  
**Expected Total Time**: ~500ms - 1 second  

### Timeline

```
T=0ms          User opens Today page on phone
T=10ms         useCuration hook effect runs
T=20-40ms      IDB.get(key) returns null ❌ (different browser)
T=50-100ms     POST /api/curations/today initiated

────────────── SERVER PROCESSES REQUEST ──────────────

T=150ms        [Server] Auth check (50ms)
T=200ms        [Server] Wardrobe exists check (50ms)
T=250ms        [Server] Check DB cache:
               └─ DailyCuration.findUnique(userId, localDate, tz)
               └─ ✅ FOUND (from yesterday's first load)

T=300ms        Validate cached slots:
               ├─ 3 slots exist?
               ├─ Each has items?
               └─ YES ✅

T=350-700ms    Hydrate wardrobe items:
               └─ WardrobeItem.findMany(id IN outfit_ids)
               └─ Build full item metadata

T=700ms        [Server] Return cached + hydrated slots

────────────── BACK TO CLIENT ──────────────

T=750ms        [Client] API response received
T=760ms        Parse JSON
T=770-780ms    IDB.set() (backup to this device's cache)
T=790ms        React setState + render
T=850-900ms    Image loading starts
T=1000ms       ✅ UI fully interactive

TOTAL TIME: ~1 second
BREAKDOWN:
  - Network latency: ~0.2s
  - DB hydration: ~0.35-0.45s ⭐ Only slow part
  - IDB write: ~0.01s
  - React render: ~0.15s

Console logs:
  [Curation] IDB result: MISS
  [CurationsToday] DB cache hit — outfit_ids: [...]
  [CurationsToday] Hydrated slots: [3 slots, 9 items total]
```

---

## Scenario 4: Regenerate Single Slot

**User**: Taps "Regen" on outfit #2  
**Expected Total Time**: ~3-5 seconds  

### Timeline

```
T=0ms          User taps "Regen" button on slot 2
T=10ms         setRegenLoadingSlot(2)
T=20ms         Request geolocation (non-blocking)

T=30-40ms      DELETE /api/outfit-cache/clear
T=40ms         ├─ Auth check
T=50ms         ├─ Current localDate in sv-SE format
T=60-100ms     ├─ DailyCuration.deleteMany(userId, localDate)
T=100ms        └─ Returns { cleared: count }

T=110ms        POST /api/curations/curationId/regen
               with body: { slot: 2, timezone, lat, lon }

────────────── SERVER PROCESSES REQUEST ──────────────

T=160ms        [Server] Auth check
T=200ms        Load existing DailyCuration by ID
T=250ms        Verify user ownership
T=300ms        Check regen limit:
               ├─ User plan: "pro" (5 regens/day)
               ├─ Current count: 2
               ├─ Allowed? YES ✅
               └─ Increment to 3

T=350ms        Start LangGraph for ONLY slot 2

T=350-1800ms   ├─ fetch_weather (reuse if available)
T=1800-3300ms  ├─ interpret_weather (Claude)
T=3300-3500ms  ├─ query_wardrobe
T=3500-5200ms  ├─ curate_outfits (Claude)
               │  └─ Exclude items used in slots 1 & 3
               │  └─ Include hint about previous slot 2
T=5200-5300ms  ├─ validate_outfits
T=5300-5500ms  ├─ persist_curation (update only slot2)
T=5500-5800ms  └─ hydrate_slots

────────────── BACK TO CLIENT ──────────────

T=5850ms       [Client] Response received
T=5860ms       Parse { slots: [...] }
T=5870-5880ms  Update IndexedDB with new slots
T=5890ms       setSlots(newSlots), setRegenLoadingSlot(null)
T=5950ms       SwipeCard animates new outfit onto screen
T=6000ms       ✅ New outfit visible, can interact

TOTAL TIME: ~5.8-6 seconds
BREAKDOWN:
  - Cache clear: ~0.1s
  - Weather+Interpret: ~1.5s
  - Outfit Claude: ~1.7s (less tokens due to exclusions)
  - Persist+Hydrate: ~0.5s
  - Network/render: ~0.2s

Console logs:
  [Curation] regenerateSlot(2) called
  [Cache] ✅ Cleared DailyCuration entries
  [CurationGraph] Running regenerate pipeline for slot 2
  [CurationGraph] Excluding items from existing slots
  [CurationGraph] Gemini returned 1 new slot
  [Single] ✅ Cache updated: slot1.DAYTIME replaced

NOTE: Faster than full curation because:
  - Only 1 slot generated (1/3 token cost)
  - Context includes existing good slots as reference
  - May reuse weather from same day
```

---

## Scenario 5: Slow Network (Timeout Approaching)

**User**: On poor cellular connection  
**Expected Total Time**: 30-55 seconds (or error)  

### Timeline

```
T=0ms          User opens Today page on slow 3G
T=50ms         useCuration hook, IDB check → MISS
T=100-200ms    Geolocation request initiated
               └─ Device has slow GPS fix
T=5000ms       Geolocation still pending (not timed out yet)
               └─ Continues with fallback...

T=5010ms       ensureFreshToken() called
T=5020ms       POST /api/curations/today sent
               └─ AbortController timeout: 50s
               └─ Guard timeout: 55s

T=5020-12000ms Network latency on slow connection
               └─ Server processing still happening

T=12000ms      [Server] Processing LangGraph
T=12100-14000ms ├─ Weather fetch
               └─ Slow network = slow API

T=14000-20000ms ├─ Claude interpret
               └─ API call slower on poor connection

T=20000-30000ms ├─ Outfit curation
               └─ Could be slow due to network
                 but Claude side isn't affected

T=30000ms      [Server] Returns response

T=30100ms      [Client] Response finally arrives
T=30200ms      Processing

────────────── STILL OK SO FAR ──────────────

T=30500ms      TodayPage renders ✅
               └─ User sees outfits
               └─ Total time: ~30.5 seconds

If network REALLY slow or Claude times out:

T=45000ms      callClaude() timeout (per LLM call)
               └─ Graph retries, might succeed

T=50000ms      AbortController timeout fires
               └─ Request aborted on client

T=50050ms      Error: "Request was aborted"

T=55000ms      Guard timeout fires
               └─ setError("Outfit generation is taking too long")
               └─ User sees error toast

Console logs (if error):
  [Curation] ❌ 55s guard fired — forcing error state
  [Curation] caught error: Request aborted
  [Curation] API error: status 504 or timeout

User sees: "Outfit generation is taking too long. Please retry."
```

---

## Scenario 6: New User (0 Wardrobe Items)

**User**: Opens Today page but hasn't uploaded any clothing yet  
**Expected Total Time**: ~300ms  

### Timeline

```
T=0ms          User opens Today page
T=10ms         useCuration hook effect runs
T=40ms         IDB check → MISS (first time ever)
T=100ms        POST /api/curations/today initiated

────────────── SERVER PROCESSES REQUEST ──────────────

T=150ms        [Server] Auth check
T=200ms        [Server] Verify hasWardrobe:
               └─ WardrobeItem.findFirst(userId)
               └─ NO ITEMS ❌

T=250ms        Return error response:
               {
                  success: false,
                  error: "No wardrobe items found. Upload at least 2 pieces..."
               }
               HTTP 400

────────────── BACK TO CLIENT ──────────────

T=300ms        [Client] API response received
T=310ms        data.success == false
T=320ms        setError("No wardrobe items found...")
T=330ms        setIsLoading(false)
T=350ms        StyleOnboarding component rendered
               └─ Prompts user to upload

TOTAL TIME: ~350ms
BREAKDOWN:
  - Network latency: ~0.15s
  - DB check: ~0.1s
  - Error handling: ~0.1s

Console logs:
  [Curation] API error: No wardrobe items found, status: 400
```

---

## Comparison Table

| Scenario | Time | Key Factor | Optimization Opportunity |
|----------|------|-----------|--------------------------|
| **Cache Hit** | ~500ms | IDB read | Already optimal |
| **DB Cache Hit** | ~1s | Hydration query | Denormalize item metadata |
| **Cache Miss (Full)** | 5-8s | ⭐ Claude calls | Use Haiku model, parallelize |
| **Regenerate Slot** | 3-5s | Reduced tokens | Reuse weather from same day |
| **Slow Network** | 30-55s | Network latency | Cache locally, fallback gracefully |
| **No Wardrobe** | ~300ms | Early exit | N/A (expected behavior) |

---

## Critical Performance Thresholds

```
🟢 GOOD         < 3 seconds   - Users don't perceive wait
🟡 ACCEPTABLE   3-8 seconds   - Noticeable but acceptable
🔴 POOR         > 8 seconds   - Users frustrated, may abandon
💀 DEATH        > 55 seconds  - Error, user must retry
```

**Current Performance**:
- Cache hit: 🟢 (0.5s)
- DB cache hit: 🟢 (1s)
- Full curation: 🟡 (5-8s) ← Needs optimization
- Regenerate: 🟡 (3-5s) ← Acceptable
- Slow network: 🔴 (30-55s) ← At risk

---

## Real-World Impact Estimates

**Assuming 30,000 daily active users**:

### Daily Traffic Distribution
- **60%** (18k users): Same-browser cache hit → 0.5s avg
- **25%** (7.5k users): Different browser, DB cache → 1s avg
- **10%** (3k users): First load, cache miss → 5-8s avg
- **5%** (1.5k users): Slow network, errors, etc. → 10-30s avg

### Wait Time Impact
```
Good experience (< 3s):     ~25.5k users (85%) ✅
Acceptable (3-8s):         ~3k users (10%) 🟡
Poor (> 8s):               ~1.5k users (5%) 🔴
```

### If we optimize Claude calls:
```
Switch to Haiku: -40-50% time on Claude calls
  5-8s full curation → 3-5s
  
Effect: ~3k users move from 🟡 to 🟢 category
Overall: 88% great experience (was 85%)
```

---

## Measurement & Monitoring

### Key Metrics to Track

```
Web Vitals:
  - First Contentful Paint (FCP)
  - Time to Interactive (TTI)
  - Cumulative Layout Shift (CLS)

Custom Metrics:
  - Time to first outfit visible
  - Time from user action to cache clear completion
  - Cache hit rate (IDB + DB combined)
  - LLM call latencies
  - Validation retry percentage

Alerts:
  - Claude API > 40s (near timeout)
  - Network request > 55s (guard timeout)
  - Cache hit rate < 50%
  - Error rate > 5%
```

### Logging Implementation

All timings logged via console (dev) and to monitoring service (prod):

```javascript
// Already done:
console.log('[Curation] ── START')
console.log('[Curation] IDB result:', cached ? 'HIT' : 'MISS')
console.log('[CurationGraph] curate_outfits: Gemini returned ${slots.length} slots')

// Should add:
performance.mark('curation-start')
// ... do work ...
performance.mark('curation-end')
performance.measure('curation', 'curation-start', 'curation-end')
// Send to analytics service
```
