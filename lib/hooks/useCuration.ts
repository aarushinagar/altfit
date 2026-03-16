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
import { get, set } from "idb-keyval";
import { getAuthToken } from "@/lib/utils/authUtils";
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

async function requestGeolocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? "Location access denied. Enable location for weather-aware outfits."
              : `Location error: ${err.message}`,
          ),
        ),
      { timeout: 8_000, maximumAge: 60_000 },
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

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localDate = getUserLocalDate(timezone);
        const key = idbKey(userId!, localDate, timezone);

        // 1. IndexedDB cache
        const cached = await get<IdbCacheEntry>(key);
        if (cached && !cancelled) {
          setSlots(cached.slots);
          setCurationId(cached.curationId);
          setWeatherSummary(cached.weatherSummary);
          setFromCache(true);
          setIsLoading(false);
          return;
        }

        // 2. Geolocation
        let lat = 0,
          lon = 0;
        try {
          ({ lat, lon } = await requestGeolocation());
        } catch (geoErr) {
          if (!cancelled) {
            setError((geoErr as Error).message);
            setIsLoading(false);
          }
          return;
        }

        // 3. API call
        const token = getAuthToken();
        const res = await fetch(`${BASE}/api/curations/today`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ lat, lon, timezone }),
          credentials: "include",
        });

        const data = await res.json();

        if (cancelled) return;

        if (!res.ok || !data.success) {
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

        // 4. Store in IndexedDB
        if (newId) {
          await set(key, {
            slots: newSlots,
            curationId: newId,
            weatherSummary: summary,
          } satisfies IdbCacheEntry);
        }

        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
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

        const token = getAuthToken();
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
          return;
        }

        const newSlots = data.data.slots as HydratedSlot[];
        setSlots(newSlots);

        // Refresh IndexedDB with the new slots
        const localDate = getUserLocalDate(timezone);
        const key = idbKey(userId, localDate, timezone);
        const existing = await get<IdbCacheEntry>(key);
        if (existing) {
          await set(key, { ...existing, slots: newSlots });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Regeneration failed");
      } finally {
        setRegenLoadingSlot(null);
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
  };
}
