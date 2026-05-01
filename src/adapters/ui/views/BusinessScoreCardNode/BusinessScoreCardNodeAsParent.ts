/**
 * `<business-score-card-as-parent>` — large parent-strip rendering for
 * `BusinessScoreCardNode` (SPEC §5 — refined in §17.14, §17.18).
 *
 * Layout (post-§17.18):
 *   - Title (top, `3vh` row, consistent across tiles).
 *   - Timestamp (**bottom-right** corner) — own `asOf` for
 *     `recordedValue`, the **most recent date amongst children's
 *     current-value dates** for `computedMean` / `childrenCount` (the
 *     answer to "as of when is this aggregate current?", computed by
 *     `domain/aggregation/currentValueDate`).
 *   - Value (fills the tile) — number + unit (1/3 size) for value
 *     branches; `<n> children` for childrenCount > 0; empty for
 *     childrenCount = 0. The Σ badge for `computedMean` is rendered
 *     adjacent to the value.
 *   - Timestamp colour follows a warm-orange → cold-pale-blue lerp
 *     by age in days (`dateAgeColor`), so a glance at the wall of
 *     tiles tells the user which numbers are *fresh* and which are
 *     *stale* without reading the date.
 *
 * Description is no longer rendered in the tile (still a domain field).
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

@customElement("business-score-card-as-parent")
export class BusinessScoreCardNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  static styles = [
    tileLayoutStyles,
    css`
      .title {
        font-size: 2.4vh;
        font-weight: 700;
      }
    `,
  ];

  render() {
    if (!this.vm) {
      return html``;
    }
    const dateIso = timestampForValue(this.vm);
    const dateColor = this.vm.dateColor;
    return html`
      <h1
        class="title"
        data-testid="title"
        data-view-kind="BusinessScoreCardNode"
        data-id=${this.vm.id}
      >
        ${this.vm.title}
      </h1>
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
        ${renderValueTemplate(this.vm.value)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "business-score-card-as-parent": BusinessScoreCardNodeAsParent;
  }
}
