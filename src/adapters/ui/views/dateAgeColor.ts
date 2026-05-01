/**
 * `dateAgeColor(iso, options?)` — picks the colour for a tile's
 * bottom-right timestamp based on **how old** the date is (SPEC §17.18,
 * extended in §17.21 with a board-level fresh colour).
 *
 * The motivation is purely UX: a glance at a wall of tiles should
 * tell you which numbers are *fresh* and which are *stale* without
 * reading any text. We map the age (in days) to a linear gradient
 * between two endpoints:
 *
 *   - **0 days** (today) — the *fresh* colour. Defaults to the warm
 *     orange `rgb(255, 145, 50)` SPEC §17.18 originally pinned, but
 *     callers can pass a board-level override (the showcase board
 *     uses a deep purple `#743089`; an "alert" board could use red,
 *     etc.).
 *   - **`MAX_AGE_DAYS`** (default 30 d, refined in §17.22 from the
 *     prior 180 d) and beyond — the *cold* colour. Computed
 *     dynamically as a **very desaturated, slightly lightened**
 *     version of the fresh colour (same hue, S ≈ 6 %, L ≈ 70 %). So
 *     an orange fades to a warm-leaning grey, a green fades to a
 *     green-leaning grey, etc. The hue link keeps a wall of tiles
 *     visually coherent across the freshness gradient instead of
 *     crossing through unrelated hues. The 30-day window matches the
 *     kiosk's monthly review cadence — a tile that hasn't been
 *     touched in a month reads as "stale".
 *
 * The lerp is plain RGB (not OKLab) — both endpoints typically pass
 * WCAG AA against the kiosk's dark theme background and a perceptual
 * lerp wouldn't change the contrast story. Future dates (negative
 * age) clamp to the fresh end so a freshly scheduled measurement
 * reads as "fresh" rather than "ancient".
 *
 * The function takes an explicit `now` so unit tests are
 * deterministic; callers in production omit it (defaults to
 * `new Date()`).
 *
 * Input colour formats accepted: `#rgb`, `#rrggbb`, `rgb(r, g, b)`.
 * Anything else falls back to the default warm orange (and we never
 * throw — a typo'd board colour shouldn't crash the kiosk).
 */

export const MAX_AGE_DAYS = 30;

/** Default fresh-end colour when the caller doesn't pass one (back-compat with §17.18). */
export const DEFAULT_FRESH_COLOR = "rgb(255, 145, 50)";

const DEFAULT_FRESH_RGB: RGB = { r: 255, g: 145, b: 50 };

/**
 * Cold-endpoint saturation (HSL S ≈ 6 %) — close enough to grey that
 * the residual hue is a tint, not a colour.
 */
const COLD_SATURATION = 0.06;

/**
 * Cold-endpoint lightness (HSL L ≈ 70 %) — readable against the
 * dark kiosk background; pinned by the §17.21 unit tests.
 */
const COLD_LIGHTNESS = 0.7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface HSL {
  /** Hue in [0, 360). */
  readonly h: number;
  /** Saturation in [0, 1]. */
  readonly s: number;
  /** Lightness in [0, 1]. */
  readonly l: number;
}

export interface DateAgeColorOptions {
  /** Current time, defaults to `new Date()`. Pass for deterministic tests. */
  readonly now?: Date;
  /**
   * Board-level fresh-end colour. Accepted formats: `#rgb`, `#rrggbb`,
   * `rgb(r, g, b)`. Defaults to {@link DEFAULT_FRESH_COLOR} (warm
   * orange — back-compat with §17.18). Unparseable values silently
   * fall back to the default rather than throw.
   */
  readonly freshColor?: string;
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
  const fresh = parseColor(options.freshColor) ?? DEFAULT_FRESH_RGB;
  const cold = desaturate(fresh);
  const t = clamp01(days / MAX_AGE_DAYS);
  const c = lerpRGB(fresh, cold, t);
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

/**
 * Convert a colour to its desaturated/greyish counterpart while keeping
 * the same hue. Exported for testing the §17.21 contract directly; the
 * lerp result at age = MAX_AGE_DAYS equals this value.
 */
export function desaturatedCounterpart(rgbInput: string): string {
  const rgb = parseColor(rgbInput) ?? DEFAULT_FRESH_RGB;
  const cold = desaturate(rgb);
  return `rgb(${cold.r}, ${cold.g}, ${cold.b})`;
}

function desaturate(rgb: RGB): RGB {
  const hsl = rgbToHsl(rgb);
  // Same hue, near-zero saturation, lifted lightness ⇒ "very
  // desaturated/greyish color of the same hue" (SPEC §17.21).
  return hslToRgb({ h: hsl.h, s: COLD_SATURATION, l: COLD_LIGHTNESS });
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

// — Colour parsing — //

const RGB_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
const HEX6_RE = /^#([0-9a-f]{6})$/i;
const HEX3_RE = /^#([0-9a-f]{3})$/i;

/** Parse `#rgb`, `#rrggbb`, or `rgb(r, g, b)` into an RGB triple, or `null`. */
function parseColor(input: string | undefined): RGB | null {
  if (!input) return null;
  const s = input.trim();
  const m6 = HEX6_RE.exec(s);
  if (m6) {
    const hex = m6[1]!;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  const m3 = HEX3_RE.exec(s);
  if (m3) {
    const hex = m3[1]!;
    const r = parseInt(hex[0]!.repeat(2), 16);
    const g = parseInt(hex[1]!.repeat(2), 16);
    const b = parseInt(hex[2]!.repeat(2), 16);
    return { r, g, b };
  }
  const mr = RGB_RE.exec(s);
  if (mr) {
    return {
      r: clampByte(parseInt(mr[1]!, 10)),
      g: clampByte(parseInt(mr[2]!, 10)),
      b: clampByte(parseInt(mr[3]!, 10)),
    };
  }
  return null;
}

function clampByte(x: number): number {
  if (x <= 0) return 0;
  if (x >= 255) return 255;
  return x;
}

// — RGB ↔ HSL — //

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
        break;
    }
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = ((h % 360) + 360) % 360 / 360;
  const r = hueToRgb(p, q, hk + 1 / 3);
  const g = hueToRgb(p, q, hk);
  const b = hueToRgb(p, q, hk - 1 / 3);
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function hueToRgb(p: number, q: number, t: number): number {
  let tn = t;
  if (tn < 0) tn += 1;
  if (tn > 1) tn -= 1;
  if (tn < 1 / 6) return p + (q - p) * 6 * tn;
  if (tn < 1 / 2) return q;
  if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
  return p;
}
