/**
 * Value-area template shared by `<business-score-card-as-parent>` and
 * `<business-score-card-as-child>` (SPEC §5 + §17.14 — Field-content rules).
 *
 * The template returns the **inner** content of the `.value` slot (which
 * the parent element wraps with `<div class="value-area">`); the outer
 * tile layout (title row, top-right timestamp slot, value-fills-tile box)
 * is owned by the per-role element so the layout rules stay in one place
 * per tile (SPEC §17.14: title height = `3vh`, value font fills the tile
 * via `cqmin`, unit = 1/3 of value).
 *
 * Mapping (unchanged from §17.9 / §17.12 — only the visual size changes):
 *
 *  | VM `value.kind`        | Renders inside `.value-area`                            |
 *  | --- | --- |
 *  | `computedMean`         | `<mean>.toFixed(1)` + `<unit>` (1/3 size) + `Σ` badge   |
 *  | `recordedValue`        | `<value>` + `<unit>` (1/3 size) — date in tile corner   |
 *  | `childrenCount` (n>0)  | `<n> children` plain text — no `Σ`, no `Unit` (§13.2)   |
 *  | `childrenCount` (n=0)  | empty value area (§12.3 `views/computed_aggregation`)   |
 */

import { html, type TemplateResult } from "lit";

import type { BusinessScoreCardValueViewModel } from "../NodeViewModel.js";

const COMPUTED_DECIMALS = 1;

/**
 * Render the value content for a given role's value VM.
 *
 * `<span data-testid="value">` is always emitted (even when empty for
 * `childrenCount` n=0) so e2e tests can assert presence + emptiness.
 * The unit is split into its own `<span class="unit">` element so the
 * per-role CSS can size it at `calc(1em / 3)` (1/3 of the value's
 * surrounding font-size, SPEC §17.14).
 */
export function renderValueTemplate(
  value: BusinessScoreCardValueViewModel,
): TemplateResult {
  switch (value.kind) {
    case "computedMean": {
      return html`
        <span class="value" data-testid="value" data-value-kind="computedMean"
          >${value.mean.toFixed(COMPUTED_DECIMALS)}<span class="unit"
            >&nbsp;${value.unit}</span
          ></span
        >
        <span class="sigma" data-testid="computed-badge" aria-label="Computed value">Σ</span>
      `;
    }
    case "recordedValue": {
      return html`
        <span class="value" data-testid="value" data-value-kind="recordedValue"
          >${value.value}<span class="unit">&nbsp;${value.unit}</span></span
        >
      `;
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
      >${value.n} children</span>`;
    }
  }
}

/**
 * Returns the ISO date string to render in the tile's top-right corner
 * (SPEC §17.14 — every node's current value timestamp goes top-right) for
 * a given BSC value VM, or `null` when no timestamp is meaningful.
 *
 * Per-branch policy:
 *   - `recordedValue` — own latest entry's date.
 *   - `computedMean` / `childrenCount` — no single representative date,
 *     so we omit the timestamp to avoid implying one entry's date applies
 *     to a derived aggregate.
 */
export function timestampForValue(
  value: BusinessScoreCardValueViewModel,
): string | null {
  if (value.kind === "recordedValue") {
    return value.dateIso;
  }
  return null;
}

/**
 * ISO-8601 → locale short date for the corner timestamp. Exported so
 * each per-role element renders the same `<time>` content.
 */
export function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return iso;
  }
  return new Date(ms).toLocaleDateString();
}
