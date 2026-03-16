/**
 * Weather Tool — fetches current weather via Open-Meteo + city name via Nominatim.
 *
 * No API key required for either service.
 * Commercial use: subscribe to Open-Meteo's commercial plan (~€10/mo).
 */

import type { WeatherOutput, WeatherCondition } from "../shared/types";
import { wmoToCondition } from "../shared/types";

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

  const res = await fetch(url.toString());
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
}

// ── Nominatim reverse geocode ──────────────────────────────────────────────

async function fetchCityName(lat: number, lon: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AltFitApp/1.0 (contact@altfit.app)" },
    });
    if (!res.ok) return "your location";
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    return a.city ?? a.town ?? a.village ?? a.county ?? "your location";
  } catch {
    return "your location";
  }
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Fetches current weather conditions for the given coordinates.
 * Nominatim failures are non-fatal — city defaults to "your location".
 */
export async function getWeatherTool(
  lat: number,
  lon: number,
): Promise<WeatherOutput> {
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

  return {
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
}
