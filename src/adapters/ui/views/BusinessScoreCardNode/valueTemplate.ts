/**
 * Value-area template shared by `<business-score-card-as-parent>` and
 * `<business-score-card-as-child>` (SPEC §5 + §17.14 — Field-content rules).
 *
 * The template returns the **inner** content of the `.value` slot (which
 * the parent element wraps with `<div class="value-area">`); the outer
 * tile layout (title row, bottom-right timestamp slot, value-fills-tile
 * box) is owned by the per-role element so the layout rules stay in one
 * place per tile (SPEC §17.14: title height = `3vh`, value font fills
 * the tile via `cqmin`, unit = 1/3 of value; SPEC §17.18: timestamp
 * lives in the bottom-right corner).
 *
 * Mapping (unchanged from §17.9 / §17.12 — only the visual size changes):
 *
 *  | VM `value.kind`        | Renders inside `.value-area`                            |
 *  | --- | --- |
 *  | `computedMean`         | `<mean>.toFixed(1)` + `<unit>` (1/3 size) + `Σ` badge   |
 *  | `recordedValue`        | `<value>` + `<unit>` (1/3 size) — date in tile corner   |
 *  | `childrenCount` (n>0)  | `<n> children` plain text — no `Σ`, no `Unit` (§13.2)   |
 *  | `childrenCount` (n=0)  | empty value area (§12.3 `views/computed_aggregation`)   |
 *
 * SPEC §17.40 — every BSC value branch except the empty
 * `childrenCount` n=0 branch now also renders a `.target-row` under
 * the value (target icon + target value + unit + target date) and
 * paints the value (+ its unit) with the gradient-colour the mapper
 * baked at `vm.objective.valueColor`. The colour is applied via the
 * `--bsc-value-color` custom property on the `.value` element itself
 * (the shared `tileLayoutStyles.value { color: var(--bsc-value-color,
 * currentColor) }` rule reads it). Inline-style application keeps
 * the colour math out of the template — pure consumer of the VM.
 */

import { html, nothing, type TemplateResult } from "lit";

import type { BusinessScoreCardNodeViewModel } from "../NodeViewModel.js";
import { formatValue } from "../numberFormat.js";

/**
 * Inline `style` attribute string that applies the gradient colour
 * baked into `vm.objective.valueColor` to the `.value` element via
 * the shared `--bsc-value-color` custom property. Returns `""` when
 * the colour is empty (degenerate / non-numeric branch) so the
 * element renders without a style attribute and falls back to
 * `currentColor` (default tile text).
 */
function valueColorStyle(vm: BusinessScoreCardNodeViewModel): string {
  const c = vm.objective.valueColor;
  return c ? `--bsc-value-color: ${c}` : "";
}

/**
 * Render the value content for a given role's VM.
 *
 * `<span data-testid="value">` is always emitted (even when empty for
 * `childrenCount` n=0) so e2e tests can assert presence + emptiness.
 * The unit is split into its own `<span class="unit">` element so the
 * per-role CSS can size it at `calc(1em / 3)` (1/3 of the value's
 * surrounding font-size, SPEC §17.14).
 *
 * SPEC §17.40 — the per-VM `objective.valueColor` is applied as an
 * inline style on the `.value` element via the shared
 * `--bsc-value-color` custom property. The empty `childrenCount` n=0
 * variant has no number to grade, so the colour is intentionally
 * unset there (no inline style attribute).
 */
export function renderValueTemplate(
  vm: BusinessScoreCardNodeViewModel,
): TemplateResult {
  const value = vm.value;
  const colorStyle = valueColorStyle(vm);
  switch (value.kind) {
    case "computedMean": {
      return html`<span
          class="value"
          data-testid="value"
          data-value-kind="computedMean"
          style=${colorStyle}
          >${formatValue(value.mean)}</span
        >`;
    }
    case "recordedValue": {
      return html`<span
          class="value"
          data-testid="value"
          data-value-kind="recordedValue"
          style=${colorStyle}
          >${formatValue(value.value)}</span
        >`;
    }
    case "childrenCount": {
      if (value.n === 0) {
        return html`<span
          class="value empty"
          data-testid="value"
          data-value-kind="childrenCount-empty"
        ></span>`;
      }
      return html`<span
        class="value"
        data-testid="value"
        data-value-kind="childrenCount"
        style=${colorStyle}
      >${value.n} children</span>`;
    }
  }
}

