/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * useCuration — Daily outfit curation hook
 *
 * Responsibilities:
 *   1. Check IndexedDB for a cached curation for today (key: userId + localDate + timezone)
 *   2. On cache miss: request geolocation, then call POST /api/curations/today
 *   3. Store fresh results in IndexedDB for same-day instant loads
 *   4. Expose regenerateSlot() which calls POST /api/curations/[id]/regen
 *
 * Must be used in a client component ("use client").
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { get, set, del } from "idb-keyval";
import { getAuthToken, ensureFreshToken } from "@/lib/utils/authUtils";
import { getUserLocalDate } from "@/lib/timezone";
import type {
  HydratedSlot,
  WeatherContext,
} from "@/backend/langgraph/shared/types";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "";

interface IdbCacheEntry {
  slots: HydratedSlot[];
  curationId: string;
  weatherSummary: string | null;
}

function idbKey(userId: string, localDate: string, timezone: string): string {
  return `curation:${userId}:${localDate}:${timezone}`;
}

/** Default fallback coordinates (New Delhi) used when geo is unavailable. */
const DEFAULT_LOCATION = { lat: 28.6139, lon: 77.209 };

async function requestGeolocation(): Promise<{ lat: number; lon: number; usingFallback?: boolean }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ...DEFAULT_LOCATION, usingFallback: true };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({ ...DEFAULT_LOCATION, usingFallback: true }),
      { timeout: 6_000, maximumAge: 300_000 },
    );
  });
}

function weatherSummaryFromContext(
  ctx: WeatherContext | null,
  available: boolean = true,
): string | null {
  if (!ctx) return null;
  if (!available) {
    return "Weather currently unavailable · using generic fallback";
  }
  return `${ctx.target_temp_c}°C · ${ctx.dressing_temp_band.replace(/_/g, " ")}`;
}

export interface UseCurationReturn {
  slots: HydratedSlot[] | null;
  isLoading: boolean;
  error: string | null;
  curationId: string | null;
  fromCache: boolean;
  weatherSummary: string | null;
  weatherAvailable: boolean;
  reload: () => void;
  regenerateSlot: (slot: 1 | 2 | 3) => Promise<void>;
  regenLoadingSlot: 1 | 2 | 3 | null;
  dismissSlot: (slotIndex: number) => Promise<void>;
}

