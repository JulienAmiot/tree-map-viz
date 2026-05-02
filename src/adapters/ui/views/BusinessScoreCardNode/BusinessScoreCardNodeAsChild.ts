/**
 * `<business-score-card-as-child>` — compact treemap-tile rendering for
 * `BusinessScoreCardNode` (SPEC §5 — refined in §17.14, §17.18).
 *
 * Same fields and timestamp policy as `<business-score-card-as-parent>`
 * (§5 — uniform fields across roles); same shared `tileLayoutStyles`.
 * Timestamp sits in the **bottom-right** corner with an age-based
 * colour gradient (`dateAgeColor`).
 */

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { BusinessScoreCardNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import {
  formatDate,
  renderTargetRow,
  renderTrendArrow,
  renderValueTemplate,
  timestampForValue,
} from "./valueTemplate.js";

@customElement("business-score-card-as-child")
export class BusinessScoreCardNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  static styles = [tileLayoutStyles];

  render() {
    if (!this.vm) {
      return html``;
    }
    const dateIso = timestampForValue(this.vm);
    const dateColor = this.vm.dateColor;
    return html`
      <h2
        class="title"
        data-testid="title"
        data-view-kind="BusinessScoreCardNode"
        data-id=${this.vm.id}
      >
        ${this.vm.title}
      </h2>
      ${dateIso
        ? html`<time
            class="timestamp"
            data-testid="value-date"
            datetime=${dateIso}
            style=${dateColor ? `--age-color: ${dateColor}` : ""}
            >${formatDate(dateIso)}</time
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
