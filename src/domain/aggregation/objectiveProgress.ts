/**
 * Objective-progress helpers — pure math for the §17.40 / §17.41 /
 * §17.44 BSC tile rendering.
 *
 * Five concerns share this module because they all collapse to the
 * same `(min, target, value)` signature and all consume the same
 * `Objective` shape:
 *
 *  1. {@link gradientPositionFraction} — where `current` sits between
 *     `min` and `target`, expressed as `[0, 1]`. Direction-agnostic:
 *     ascending (`min < target`, e.g. *increase NPS to 50*) and
 *     descending (`min > target`, e.g. *reduce p99 latency to 200 ms*)
 *     both read off the same formula.
 *
 *  2. {@link linearRegressionPrediction} / {@link linearRegressionSlope}
 *     / {@link deadlineShortfall} — least-squares fit through the
 *     BSC's recorded history. The two §17.40 / §17.41 / §17.44
 *     consumers are:
 *       - the deadline-risk warning (`deadlineShortfall` — extrapolate
 *         to `targetDate`, returns `1 - gradientPositionFraction(predicted,
 *         min, target)` clamped to `[0, 1]`; `0` means the trend reaches
 *         target — no warning; `(0, 1]` is the deviation magnitude that
 *         drives §17.44's yellow → orange → red gradient on the warning
 *         glyph);
 *       - the trend arrow (§17.41 — the slope normalised against the
 *         "rate required to land at target by deadline" gives a single
 *         direction-agnostic `progressRate`, quantised to a 5-bucket
 *         arrow palette).
 *     Both share the same private {@link regressionFit} so the math
 *     is computed once and the two surfaces stay consistent.
 *
 *  3. {@link progressRate} + {@link trendArrowFromRate} — §17.41 — the
 *     normalised slope (in *gradient-fraction per timeline-fraction*)
 *     and its quantisation into one of `up | up-right | right |
 *     down-right | down`. `progressRate = 1` means "exactly the rate
 *     required to land at target by the deadline"; `0` means flat;
 *     `< 0` means regressing. Direction-agnostic via the same sign-
 *     cancellation trick `gradientPositionFraction` uses.
 *
 *  4. {@link gradientColorAt} — the CSS colour at a given fraction
 *     along the four-stop red → orange → yellow → green ramp the BSC
 *     value uses. Linear RGB interpolation between the four stops;
 *     saturates at the endpoints when the input falls outside
 *     `[0, 1]`. The stops are the "bright" end of each hue family so
 *     the gradient reads at-a-glance on the dark kiosk theme.
 *
 *  5. {@link warningGradientColorAt} (§17.44) — the CSS colour for the
 *     deadline-risk warning glyph along a three-stop yellow → orange
 *     → red ramp keyed to the *deviation magnitude* (the same
 *     `deadlineShortfall` value, in `(0, 1]`). Lowest deviation
 *     (operator just barely below trajectory) reads yellow; highest
 *     (predicted to fall back to `min` or worse) reads red. Returns
 *     `""` for inputs `<= 0` so the mapper can use a single field
 *     (`warningColor`) to encode both *whether* and *how* to render
 *     the warning.
 *
 * Lives under `domain/aggregation/` because it is pure number-and-date
 * math with no I/O or DOM dependency, sharing the directory with
 * `computedValue` and `currentValueDate` which it complements (those
 * answer "what number / date to show on the tile?", this one answers
 * "how is the tile doing relative to its objective?"). Adapter-layer
 * code (`viewModelMapper`) is the single consumer today.
 *
 * Numeric only: every Objective in the kiosk's BSC card is
 * parameterised by `T = number` in practice (see SPEC §3 — value type
 * is the unit's scale), and the objective's `initialValue` /
 * `targetValue` come from the same domain. The helpers narrow `T` to
 * `number` at the call site; a non-numeric Objective is rejected at
 * the mapper boundary.
 */