export function useCuration(userId: string | null): UseCurationReturn {
  const [slots, setSlots] = useState<HydratedSlot[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curationId, setCurationId] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);
  const [weatherAvailable, setWeatherAvailable] = useState(true);
  const [regenLoadingSlot, setRegenLoadingSlot] = useState<1 | 2 | 3 | null>(
    null,
  );
  const [loadTrigger, setLoadTrigger] = useState(0);

  const reload = useCallback(() => setLoadTrigger((n) => n + 1), []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    // Overall safety timeout — prevents skeleton from hanging forever
    const guardTimer = setTimeout(() => {
      console.warn("[Curation] 55s guard fired — forcing error state");
      if (!cancelled) {
        cancelled = true;
        setError("Outfit generation is taking too long. Please retry.");
        setIsLoading(false);
      }
    }, 55_000);

    async function load() {
      console.log("[Curation] load() started — userId:", userId);
      setIsLoading(true);
      setError(null);

      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localDate = getUserLocalDate(timezone);
        const key = idbKey(userId!, localDate, timezone);

        // 1. IndexedDB cache — show immediately, skip network entirely
        console.log("[Curation] checking IDB cache, key:", key);
        const cached = await get<IdbCacheEntry>(key);
        console.log("[Curation] IDB result:", cached ? `HIT (${cached.slots?.length ?? 0} slots)` : "MISS");

        if (cached) {
          // Only serve from cache if slots exist AND at least one slot has items
          // (guards against a stale entry saved before wardrobe photos existed)
          const slotsHaveItems = cached.slots?.some(
            (s: HydratedSlot) => (s.items?.length ?? 0) > 0,
          );
          if (cached.slots?.length > 0 && slotsHaveItems && !cancelled) {
            console.log("[Curation] serving from IDB cache");
            setSlots(cached.slots);
            setCurationId(cached.curationId);
            setWeatherSummary(cached.weatherSummary);
            setFromCache(true);
            setIsLoading(false);
            return; // Serve from cache; background refresh happens on explicit reload()
          }
          // Stale/empty cache — delete and fetch fresh
          console.log("[Curation] IDB cache discarded (no item photos) — fetching fresh");
          await del(key);
        }

        if (cancelled) return;

        // 2 & 3. Parallelize geolocation + token fetch (massive speedup!)
        console.log("[Curation] requesting geolocation & token in parallel…");
        const [geoResult, token] = await Promise.all([
          requestGeolocation(),
          ensureFreshToken(),
        ]);
        const lat = geoResult.lat;
        const lon = geoResult.lon;
        console.log("[Curation] geo resolved:", { lat, lon, fallback: geoResult.usingFallback });
        console.log("[Curation] token present:", !!token);

        if (cancelled) return;

        // 4. Now make the API call
        const ac = new AbortController();
        const fetchTimeoutId = setTimeout(() => ac.abort(), 50_000);
        console.log("[Curation] fetching /api/curations/today…");

        let res: Response | undefined;
        try {
          res = await fetch(`${BASE}/api/curations/today`, {
            method: "POST",
            signal: ac.signal,
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ lat, lon, timezone }),
            credentials: "include",
          });
        } finally {
          clearTimeout(fetchTimeoutId);
        }

        if (!res) throw new Error("Request was aborted before receiving a response");

        console.log("[Curation] fetch responded — status:", res.status);
        const data = await res.json();
        console.log("[Curation] data.success:", data?.success, "error:", data?.error);

        if (cancelled) return;

        if (!res.ok || !data.success) {
          console.log("[Curation] API error:", data?.error, "status:", res.status);
          setError(data.error || "Could not load today's outfits");
          setIsLoading(false);
          return;
        }

        const {
          slots: newSlots,
          curationId: newId,
          weatherContext,
          weatherAvailable: available,
        } = data.data as {
          slots: HydratedSlot[];
          curationId: string | null;
          weatherContext: WeatherContext | null;
          weatherAvailable: boolean;
        };

        const summary = weatherSummaryFromContext(weatherContext, available);

        setSlots(newSlots);
        setCurationId(newId);
        setWeatherSummary(summary);
        setWeatherAvailable(available);
        setFromCache(false);

        // 4. Store in IndexedDB — only if items were actually hydrated
        // (guards against caching a response with empty item arrays that would loop forever)
        const totalItems = (newSlots ?? []).reduce(
          (n, s) => n + (s.items?.length ?? 0),
          0,
        );
        console.log("[Curation] slots received:", newSlots?.length, "total items:", totalItems);
        if (newId && totalItems > 0) {
          console.log("[Curation] storing in IDB");
          await set(key, {
            slots: newSlots,
            curationId: newId,
            weatherSummary: summary,
          } satisfies IdbCacheEntry);
        } else if (totalItems === 0) {
          console.warn("[Curation] ⚠️ API returned slots with 0 items — NOT caching, will retry next load");
        }

        console.log("[Curation] done — clearing loading");
        setIsLoading(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("[Curation] caught error:", msg);
        if (!cancelled) {
          setError(msg);
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      console.log("[Curation] effect cleanup — marking cancelled");
      cancelled = true;
      clearTimeout(guardTimer);
    };
  }, [userId, loadTrigger]);

  const regenerateSlot = useCallback(
    async (slot: 1 | 2 | 3) => {
      if (!curationId || !userId) return;

      setRegenLoadingSlot(slot);
      setError(null);

      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        let lat = 0,
          lon = 0;
        try {
          ({ lat, lon } = await requestGeolocation());
        } catch {
          // Proceed without fresh location — server degrades gracefully
        }

        // Clear cache for this day so next refresh gets fresh outfit
        try {
          await fetch(`${BASE}/api/outfit-cache/clear`, {
            method: "DELETE",
            credentials: "include",
          });
        } catch {
          // Cache clear failure is non-fatal
        }

        const token = await ensureFreshToken();
        const res = await fetch(`${BASE}/api/curations/${curationId}/regen`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ slot, timezone, lat, lon }),
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Regeneration failed");
        } else {
          const newSlots = data.data.slots as HydratedSlot[];
          setSlots(newSlots);

          // Refresh IndexedDB with the new slots
          const localDate = getUserLocalDate(timezone);
          const key = idbKey(userId, localDate, timezone);
          const existing = await get<IdbCacheEntry>(key);
          if (existing) {
            await set(key, { ...existing, slots: newSlots });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Regeneration failed";
        console.error("[Curation] regenerateSlot error:", msg);
        setError(msg);
      } finally {
        // ALWAYS reset loading state, regardless of success or failure
        setRegenLoadingSlot(null);
      }
    },
    [curationId, userId],
  );

  const dismissSlot = useCallback(
    async (slotIndex: number) => {
      if (!curationId || !userId) return;

      // Optimistically remove from local state
      setSlots((prev) => prev?.filter((_, i) => i !== slotIndex) ?? null);

      // Update IDB cache
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localDate = getUserLocalDate(timezone);
        const key = idbKey(userId, localDate, timezone);
        const existing = await get<IdbCacheEntry>(key);
        if (existing) {
          const updated = existing.slots.filter((_, i) => i !== slotIndex);
          await set(key, { ...existing, slots: updated });
        }
      } catch {
        // IDB update failure is non-fatal
      }

      // Persist to backend (slot numbers are 1-indexed)
      const slotNumber = (slotIndex + 1) as 1 | 2 | 3;
      try {
        const token = await ensureFreshToken();
        await fetch(`${BASE}/api/curations/${curationId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ dismissSlot: slotNumber }),
          credentials: "include",
        });
      } catch {
        // Backend failure is non-fatal — local state is already updated
      }
    },
    [curationId, userId],
  );

  return {
    slots,
    isLoading,
    error,
    curationId,
    fromCache,
    weatherSummary,
    weatherAvailable,
    reload,
    regenerateSlot,
    regenLoadingSlot,
    dismissSlot,
  };
}
