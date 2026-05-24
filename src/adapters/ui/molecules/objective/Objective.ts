/**
 * SPEC §17.137 (A1 + A2a) — `<objective-cell>` molecule: bullseye
 * glyph + formatted target value + unit chip + optional §17.44
 * deadline-risk warning, on a single inline row.
 *
 * Pre-A1 these pieces were stamped inline by `renderTargetRow` in
 * `BusinessScoreCardNode/valueTemplate.ts`. A1 promoted the bullseye
 * + target value + unit into this molecule; A2a folds the §17.44
 * warning glyph in too so the operator's A2-locked layout (50%
 * value+trend on the left, 25% objective + 25% date stacked on the
 * right) can co-locate the warning with the target value in a
 * single grid cell. **A2a behaviour change**: the warning moves
 * from "after the date" (pre-A2a — at the end of `renderTargetRow`)
 * to "after the target text inside `<objective-cell>`" (post-A2a).
 * This is the §17.44 contract update A2 requires; A2b's grid
 * layout then composes `<objective-cell>` + `<target-date-cell>`
 * as two independent cells.
 *
 * Visual contract: `[bullseye] {targetValue} {unit} [warning ⚠?]`.
 * The existing `target-icon` / `target-text` / `target-unit` /
 * `off-track-warning` testids + class names are preserved so
 * per-role CSS + e2e selectors still resolve.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../atoms/icon/Icon.js";
import { formatValue } from "../../atoms/numberFormat.js";

@customElement("objective-cell")
export class ObjectiveCell extends LitElement {
  @property({ type: Number, attribute: "target-value" })
  targetValue = 0;

  @property({ attribute: "unit" })
  unit = "";

  /** SPEC §17.137 A2a — RGB string tinting the §17.44 deadline-
   *  risk warning glyph; empty when the trajectory is on track or
   *  insufficient data exists to compute the warning (silent-on-
   *  insufficient-data policy). */
  @property({ attribute: "warning-color" })
  warningColor = "";

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
      >${this.warningColor
        ? html`<span
            class="warning-icon"
            data-testid="off-track-warning"
            role="img"
            aria-label="Trajectory predicts missing the deadline"
            style=${`color: ${this.warningColor}`}
            ><ds-icon name="triangle-alert"></ds-icon
          ></span>`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "objective-cell": ObjectiveCell;
  }
}
