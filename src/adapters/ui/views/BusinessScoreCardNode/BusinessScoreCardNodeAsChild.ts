/**
 * `<business-score-card-as-child>` — compact treemap-tile rendering for
 * `BusinessScoreCardNode` (SPEC §5 — refined in §17.14, §17.18).
 *
 * Same fields and timestamp policy as `<business-score-card-as-parent>`
 * (§5 — uniform fields across roles); same shared `tileLayoutStyles`.
 * Timestamp sits in the **bottom-right** corner with an age-based
 * colour gradient (`dateAgeColor`).
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../disabledToggle.js";
import type { BusinessScoreCardNodeViewModel } from "../NodeViewModel.js";
import { formatAge } from "../ageFormat.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import {
  renderUnitChip,
  unitChipStyles,
  unitFromBscValue,
} from "../unitChip.js";
import {
  renderTargetRow,
  renderTrendArrow,
  renderValueTemplate,
  timestampForValue,
} from "./valueTemplate.js";

@customElement("business-score-card-as-child")
export class BusinessScoreCardNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  static readonly styles = [
    tileLayoutStyles,
    disabledToggleStyles,
    unitChipStyles,
    css`
      /* SPEC §17.116 -- Σ prefix in the title row when the value
         branch is "computedMean". Same rule shape as the asParent
         role (cf. BSC asParent .computed-badge) and the §17.104
         Computed* cards. */
      .computed-badge {
        font-weight: 700;
        opacity: 0.75;
        margin-right: 0.25em;
        font-size: 0.95em;
      }
    `,
  ];

  render() {
    if (!this.vm) {
      return html``;
    }
    const dateIso = timestampForValue(this.vm);
    const dateColor = this.vm.dateColor;
    const showBadge = this.vm.value.kind === "computedMean";
    const disabled = this.vm.disabled ?? false;
    const unit = unitFromBscValue(this.vm.value);
    return html`
      <h2
        class="title"
        data-testid="title"
        data-view-kind="BusinessScoreCardNode"
        data-id=${this.vm.id}
      >${renderDisabledIndicator(disabled)}${showBadge
        ? html`<span class="computed-badge" data-testid="computed-badge" aria-label="Computed value">Σ</span>`
        : nothing}${renderUnitChip(unit)}${this.vm.title}</h2>
      <div class="subtitle" data-testid="subtitle"></div>
      ${dateIso
        ? html`<time
            class="timestamp"
            data-testid="value-date"
            datetime=${dateIso}
            style=${dateColor ? `--age-color: ${dateColor}` : ""}
            >${formatAge(dateIso)}</time
          >`
        : html``}
      <div class="value-area" data-testid="value-row">
        <div class="value-row">
          ${renderValueTemplate(this.vm)}
          ${renderTrendArrow(this.vm)}
        </div>
        ${renderTargetRow(this.vm)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "business-score-card-as-child": BusinessScoreCardNodeAsChild;
  }
}
