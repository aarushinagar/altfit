# 📋 STRICT PERFORMANCE REQUIREMENT - Today's Page Outfit Curation

**Effective Date**: March 20, 2026  
**Owner**: Engineering Team  
**SLA**: 95% of outfit curations must complete in ≤5 seconds

---

## 🎯 **Requirement Statement**

Users opening the Today's page or clicking "Refresh" should **see a curated outfit within 5 seconds** from request initiation. This applies to:
- First outfit load of the day (cache miss)
- Refresh/regenerate button clicks
- Slot-specific refresh ("New Look" on individual cards)

**Exclusion**: Network failures beyond our control (dropped connections, DNS resolution failure)

---

## ⏱️ **Performance Budget (5000ms total)**

```
IDB Cache Check:         10ms (target: <20ms)
Geolocation:            100ms (target: <500ms, optional)
API Request:           4500ms (strict budget for server processing)
Network Latency:        300ms (assumed RTT)
Reserve Buffer:          90ms (error margin)
─────────────────────────────────
TOTAL:                 5000ms (user-facing response time)
```

**Critical Path**: LangGraph pipeline must complete in ≤4500ms

---

## 🔧 **Performance Budget Allocation (4500ms server time)**

| Component | Target | Current | Delta | Priority |
|-----------|--------|---------|-------|----------|
| **Weather API** | 800ms | 500-2000ms | -1200ms | P1 |
| **Weather Interpretation (Claude)** | 300ms | 1000-2000ms | -1700ms | **P0** |
| **Outfit Curation (Claude)** | 1800ms | 1500-3000ms | -1200ms | **P0** |
| **Query Wardrobe** | 200ms | 150-400ms | -200ms | P2 |
| **Validation + Retries** | 300ms | 50-200ms | -50ms | P3 |
| **Hydration + Persist** | 700ms | 600-1000ms | -300ms | P2 |
| **Buffer** | 400ms | - | - | - |

---

## 🛑 **Compliance Criteria**

**The system is OUT OF COMPLIANCE if:**
- [ ] P0: Weather interpretation Claude call > 400ms
- [ ] P0: Outfit curation Claude call > 1800ms
- [ ] P1: Total LangGraph pipeline > 4500ms
- [ ] P2: Weather API + cache lookup > 1000ms
- [ ] P3: Validation retry loop > 300ms (triggers revert to previous)

**The system is IN COMPLIANCE if:**
- ✅ 95% of requests complete in ≤5000ms (client-side timer)
- ✅ All P0 items measured and logged
- ✅ Weather interpretation uses Haiku model (not Sonnet)
- ✅ Parallel Claude execution where possible
- ✅ Weather results cached by coordinate + timestamp

---

## 🚀 **Mandatory Optimizations (Non-Negotiable)**

1. **Use Claude Haiku for Weather Interpretation** (-45% latency)
   - Current: Sonnet model (1-2s)
   - Target: Haiku model (300-400ms)
   - Reason: Weather interpretation is deterministic; Haiku sufficient

2. **Parallelize Claude Calls Where Safe**
   - Current: Weather call waits for interpretation (sequential)
   - Target: Start both interpretation + outfit curation in parallel after weather fetch
   - Reason: Reduce critical path from 1-2s + 1.5-3s to max(1-2s, 1.5-3s)

3. **Implement Weather Caching by Coordinates**
   - Current: Fresh weather API call every refresh
   - Target: Cache weather results for 30 minutes by [lat, lon, tz]
   - Reason: Same wardrobe = same location = same weather (usually)

4. **Reduce Claude Tokens/Prompt Size**
   - Current: 1500 tokens for outfit curation
   - Target: < 1200 tokens
   - Reason: Fewer tokens = faster response

5. **Add Performance Instrumentation**
   - Log: Claude API latency per model (Haiku vs Sonnet)
   - Log: Total LangGraph execution time
   - Log: Weather cache hit/miss rate
   - Alert: When any P0 stage exceeds 400ms

---

## ✅ **Completion Checklist**

- [ ] Switch weather interpretation to Claude Haiku
- [ ] Implement coordinate-based weather cache (TTL 30min)
- [ ] Parallelize Claude calls (weather fetch + curation)
- [ ] Reduce outfit curation prompt to <1200 tokens
- [ ] Add performance logging to LangGraph pipeline
- [ ] Verify P0 latency < 400ms each
- [ ] Verify total LangGraph < 4500ms via load test
- [ ] Deploy to staging + verify with 100 test requests
- [ ] Update monitoring dashboard with P0 breach alerts
- [ ] Document performance profile for future reference

---

## 📊 **Success Metrics**

After implementation, measure:
- **P95 latency**: Must be ≤5000ms
- **P99 latency**: Must be ≤7000ms
- **Error rate**: <1% (non-network errors)
- **Claude Haiku accuracy**: Same as Sonnet (weather interpretation only)

---

### Note
This requirement prioritizes user experience (5s max) over cost optimization. Weather API caching and Haiku model switch are the primary drivers of improvement.

**Owner**: Engineering  
**Status**: ACTIVE (Enforce immediately)