/**
 * Direction-agnostic "progress fraction" along the min → target line.
 *
 *   - `0` → `current` is at (or past) `min` in the wrong direction.
 *   - `1` → `current` is at (or past) `target`.
 *   - In-between → linear position along the segment.
 *
 * Works uniformly for ascending and descending objectives because the
 * sign of `target - min` and `current - min` cancel. Saturates at
 * `[0, 1]` so an overachiever (current beyond target) and an off-the-
 * floor underperformer (current beyond min in the wrong direction)
 * collapse to the gradient's endpoints rather than producing a colour
 * outside the four-stop ramp.
 *
 * Edge cases:
 *   - `min === target`: the segment has zero length; treat as "matched"
 *     when `current === target`, "missed" otherwise. The kiosk's BSC
 *     editor today does not allow saving an objective with `min ===
 *     target`, but the helper is defensive against pre-existing data.
 *   - Any input is `NaN` / non-finite: returns `0` (red — fail closed
 *     so a malformed objective lights up rather than silently rendering
 *     as green).
 */
export function gradientPositionFraction(
  current: number,
  min: number,
  target: number,
): number {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(min) ||
    !Number.isFinite(target)
  ) {
    return 0;
  }
  if (min === target) {
    return current === target ? 1 : 0;
  }
  const raw = (current - min) / (target - min);
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return raw;
}

/**
 * One historized entry, in the shape the regression helpers consume.
 *
 * The mapper translates `TimestampedValue<T>` into this plain shape so
 * the helpers stay free of domain types (the directory rule allows it
 * either way, but pure-data inputs make the helpers trivially testable
 * without value-object construction boilerplate).
 */
export type HistoryPoint = {
  readonly dateMs: number;
  readonly value: number;
};

/**
 * Least-squares fit `y = slope · t + intercept` through the given
 * historized entries (private — both `linearRegressionPrediction` and
 * `linearRegressionSlope` go through this so the math is shared).
 *
 * Returns `null` (no defined trend) when:
 *   - fewer than 2 finite entries are available;
 *   - all entries share a single timestamp (zero variance in time —
 *     slope is mathematically undefined; can happen if the operator
 *     records two values on the same calendar day with the same
 *     `asOf`).
 *
 * Closed-form least squares; no external numerics dependency.
 * Numerical stability is fine for the kiosk's data scale (history
 * rarely exceeds a few hundred entries; timestamps are ms-since-epoch
 * which fits comfortably in IEEE-754 double).
 */
function regressionFit(
  history: readonly HistoryPoint[],
): { slope: number; intercept: number } | null {
  // Defensive filter: drop any non-finite entry rather than poison
  // the regression with NaN.
  const points = history.filter(
    (p) => Number.isFinite(p.dateMs) && Number.isFinite(p.value),
  );
  if (points.length < 2) return null;
  const n = points.length;
  let tSum = 0;
  let ySum = 0;
  for (const p of points) {
    tSum += p.dateMs;
    ySum += p.value;
  }
  const tBar = tSum / n;
  const yBar = ySum / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    const dt = p.dateMs - tBar;
    num += dt * (p.value - yBar);
    den += dt * dt;
  }
  // Zero variance in time → degenerate (all entries share the same
  // timestamp). No defined slope.
  if (den === 0) return null;
  const slope = num / den;
  const intercept = yBar - slope * tBar;
  return { slope, intercept };
}

/**
 * Least-squares linear regression of `value` over `dateMs` through the
 * given historized entries, evaluated at `atDateMs`.
 *
 * Returns `null` (no defined trend) under the same conditions as
 * {@link regressionFit} — fewer than 2 finite entries, or all entries
 * sharing a single timestamp.
 */
export function linearRegressionPrediction(
  history: readonly HistoryPoint[],
  atDateMs: number,
): number | null {
  if (!Number.isFinite(atDateMs)) return null;
  const fit = regressionFit(history);
  if (fit === null) return null;
  return fit.slope * atDateMs + fit.intercept;
}

/**
 * §17.41 — least-squares slope of the BSC's recorded history (value
 * units per millisecond). Returns `null` for the same conditions as
 * {@link linearRegressionPrediction}.
 *
 * Exposed so consumers that only need the rate of change (e.g.
 * `progressRate`) don't have to evaluate the line at two points and
 * subtract; this is the same `slope` field {@link regressionFit}
 * already computes.
 */
