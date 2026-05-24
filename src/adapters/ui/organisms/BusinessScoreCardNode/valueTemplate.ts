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

import "../../atoms/icon/Icon.js";
import "../../molecules/objective/Objective.js";
import "../../molecules/objective/TargetDate.js";
import type { BusinessScoreCardNodeViewModel } from "../../molecules/NodeViewModel.js";
import { formatValue } from "../../atoms/numberFormat.js";

/**
 * Inline `style` attribute string that applies both the SPEC §17.40
 * gradient colour (via `--bsc-value-color`) and the SPEC §17.116-
 * followup-3 dynamic-fit character count (via `--char-count`) to the
 * `.value` element. Returns a semicolon-joined declaration list.
 *
 * - `--bsc-value-color` is omitted when `vm.objective.valueColor` is
 *   empty (degenerate / non-numeric branch) so the element falls
 *   back to `currentColor` (default tile text).
 * - `--char-count` is the number of characters in the rendered value
 *   text. The shared `.value` rule in `tileLayoutStyles` reads it
 *   via `var(--char-count, 2)` and caps the font-size at
 *   `160cqi / max(2, --char-count)` so the value glyph never
 *   exceeds ≈ 90 % of the tile width regardless of N. The fallback
 *   used by the CSS rule (2) is intentionally a "no-op" for short
 *   values, so passing the actual length always tightens the cap
 *   for longer values and never loosens it.
 */
function valueInlineStyle(
  vm: BusinessScoreCardNodeViewModel,
  text: string,
): string {
  const parts: string[] = [`--char-count: ${text.length}`];
  const c = vm.objective.valueColor;
  if (c) parts.push(`--bsc-value-color: ${c}`);
  return parts.join("; ");
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
  switch (value.kind) {
    case "computedMean": {
      const text = formatValue(value.mean);
      return html`<span
          class="value"
          data-testid="value"
          data-value-kind="computedMean"
          style=${valueInlineStyle(vm, text)}
          >${text}</span
        >`;
    }
    case "recordedValue": {
      const text = formatValue(value.value);
      return html`<span
          class="value"
          data-testid="value"
          data-value-kind="recordedValue"
          style=${valueInlineStyle(vm, text)}
          >${text}</span
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
      const text = `${value.n} children`;
      return html`<span
        class="value"
        data-testid="value"
        data-value-kind="childrenCount"
        style=${valueInlineStyle(vm, text)}
      >${text}</span>`;
    }
  }
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
  return html`<div class="target-row" data-testid="target-row">
    <objective-cell
      .targetValue=${obj.targetValue}
      .unit=${obj.unit}
      .warningColor=${obj.warningColor}
    ></objective-cell>${obj.targetDateIso
      ? html`<span class="target-sep" aria-hidden="true">·</span>
          <target-date-cell .dateIso=${obj.targetDateIso}></target-date-cell>`
      : nothing}
  </div>`;
}

/**
 * SPEC §17.41 + §17.132 — Lucide slug for each {@link
 * BusinessScoreCardObjectiveViewModel.trendArrow} direction. Renders
 * via `<ds-icon name=…>` from the §17.131 icon library so the trend
 * signal reads with consistent stroke weight + monochrome `currentColor`
 * on every platform (the pre-§17.132 Unicode-arrow path drifted into
 * the system emoji font on iOS / older Android, where the glyph
 * picked up the OS's coloured-arrow rendering).
 *
 * The 5 directions cover the half-circle ↑↗→↘↓ of the 8-compass
 * palette — the only buckets that have meaning in a 1D progress-rate
 * signal (see `domain/aggregation/objectiveProgress.trendArrowFromRate`
 * for the rationale).
 */
const TREND_ARROW_SLUGS = {
  up: "arrow-up",
  "up-right": "arrow-up-right",
  right: "arrow-right",
  "down-right": "arrow-down-right",
  down: "arrow-down",
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
    ><ds-icon name=${TREND_ARROW_SLUGS[direction]}></ds-icon></span
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
