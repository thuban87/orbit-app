/**
 * Date utility functions for Orbit plugin.
 *
 * Always use formatLocalDate() instead of toISOString().split('T')[0]
 * to avoid UTC off-by-one bugs near midnight.
 */

/**
 * Returns local YYYY-MM-DD string.
 *
 * Uses the local timezone — avoids the UTC off-by-one that
 * toISOString().split('T')[0] produces for evening hours.
 *
 * @param date - Date to format (defaults to now)
 * @returns String in YYYY-MM-DD format
 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
