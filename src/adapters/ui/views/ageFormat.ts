/**
 * SPEC §17.116 — bottom-right tile timestamp moves from a locale-
 * formatted date to a human-readable **age** expressed in years,
 * months, and days, with every zero component suppressed
 * ("don't display 0 value").
 *
 * Examples (now = 2026-05-17 by default):
 *   - one day ago     → "1 day"
 *   - 5 days ago      → "5 days"
 *   - 1 month exactly → "1 month"
 *   - 1y 2m 3d ago    → "1 year 2 months 3 days"
 *   - 2 years exactly → "2 years"
 *   - 0 days (today)  → "today"
 *
 * Algorithm: walk the calendar from `iso` forward one component at a
 * time (years → months → days) using the same field-borrow rules a
 * human accountant uses. This avoids the off-by-one drift a naive
 * `Math.floor(deltaMs / msPerYear)` produces around month-length
 * boundaries (the BSC tile's age signal is consumed at a glance, and
 * "1 year" should not flip to "11 months" on the 365th day of a
 * leap-adjacent metric).
 *
 * Future-dated inputs render as `"today"` (operator-visible policy:
 * an entry timestamped tomorrow is treated as fresh — the kiosk
 * clock can drift a few seconds across the timezone boundary, and
 * surfacing "-1 day" would be more confusing than reading the value
 * as just-recorded).
 */

const SINGULAR = (n: number, unit: string): string =>
  `${n} ${unit}${n === 1 ? "" : "s"}`;

/**
 * Format the age between `iso` and `now` as a year/month/day phrase
 * with zero components stripped. Returns `"today"` when every
 * component is zero (same-day timestamp) or when the input parses
 * to NaN — the latter is a defensive fallback (the view layer
 * should never feed an invalid ISO here, but if it does we keep
 * rendering a tile rather than a broken `NaN years` glyph).
 *
 * The walk-the-calendar approach (vs. dividing milliseconds by
 * average year / month lengths) is what makes "1 year 0 months 0
 * days" possible on the actual 1-year anniversary instead of
 * landing at "364 days" or "1 year 12 days".
 */
export function formatAge(iso: string, now: Date = new Date()): string {
  const past = new Date(Date.parse(iso));
  if (Number.isNaN(past.getTime())) return "today";
  if (past.getTime() >= now.getTime()) return "today";

  let years = now.getFullYear() - past.getFullYear();
  let months = now.getMonth() - past.getMonth();
  let days = now.getDate() - past.getDate();

  if (days < 0) {
    // Borrow a month: how many days were in the month preceding
    // `now`? (calendar-aware so February / 31-day boundaries work).
    const borrowedMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += borrowedMonth.getDate();
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(SINGULAR(years, "year"));
  if (months > 0) parts.push(SINGULAR(months, "month"));
  if (days > 0) parts.push(SINGULAR(days, "day"));
  return parts.length === 0 ? "today" : parts.join(" ");
}
