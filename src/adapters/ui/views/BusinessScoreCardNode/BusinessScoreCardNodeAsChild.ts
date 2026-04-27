/**
 * `<business-score-card-as-child>` — compact treemap-tile rendering for
 * `BusinessScoreCardNode`.
 *
 * Same fields as the `AsParent` sibling (§5 — uniform fields across roles);
 * smaller typography, tighter padding.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { BusinessScoreCardNodeViewModel } from "../NodeViewModel.js";
import { renderValueTemplate } from "./valueTemplate.js";

@customElement("business-score-card-as-child")
export class BusinessScoreCardNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      padding: 0.4rem 0.6rem;
      color: inherit;
      font: inherit;
    }
    .title {
      margin: 0 0 0.2rem 0;
      font-weight: 600;
      font-size: clamp(0.95rem, 1.1vw, 1.05rem);
      line-height: 1.15;
    }
    .description {
      margin: 0 0 0.3rem 0;
      font-size: clamp(0.8rem, 0.95vw, 0.9rem);
      color: color-mix(in srgb, currentColor 70%, transparent);
      line-height: 1.3;
    }
    .description.empty {
      display: none;
    }
    .value-row {
      display: inline-flex;
      align-items: baseline;
      gap: 0.35rem;
      font-size: clamp(0.85rem, 1vw, 0.95rem);
    }
    .value {
      font-weight: 600;
    }
    .sigma {
      font-size: 0.85em;
      padding: 0 0.3em;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 12%, transparent);
      color: color-mix(in srgb, currentColor 90%, transparent);
    }
    .date {
      font-size: 0.85em;
      color: color-mix(in srgb, currentColor 65%, transparent);
    }
  `;

  render() {
    if (!this.vm) {
      return html``;
    }
    const desc = this.vm.description;
    return html`
      <h2
        class="title"
        data-testid="title"
        data-view-kind="BusinessScoreCardNode"
        data-id=${this.vm.id}
      >
        ${this.vm.title}
      </h2>
      <p
        class=${desc.length === 0 ? "description empty" : "description"}
        data-testid="description"
      >
        ${desc}
      </p>
      <div class="value-row" data-testid="value-row">
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