/**
 * SPEC §17.116 — the unit moves out of the inline `.value` run into
 * its own `.unit-below` block sibling under it. Renders `nothing`
 * when the value branch has no unit to surface (childrenCount, or
 * a value branch with empty unit string).
 */
export function renderUnitBelow(
  vm: BusinessScoreCardNodeViewModel,
): TemplateResult | typeof nothing {
  const value = vm.value;
  if (value.kind === "childrenCount") return nothing;
  if (!value.unit) return nothing;
  return html`<span class="unit-below" data-testid="unit">${value.unit}</span>`;
}

/**
 * SPEC §17.40 + §17.44 — render the target row that sits under
 * `.value` inside `.value-area`.
 *
 * Layout: `[bullseye icon] {target} {unit} · {date} [warning ⚠]`.
 * The deadline-risk warning glyph (§17.44) lives at the *right end of
 * this row*, immediately after the target date, tinted by the
 * deviation magnitude (yellow at the lowest, red at the highest) the
 * mapper baked into `vm.objective.warningColor`. The warning was
 * previously absolutely positioned at the tile's bottom-left
 * (pre-§17.44); §17.44 brings it into the target row so the
 * "trajectory at risk" signal sits next to the deadline it concerns,
 * and the colour-as-severity scale gives the operator a glance-decode
 * of *how badly* the trend is missing rather than the binary "is it
 * missing?" the §17.40 amendment offered.
 *
 * Returns `nothing` when the VM's value branch is `childrenCount` n=0
 * (empty tile body — there is no value to compare a target against,
 * so a target row would be visually meaningless).
 *
 * The target row's bullseye + text + date inherit `currentColor` (the
 * default tile text colour) — the gradient pop is reserved for the
 * value glyph (§17.40) and now the warning glyph (§17.44), so the
 * operator's eye lands on the two coloured surfaces (current value /
 * trajectory severity) and reads the rest as supporting context.
 *
 * The warning is rendered iff `vm.objective.warningColor` is
 * non-empty; the inline `color` style applies the baked RGB string so
 * the per-element tint takes precedence over the `.warning-icon`'s
 * `currentColor` fallback. The `data-testid="off-track-warning"`
 * carries forward from §17.40 so existing e2e selectors keep working
 * after the position move.
 */
export function renderTargetRow(
  vm: BusinessScoreCardNodeViewModel,
): TemplateResult | typeof nothing {
  if (vm.value.kind === "childrenCount" && vm.value.n === 0) {
    return nothing;
  }
  const obj = vm.objective;
  const dateLabel = obj.targetDateIso ? formatDate(obj.targetDateIso) : "";
  const warning = obj.warningColor
    ? html`<span
        class="warning-icon"
        data-testid="off-track-warning"
        role="img"
        aria-label="Trajectory predicts missing the deadline"
        style=${`color: ${obj.warningColor}`}
      ></span>`
    : nothing;
  return html`<div class="target-row" data-testid="target-row">
    <span class="target-icon" data-testid="target-icon" aria-hidden="true"></span>
    <span class="target-text" data-testid="target-text"
      >${formatValue(obj.targetValue)}<span class="target-unit">&nbsp;${obj.unit}</span></span
    >${dateLabel
      ? html`<span class="target-sep" aria-hidden="true">·</span>
          <time class="target-date" data-testid="target-date" datetime=${obj.targetDateIso}
            >${dateLabel}</time
          >`
      : nothing}${warning}
  </div>`;
}

/**
 * SPEC §17.41 — Unicode glyph for each {@link
 * BusinessScoreCardObjectiveViewModel.trendArrow} direction.
 *
 * The 5 directions cover the half-circle ↑↗→↘↓ of the 8-compass
 * palette — the only buckets that have meaning in a 1D progress-rate
 * signal (see `domain/aggregation/objectiveProgress.trendArrowFromRate`
 * for the rationale). Each glyph is a single Unicode code-point in the
 * `Arrows` block (U+2191..U+2199) — present in every modern system
 * symbol font (Segoe UI Symbol on Windows, Apple Symbols on
 * macOS / iOS, Noto Sans Symbols on Android) — so the per-view does
 * NOT need an SVG asset or webfont.
 */
