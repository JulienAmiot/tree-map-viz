/**
 * Value-area template shared by `<business-score-card-as-parent>` and
 * `<business-score-card-as-child>` (SPEC §5 — Field-content rules).
 *
 * The two roles differ only in size/typography (CSS handled by each
 * element's `static styles`); the value area's *content* is uniform:
 *
 *  | VM `value.kind`        | Renders (both roles)                                    |
 *  | --- | --- |
 *  | `computedMean`         | `<mean>.toFixed(1) <unit>` + `Σ` badge (`computed-badge`) |
 *  | `recordedValue`        | `<value> <unit>` + ISO date — no `Σ`                    |
 *  | `childrenCount` (n>0)  | `<n> children` plain text — no `Σ`, no `Unit` (§13.2)   |
 *  | `childrenCount` (n=0)  | empty value area (§12.3 `views/computed_aggregation`)   |
 *
 * Returning a Lit `TemplateResult` lets each per-role element drop the
 * snippet straight into its own template without re-parsing strings.
 */

import { html, type TemplateResult } from "lit";

import type { BusinessScoreCardValueViewModel } from "../NodeViewModel.js";

const COMPUTED_DECIMALS = 1;

/**
 * Render the value area for a given role's value VM.
 *
 * `<span data-testid="value">` is always emitted (even when empty for
 * `childrenCount` n=0) so e2e tests can assert presence + emptiness.
 */
export function renderValueTemplate(value: BusinessScoreCardValueViewModel): TemplateResult {
  switch (value.kind) {
    case "computedMean": {
      const text = `${value.mean.toFixed(COMPUTED_DECIMALS)} ${value.unit}`;
      return html`
        <span class="value" data-testid="value" data-value-kind="computedMean">${text}</span>
        <span class="sigma" data-testid="computed-badge" aria-label="Computed value">Σ</span>
      `;
    }
    case "recordedValue": {
      const text = `${value.value} ${value.unit}`;
      return html`
        <span class="value" data-testid="value" data-value-kind="recordedValue">${text}</span>
        <time
          class="date"
          data-testid="value-date"
          datetime=${value.dateIso}
        >${formatDate(value.dateIso)}</time>
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
 * ISO-8601 → locale short date. We render the user's locale because the
 * kiosk runs in a single timezone (per §1) and absolute timestamps are
 * not the user-visible bit — the day is.
 */
function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return iso;
  }
  return new Date(ms).toLocaleDateString();
}
