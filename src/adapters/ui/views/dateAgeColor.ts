/**
 * `dateAgeColor(iso, now?)` — picks the colour for a tile's
 * bottom-right timestamp based on **how old** the date is (SPEC
 * §17.18).
 *
 * The motivation is purely UX: a glance at a wall of tiles should
 * tell you which numbers are *fresh* and which are *stale* without
 * reading any text. We map the age (in days) to a linear gradient:
 *
 *   - **0 days** (today) — bright/warm orange `rgb(255, 145, 50)`.
 *   - **`MAX_AGE_DAYS`** (default 180 d) and beyond — cold/pale blue
 *     `rgb(140, 180, 220)`. Past this point the colour saturates so
 *     a 6-month-old measurement and a 5-year-old one look the same;
 *     the user only cares "is this from this season or not".
 *
 * The lerp is plain RGB (not OKLab) — both endpoints pass WCAG AA
 * (≥ 4.5:1) against the kiosk's dark theme background (`~#0c0f14`)
 * and a perceptual lerp wouldn't change the contrast story. Future
 * dates (negative age) clamp to the warm-orange end so a freshly
 * scheduled measurement reads as "fresh" rather than "ancient".
 *
 * The function takes an explicit `now` so unit tests are
 * deterministic; callers in production omit it (defaults to
 * `new Date()`).
 */

export const MAX_AGE_DAYS = 180;

const WARM_ORANGE: RGB = { r: 255, g: 145, b: 50 };
const COLD_PALE_BLUE: RGB = { r: 140, g: 180, b: 220 };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function dateAgeColor(iso: string, now: Date = new Date()): string {
  const days = ageInDays(iso, now);
  if (days === null) {
    // Unparseable / empty ISO → fall back to a neutral colour. The
    // caller will usually skip rendering the timestamp altogether
    // when the date is missing, so this branch is mostly defensive.
    return "currentColor";
  }
  const t = clamp01(days / MAX_AGE_DAYS);
  const c = lerpRGB(WARM_ORANGE, COLD_PALE_BLUE, t);
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