export function linearRegressionSlope(
  history: readonly HistoryPoint[],
): number | null {
  const fit = regressionFit(history);
  return fit === null ? null : fit.slope;
}

/**
 * §17.44 — "How far short of target will the operator's trend land?"
 *
 * Continuous magnitude version of the §17.40-amended off-track
 * warning rule. The pre-§17.44 boolean `predictedToMissDeadline` only
 * answered *whether* a warning should fire; §17.44's gradient-tinted
 * warning glyph (yellow → orange → red on the right of the target
 * date) needs the *deviation magnitude* too. One helper now produces
 * both: the boolean is `deadlineShortfall(...) > 0`, the magnitude
 * is the value itself.
 *
 * Returns a number in `[0, 1]`:
 *   - `0` — no warning. Either the deadline has already passed
 *     (`now >= targetDate`), the history has too few distinct-time
 *     entries to define a trend, the inputs are malformed (any NaN /
 *     non-finite endpoint), or the regression-extrapolated value at
 *     `targetDate` reaches (or surpasses) the target. The mapper
 *     translates `0` into `warningColor: ""` — no glyph rendered.
 *   - `(0, 1]` — `1 - gradientPositionFraction(predicted, min, target)`.
 *     `0+` means "barely short" (yellow on the §17.44 ramp); `1`
 *     means "predicted to land at `min` or worse" (red).
 *
 * Direction-agnostic via `gradientPositionFraction`: ascending
 * (predicted < target) and descending (predicted > target) objectives
 * both collapse to the same shortfall value. Catches the "overachiever-
 * but-trending-back-down" case the §17.40 amendment opted into: a
 * current value past target whose recent slope reverses past the line
 * is caught by the regression's prediction at the deadline.
 */
export function deadlineShortfall(
  history: readonly HistoryPoint[],
  min: number,
  target: number,
  targetDateMs: number,
  nowMs: number,
): number {
  if (
    !Number.isFinite(targetDateMs) ||
    !Number.isFinite(nowMs) ||
    !Number.isFinite(min) ||
    !Number.isFinite(target)
  ) {
    return 0;
  }
  if (nowMs >= targetDateMs) return 0;
  const predicted = linearRegressionPrediction(history, targetDateMs);
  if (predicted === null) return 0;
  const fraction = gradientPositionFraction(predicted, min, target);
  // gradientPositionFraction already clamps to [0, 1], so the
  // shortfall is naturally in the same range without a second clamp.
  if (fraction >= 1) return 0;
  return 1 - fraction;
}

/**
 * §17.41 — direction-agnostic *progress rate* of the BSC's recorded
 * history.
 *
 * Returns the regression slope expressed in "gradient-fraction per
 * timeline-fraction":
 *   - **gradient-fraction** is `(value − min) / (target − min)` — the
 *     same fraction `gradientPositionFraction` produces; `+1` means
 *     the value reached the target, `0` means it sits at `min`.
 *   - **timeline-fraction** is `(t − firstDateMs) / (targetDateMs −
 *     firstDateMs)` — `+1` means the deadline arrived. `firstDateMs`
 *     is the earliest historized entry's date (computed from the
 *     `history` argument; the helper does NOT require the history to
 *     be sorted).
 *
 * Reading the result:
 *   - `1`  — perfectly on track (the steady rate that lands at target
 *     by deadline).
 *   - `> 1` — faster than required.
 *   - `0`  — flat (no progress in either direction).
 *   - `< 0` — regressing (moving away from target).
 *
 * Direction-agnostic: for a descending objective (`target < min`), a
 * value dropping toward target produces a NEGATIVE regression slope
 * AND a NEGATIVE `(target − min)`; the negatives cancel and the
 * `progressRate` comes out positive (operator-friendly: "moving
 * toward target = positive rate"). The same trick `gradient
 * PositionFraction` uses.
 *
 * Returns `null` (no defined rate) when:
 *   - the regression itself is undefined (single-entry history, all-
 *     same-timestamp history — see {@link regressionFit});
 *   - the objective endpoints are degenerate (`min === target`,
 *     non-finite `min` / `target` / `targetDateMs`);
 *   - the timeline is degenerate (earliest history date equals
 *     `targetDateMs` — would divide by zero).
 *
 * The mapper uses this rate together with {@link trendArrowFromRate}
 * to bake a quantised arrow direction into the BSC view-model.
 */
