/**
 * `<text-node-as-child>` — compact treemap-tile rendering for `TextNode`
 * (SPEC §5 — refined in §17.14).
 *
 * Same fields as `<text-node-as-parent>` (§5 — uniform fields across
 * roles); same shared `tileLayoutStyles`. The role only differs through
 * a slightly different `.title` weight, picked up here.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { TextNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

@customElement("text-node-as-child")
export class TextNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: TextNodeViewModel | null = null;

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
    const { value } = this.vm;
    const dateLabel = value.dateIso ? formatDate(value.dateIso) : "";
    return html`
      <h2
        class="title"
        data-testid="title"
        data-view-kind="TextNode"
        data-id=${this.vm.id}
      >
        ${this.vm.title}
      </h2>
      ${value.dateIso
        ? html`<time
            class="timestamp"
            data-testid="value-date"
            datetime=${value.dateIso}
            >${dateLabel}</time
          >`
        : html``}
      <div class="value-area" data-testid="value-row">
        <span
          class=${value.text.length === 0 ? "value empty" : "value"}
          data-testid="value"
          data-value-kind="textValue"
          >${value.text}</span
        >
      </div>
    `;
  }
}

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return iso;
  }
  return new Date(ms).toLocaleDateString();
}

declare global {
  interface HTMLElementTagNameMap {
    "text-node-as-child": TextNodeAsChild;
  }
}
