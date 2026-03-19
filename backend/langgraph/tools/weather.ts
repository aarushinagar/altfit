/**
 * Weather Tool — fetches current weather via Open-Meteo + city name via Nominatim.
 *
 * No API key required for either service.
 * Commercial use: subscribe to Open-Meteo's commercial plan (~€10/mo).
 */

import type { WeatherOutput, WeatherCondition } from "../shared/types";
import { wmoToCondition } from "../shared/types";

// ── Weather Cache (30-minute TTL) ──────────────────────────────────────────

const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const weatherCache = new Map<string, { data: WeatherOutput; timestamp: number }>();

function getCacheKey(lat: number, lon: number): string {
  // Round to 2 decimal places (~1km precision) to improve cache hit rate
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  return `${roundedLat},${roundedLon}`;
}

function getCachedWeather(lat: number, lon: number): WeatherOutput | null {
  const key = getCacheKey(lat, lon);
  const cached = weatherCache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > WEATHER_CACHE_TTL_MS) {
    weatherCache.delete(key);
    return null;
  }
  
  console.log(`[WeatherCache] ✅ HIT (age: ${Math.round(age / 1000)}s): ${key}`);
  return cached.data;
}

function setCachedWeather(lat: number, lon: number, data: WeatherOutput): void {
  const key = getCacheKey(lat, lon);
  weatherCache.set(key, { data, timestamp: Date.now() });
  console.log(`[WeatherCache] SET: ${key}`);
}

// ── Generic Indian weather fallback ────────────────────────────────────────

/**
 * Returns a generic fallback weather for India (defaults to mild Delhi-like conditions).
 * Used when real weather fetch fails or is unavailable.
 */
export function getGenericIndianWeatherFallback(
  cityName = "your location",
): WeatherOutput {
  return {
    temp_c: 25,
    feels_like_c: 26,
    condition: "cloudy" as WeatherCondition,
    wmo_code: 2, // WMO code for "cloudy"
    humidity_pct: 60,
    wind_kph: 12,
    uv_index: 6,
    is_daytime: true,
    city_name: cityName,
    iana_timezone: "Asia/Kolkata",
    description:
      "Mild and pleasant. Generic Indian weather—consider layers for morning/evening.",
    fetched_at_utc: new Date().toISOString(),
  };
}

// ── Open-Meteo fetch ───────────────────────────────────────────────────────

async function fetchOpenMeteo(lat: number, lon: number) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,uv_index,is_day",
  );
  url.searchParams.set("timezone", "auto"); // returns IANA timezone in response

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo error: HTTP ${res.status}`);
    return res.json() as Promise<{
      timezone: string;
      current: {
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        wind_speed_10m: number;
        weather_code: number;
        uv_index?: number;
        is_day: number;
      };
    }>;
  } finally {
    clearTimeout(timer);
  }
}

// ── Nominatim reverse geocode ──────────────────────────────────────────────

async function fetchCityName(lat: number, lon: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AltFitApp/1.0 (contact@altfit.app)" },
    });
    if (!res.ok) return "your location";
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    return a.city ?? a.town ?? a.village ?? a.county ?? "your location";
  } catch {
    return "your location";
  } finally {
    clearTimeout(timer);
  }
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Fetches current weather conditions for the given coordinates.
 * Results are cached by coordinate (rounded to 1km precision) for 30 minutes.
 * Nominatim failures are non-fatal — city defaults to "your location".
 */
export async function getWeatherTool(
  lat: number,
  lon: number,
): Promise<WeatherOutput> {
  // Check cache first
  const cached = getCachedWeather(lat, lon);
  if (cached) {
    return cached;
  }
  
  console.log(`[WeatherCache] MISS: ${getCacheKey(lat, lon)}`);
  
  const [weatherData, cityName] = await Promise.all([
    fetchOpenMeteo(lat, lon),
    fetchCityName(lat, lon),
  ]);

  const current = weatherData.current;
  const wmoCode = current.weather_code;
  const condition: WeatherCondition = wmoToCondition(wmoCode);
  const tempC = current.temperature_2m;
  const feelsLikeC = current.apparent_temperature;
  const windKph = current.wind_speed_10m;

  const result: WeatherOutput = {
    temp_c: tempC,
    feels_like_c: feelsLikeC,
    condition,
    wmo_code: wmoCode,
    humidity_pct: current.relative_humidity_2m,
    wind_kph: windKph,
    uv_index: current.uv_index ?? 0,
    is_daytime: current.is_day === 1,
    city_name: cityName,
    iana_timezone: weatherData.timezone,
    description: `${condition}, ${Math.round(tempC)}°C (feels ${Math.round(feelsLikeC)}°C), wind ${Math.round(windKph)} km/h in ${cityName}`,
    fetched_at_utc: new Date().toISOString(),
  };
  
  setCachedWeather(lat, lon, result);
  return result;
}
