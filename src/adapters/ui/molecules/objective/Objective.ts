/**
 * SPEC §17.137 (A1) — `<objective-cell>` molecule: bullseye glyph
 * + formatted target value + unit chip on a single inline row.
 *
 * Pre-A1 these pieces were stamped inline by `renderTargetRow` in
 * `BusinessScoreCardNode/valueTemplate.ts`; A1 promotes them so
 * §17.137 A2's split-body layout (50% value+trend / 25% objective
 * / 25% date) can compose two independent cells. A1 is a pure
 * refactor — the §17.44 warning stays inline in `renderTargetRow`;
 * A2 folds it into this molecule when the layout co-locates them.
 *
 * Visual contract: `[bullseye] {targetValue} {unit}`. The existing
 * `target-icon` / `target-text` / `target-unit` testids + class
 * names are preserved so per-role CSS + e2e selectors still
 * resolve. Independent of `BusinessScoreCardObjectiveViewModel`
 * so future Computed* callers can compose this molecule freely.
 */

import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../atoms/icon/Icon.js";
import { formatValue } from "../../atoms/numberFormat.js";

@customElement("objective-cell")
export class ObjectiveCell extends LitElement {
  @property({ type: Number, attribute: "target-value" })
  targetValue = 0;

  @property({ attribute: "unit" })
  unit = "";

  static readonly styles = css`
    :host { display: inline-flex; align-items: center; gap: 0.35em; }
  `;

  override render(): TemplateResult {
    return html`<span
        class="target-icon"
        data-testid="target-icon"
        aria-hidden="true"
        ><ds-icon name="target"></ds-icon
      ></span>
      <span class="target-text" data-testid="target-text"
        >${formatValue(this.targetValue)}<span class="target-unit"
          >&nbsp;${this.unit}</span
        ></span
      >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "objective-cell": ObjectiveCell;
  }
}
