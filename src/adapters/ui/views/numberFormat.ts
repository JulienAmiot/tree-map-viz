/**
 * SPEC §17.116 — uniform numeric formatting for every tile's value
 * glyph: **max two decimals, only if needed**.
 *
 * Pre-§17.116 the BSC `computedMean` branch and the §17.104 CBSN
 * card both rendered `value.toFixed(1)` (one trailing zero baked
 * in); the §17.104 plain `<computed-card>` rendered the raw
 * `value.value` (every digit JavaScript produced). The operator
 * asked for "max two decimal (only if needed)" — i.e. integers stay
 * integers, halves stay one-decimal, oddly-floating numbers cap at
 * two decimals.
 *
 * Examples:
 *   - 42          → "42"
 *   - 42.0        → "42"
 *   - 42.5        → "42.5"
 *   - 42.55       → "42.55"
 *   - 42.556      → "42.56"      (rounds half-away-from-zero, JS default)
 *   - 42.554      → "42.55"
 *   - 0.001       → "0"          (rounds to 0; expected behaviour)
 *   - -0          → "0"          (no signed-zero leak)
 *   - NaN / ±∞    → "—"          (defensive fallback; the mapper
 *                                  surfaces these as the `empty`
 *                                  branch which short-circuits to
 *                                  the §17.116 warning-fill render,
 *                                  but the helper is safe to call
 *                                  on any number-typed input).
 */

/** SPEC §17.116 — single source of truth for the rounding boundary. */
export const VALUE_MAX_DECIMALS = 2;

const ROUNDING_SCALE = 10 ** VALUE_MAX_DECIMALS;

export function formatValue(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * ROUNDING_SCALE) / ROUNDING_SCALE;
  // String(0) and String(-0) both yield "0" — no signed-zero leak.
  return rounded === 0 ? "0" : String(rounded);
}
