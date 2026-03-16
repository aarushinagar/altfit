/**
 * Timezone utilities for daily curation cache key generation.
 *
 * The curation cache is keyed on (userId, localDate, userTimezone) — a tuple
 * that ensures each user gets exactly one curation per calendar day in their
 * own timezone, even when deployed in a different UTC region.
 */

/**
 * Returns the current local date for the given IANA timezone as a "YYYY-MM-DD" string.
 *
 * Example: getUserLocalDate("America/New_York") → "2025-07-14"
 */
export function getUserLocalDate(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      // en-CA uses ISO YYYY-MM-DD ordering natively
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    // Fallback: UTC date
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Returns the Unix timestamp (ms) for midnight at the start of the current
 * local date in the given timezone. Useful for cache TTL calculations.
 *
 * Example: getLocalMidnightTimestamp("Asia/Tokyo") → 1752508800000
 */
export function getLocalMidnightTimestamp(timezone: string): number {
  const localDate = getUserLocalDate(timezone);
  // Parse as local midnight by constructing a Date in that timezone
  return new Date(`${localDate}T00:00:00`).getTime();
}
