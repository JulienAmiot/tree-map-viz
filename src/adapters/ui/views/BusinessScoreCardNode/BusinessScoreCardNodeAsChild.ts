/**
 * `<business-score-card-as-child>` — compact treemap-tile rendering for
 * `BusinessScoreCardNode` (SPEC §5 — refined in §17.14).
 *
 * Same fields and timestamp policy as `<business-score-card-as-parent>`
 * (§5 — uniform fields across roles); same shared `tileLayoutStyles`.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { BusinessScoreCardNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import {
  formatDate,
  renderValueTemplate,
  timestampForValue,
} from "./valueTemplate.js";

@customElement("business-score-card-as-child")
export class BusinessScoreCardNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  static styles = [
    tileLayoutStyles,
    css`
      .title {
        font-weight: 600;
      }
    `,
  ];

  render() {
    if (!this.vm) {
      return html``;
    }
    const dateIso = timestampForValue(this.vm.value);
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
            >${formatDate(dateIso)}</time
          >`
        : html``}
      <div class="value-area" data-testid="value-row">
        ${renderValueTemplate(this.vm.value)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "business-score-card-as-child": BusinessScoreCardNodeAsChild;
  }
}