const TREND_ARROW_GLYPHS = {
  up: "\u2191", //  ↑
  "up-right": "\u2197", //  ↗
  right: "\u2192", //  →
  "down-right": "\u2198", //  ↘
  down: "\u2193", //  ↓
} as const satisfies Record<NonNullable<BusinessScoreCardNodeViewModel["objective"]["trendArrow"]>, string>;

/**
 * Operator-facing aria-label for each trend-arrow direction. The
 * arrow is decorative-but-meaningful (a screen-reader user wants to
 * know "the metric is on track" or "the metric is regressing"), so
 * we publish a short label that describes the *meaning* of the arrow
 * rather than its visual shape ("up arrow" would tell the SR user
 * nothing useful — they want the semantics).
 *
 * Keep the labels short — they are read aloud each time the value
 * changes; verbose labels would make the kiosk's audio output
 * crowded for low-vision operators.
 */
const TREND_ARROW_LABELS = {
  up: "Trend: well ahead of schedule",
  "up-right": "Trend: on or near schedule",
  right: "Trend: flat",
  "down-right": "Trend: slight regression",
  down: "Trend: significant regression",
} as const satisfies Record<NonNullable<BusinessScoreCardNodeViewModel["objective"]["trendArrow"]>, string>;

/**
 * SPEC §17.41 — render the trend arrow that sits to the right of the
 * BSC's value (inside `.value-row`).
 *
 * Returns `nothing` when `vm.objective.trendArrow` is `null` — same
 * silent-on-insufficient-data policy the deadline-risk warning uses.
 * Specifically, the arrow does NOT render for:
 *   - `recordedValue` BSCs with fewer than 2 distinct-timestamp
 *     historized entries (no defined trend);
 *   - `computedMean` / `childrenCount` BSCs (rule restricted to
 *     `recordedValue` for the same data-source reason as the
 *     deadline-risk warning);
 *   - degenerate objectives (`min === target`, `firstDate ===
 *     targetDate`, or non-finite endpoints).
 *
 * The glyph is rendered in `currentColor` (the default tile text
 * colour) — the colour-as-severity signal stays on the value glyph
 * (§17.40) and on the warning glyph (§17.44); the arrow's direction
 * carries its own at-a-glance signal so a monochrome glyph forces
 * the operator to read the *direction* and *steepness* of the arrow
 * rather than glance-decode a hue scale.
 *
 * The `data-testid="trend-arrow"` and `data-direction` attributes
 * give e2e tests a stable hook into the bucket the mapper landed on.
 */
export function renderTrendArrow(
  vm: BusinessScoreCardNodeViewModel,
): TemplateResult | typeof nothing {
  const direction = vm.objective.trendArrow;
  if (direction === null) return nothing;
  return html`<span
    class="trend-arrow"
    data-testid="trend-arrow"
    data-direction=${direction}
    role="img"
    aria-label=${TREND_ARROW_LABELS[direction]}
    >${TREND_ARROW_GLYPHS[direction]}</span
  >`;
}

/**
 * Returns the ISO date string to render in the tile's bottom-right
 * corner (SPEC §17.18 — moved from top-right; every BSC tile shows a
 * timestamp when one can be derived) for a given BSC view model, or
 * `null` when no timestamp is meaningful.
 *
 * Per-branch policy (now uniform — read from `vm.dateIso`):
 *   - `recordedValue`   — own latest history entry's date.
 *   - `computedMean`    — most recent date amongst the (eligible)
 *                         children's current-value dates (recurses
 *                         through nested computed BSCs); set by
 *                         `viewModelMapper`.
 *   - `childrenCount`   — same rule (most recent child date), or
 *                         `null` if no child has a date / no children.
 */
export function timestampForValue(
  vm: BusinessScoreCardNodeViewModel,
): string | null {
  return vm.dateIso ? vm.dateIso : null;
}

/**
 * ISO-8601 → locale short date. Used by `renderTargetRow` for the
 * target-row's deadline label (calendar dates are still appropriate
 * for a *future* deadline; SPEC §17.116 only switches the
 * bottom-right *age* timestamp away from calendar dates — see
 * `formatAge` in `../ageFormat.ts` for that).
 */
export function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return iso;
  }
  return new Date(ms).toLocaleDateString();
}