export function progressRate(
  history: readonly HistoryPoint[],
  min: number,
  target: number,
  targetDateMs: number,
): number | null {
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(target) ||
    !Number.isFinite(targetDateMs)
  ) {
    return null;
  }
  if (min === target) return null;
  const points = history.filter(
    (p) => Number.isFinite(p.dateMs) && Number.isFinite(p.value),
  );
  if (points.length === 0) return null;
  let firstDateMs = points[0]!.dateMs;
  for (const p of points) {
    if (p.dateMs < firstDateMs) firstDateMs = p.dateMs;
  }
  if (firstDateMs === targetDateMs) return null;
  const slope = linearRegressionSlope(points);
  if (slope === null) return null;
  // requiredRate is gradient-fraction per millisecond required to
  // land at the target by the deadline starting from the first
  // historized entry. Its sign matches `(target − min)` — for
  // descending objectives it is negative, which is exactly what
  // makes the final ratio direction-agnostic.
  const requiredRate = (target - min) / (targetDateMs - firstDateMs);
  if (requiredRate === 0) return null;
  return slope / requiredRate;
}

/**
 * §17.41 — quantised trend-arrow direction.
 *
 * The 5 buckets along the vertical (1D) axis of the 8-compass-arrow
 * palette. `up` ↑, `up-right` ↗, `right` →, `down-right` ↘, `down` ↓.
 * The remaining 3 compass arrows (`←`, `↙`, `↖`) have no meaning in a
 * 1D rate signal — the half-circle ↑↗→↘↓ covers every distinguishable
 * state of "are we moving toward target, and how fast vs the rate
 * required to land by deadline?".
 */
export type TrendArrow = "up" | "up-right" | "right" | "down-right" | "down";

/**
 * §17.41 — quantise a normalised {@link progressRate} into one of 5
 * trend-arrow buckets.
 *
 * Bucket boundaries (chosen to give the operator 5 clearly-distinct
 * states with finer resolution near "on-track" — the band the
 * operator most cares about reading at-a-glance):
 *
 * | rate                  | arrow         | meaning                        |
 * | --------------------- | ------------- | ------------------------------ |
 * | `>= 1.5`              | `up`          | well ahead of schedule         |
 * | `0.5 <= r < 1.5`      | `up-right`    | on or near track               |
 * | `-0.5 < r < 0.5`      | `right`       | flat — barely any progress     |
 * | `-1.5 <= r <= -0.5`   | `down-right`  | slight regression              |
 * | `< -1.5`              | `down`        | significant regression         |
 *
 * The thresholds carve a symmetric `1.0`-wide *on-track band* around
 * the "exactly required rate" point (`r = 1`) — the operator reads ↑
 * for "well ahead", ↗ for "on or near track", and the boundary
 * matches the spec's intent that `r = 1` is the canonical "good"
 * trajectory. The flat band around `0` is the same `1.0`-wide window
 * so a near-zero noisy slope (e.g. measurement jitter on a stable
 * metric) reads as → rather than alternating between ↗ and ↘ on
 * every refresh.
 *
 * `NaN` / non-finite input collapses to `right` defensively (treat
 * "no usable rate" as flat). The mapper, however, prefers to skip
 * rendering the arrow entirely when the rate is `null` — see the
 * §17.41 view-model mapping.
 */
export function trendArrowFromRate(rate: number): TrendArrow {
  if (!Number.isFinite(rate)) return "right";
  if (rate >= 1.5) return "up";
  if (rate >= 0.5) return "up-right";
  if (rate > -0.5) return "right";
  if (rate >= -1.5) return "down-right";
  return "down";
}

/**
 * Four-stop red → orange → yellow → green CSS colour ramp.
 *
 * The stops are the "bright" end of each hue family so the gradient
 * has good contrast against the dark kiosk theme. Linear RGB
 * interpolation between adjacent stops; the gamut is the same on
 * Windows / Mac / iOS / Android (sRGB-ish) so the visual reads
 * consistently across kiosks.
 *
 * Inputs outside `[0, 1]` saturate at the endpoints — the caller is
 * expected to feed `gradientPositionFraction` here (which already
 * clamps), but the second clamp protects against floating-point
 * residue at the boundaries.
 */
