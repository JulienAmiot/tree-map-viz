/**
 * `dateAgeColor(iso, options?)` — picks the colour for a tile's
 * bottom-right timestamp based on **how old** the date is (SPEC §17.18,
 * simplified in §17.42).
 *
 * The motivation is purely UX: a glance at a wall of tiles should
 * tell you which numbers are *fresh* and which are *stale* without
 * reading any text. We map the age (in days) to a linear gradient
 * between two fixed endpoints:
 *
 *   - **0 days** (today) — bright off-white `rgb(245, 245, 245)`.
 *   - **`MAX_AGE_DAYS`** (30 d, kept from §17.22) and beyond — dark
 *     grey `rgb(64, 64, 64)`. Both endpoints pass WCAG AA against
 *     the kiosk's dark theme background; the dark grey is muted
 *     enough to read as "stale" without disappearing entirely.
 *
 * §17.42 retired the per-board fresh-date colour the §17.21 / §17.31
 * design carried (`Board.freshDateColor`, `--board-fresh`, the colour
 * picker on `<board-settings-modal>`, the `freshColor` option here).
 * The accent didn't earn its keep operationally — the kiosk's
 * monochrome dark theme already gives the timestamp enough visual
 * weight, and the per-board colour picker added a personalisation
 * surface that nobody used. Removing it lets the helper become a
 * pure function of `iso` (and `now` for tests), with no caller-side
 * configuration.
 *
 * The lerp is plain RGB (not OKLab) — the endpoints are both achromatic
 * grey, so a perceptual lerp wouldn't change the visual story. Future
 * dates (negative age) clamp to the fresh end so a freshly scheduled
 * measurement reads as "fresh" rather than "ancient".
 *
 * The function takes an explicit `now` so unit tests are
 * deterministic; callers in production omit it (defaults to
 * `new Date()`).
 */

export const MAX_AGE_DAYS = 30;

/**
 * Bright off-white at age = 0 days. `#F5F5F5` is just below pure white
 * (`#FFFFFF`) — easier on the eyes during long kiosk sessions, still
 * reads as "white" at a glance against the dark theme background.
 */
export const FRESH_RGB = { r: 245, g: 245, b: 245 } as const;

/**
 * Dark grey at age ≥ `MAX_AGE_DAYS`. `#404040` is muted enough to read
 * as "stale" without disappearing entirely against the kiosk's dark
 * theme.
 */
export const STALE_RGB = { r: 64, g: 64, b: 64 } as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface DateAgeColorOptions {
  /** Current time, defaults to `new Date()`. Pass for deterministic tests. */
  readonly now?: Date;
}

/**
 * Compute the date-age colour as an `rgb(r, g, b)` string. Returns
 * `currentColor` when the ISO is empty or unparseable (defensive —
 * callers usually skip rendering the timestamp at all in that case).
 */
export function dateAgeColor(
  iso: string,
  options: DateAgeColorOptions = {},
): string {
  const days = ageInDays(iso, options.now ?? new Date());
  if (days === null) {
    return "currentColor";
  }
  const t = clamp01(days / MAX_AGE_DAYS);
  const c = lerpRGB(FRESH_RGB, STALE_RGB, t);
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

/**
 * Days between `iso` and `now`, clamped to `≥ 0` (future dates count
 * as fresh = 0 days). Returns `null` when the ISO can't be parsed.
 */
export function ageInDays(iso: string, now: Date = new Date()): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const diff = now.getTime() - ms;
  if (diff <= 0) return 0;
  return diff / MS_PER_DAY;
}

function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}