export function gradientColorAt(fraction: number): string {
  const f = Math.max(0, Math.min(1, fraction));
  // Stop positions: 0, 1/3, 2/3, 1. Stop colours: red, orange, yellow,
  // green. Bright end of each hue family.
  const stops: readonly { at: number; rgb: readonly [number, number, number] }[] = [
    { at: 0, rgb: [220, 38, 38] }, // #dc2626 — bright red
    { at: 1 / 3, rgb: [234, 88, 12] }, // #ea580c — bright orange
    { at: 2 / 3, rgb: [250, 204, 21] }, // #facc15 — bright yellow
    { at: 1, rgb: [22, 163, 74] }, // #16a34a — bright green
  ];
  // Find the segment [lo, hi] containing f. The four stops give three
  // segments; binary search would be overkill at N=4.
  let lo = stops[0]!;
  let hi = stops[stops.length - 1]!;
  for (let i = 0; i < stops.length - 1; i++) {
    if (f >= stops[i]!.at && f <= stops[i + 1]!.at) {
      lo = stops[i]!;
      hi = stops[i + 1]!;
      break;
    }
  }
  if (lo.at === hi.at) {
    return rgbString(lo.rgb);
  }
  const t = (f - lo.at) / (hi.at - lo.at);
  const r = Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t);
  const g = Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t);
  const b = Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbString(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * §17.44 — three-stop yellow → orange → red CSS colour ramp keyed to
 * the deadline-shortfall magnitude.
 *
 * Operator-facing semantic: "lowest deviation = yellow, highest
 * deviation = red". The stops are deliberately the same RGB triplets
 * as the value's §17.40 four-stop ramp (bright yellow `#facc15`,
 * bright orange `#ea580c`, bright red `#dc2626`) so the warning hue
 * sits in the same family as the value glyph it accompanies — a
 * red-tinted warning next to a red-tinted value reads as "the metric
 * is red AND the trajectory is red", reinforcing rather than
 * competing with the value's signal.
 *
 * The ramp is direction-agnostic (consumes a magnitude, not a signed
 * deviation) and always reads "more = worse": the operator does not
 * need to know whether the objective is ascending or descending to
 * decode the colour.
 *
 * Inputs:
 *   - `<= 0` → `""` (the empty string). The mapper uses this single
 *     field to encode both *whether* the warning renders and *how*:
 *     empty = no glyph, non-empty = render with that colour. Mirrors
 *     the §17.21 / §17.40 convention for `dateColor` / `valueColor`.
 *   - `(0, 1]` → linear RGB interpolation between the three stops.
 *   - `> 1` (defensive) → saturates at red.
 */
export function warningGradientColorAt(shortfall: number): string {
  if (!Number.isFinite(shortfall) || shortfall <= 0) return "";
  const f = Math.min(1, shortfall);
  const stops: readonly { at: number; rgb: readonly [number, number, number] }[] = [
    { at: 0, rgb: [250, 204, 21] }, // #facc15 — bright yellow (lowest deviation)
    { at: 0.5, rgb: [234, 88, 12] }, // #ea580c — bright orange
    { at: 1, rgb: [220, 38, 38] }, // #dc2626 — bright red (highest deviation)
  ];
  let lo = stops[0]!;
  let hi = stops[stops.length - 1]!;
  for (let i = 0; i < stops.length - 1; i++) {
    if (f >= stops[i]!.at && f <= stops[i + 1]!.at) {
      lo = stops[i]!;
      hi = stops[i + 1]!;
      break;
    }
  }
  if (lo.at === hi.at) return rgbString(lo.rgb);
  const t = (f - lo.at) / (hi.at - lo.at);
  const r = Math.round(lo.rgb[0] + (hi.rgb[0] - lo.rgb[0]) * t);
  const g = Math.round(lo.rgb[1] + (hi.rgb[1] - lo.rgb[1]) * t);
  const b = Math.round(lo.rgb[2] + (hi.rgb[2] - lo.rgb[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
