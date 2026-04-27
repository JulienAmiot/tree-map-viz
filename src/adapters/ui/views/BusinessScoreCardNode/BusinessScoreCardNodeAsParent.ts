/**
 * `<business-score-card-as-parent>` — large parent-strip rendering for
 * `BusinessScoreCardNode` (SPEC §5).
 *
 * Field rules: Title + Description + value (with `Σ` badge when computed).
 * Same fields as the `AsChild` sibling — only typography differs.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { BusinessScoreCardNodeViewModel } from "../NodeViewModel.js";
import { renderValueTemplate } from "./valueTemplate.js";

@customElement("business-score-card-as-parent")
export class BusinessScoreCardNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      padding: 0.25rem 0;
      color: inherit;
      font: inherit;
    }
    .title {
      margin: 0 0 0.35rem 0;
      font-weight: 700;
      font-size: clamp(1.4rem, 2.4vw, 2.1rem);
      line-height: 1.1;
    }
    .description {
      margin: 0 0 0.5rem 0;
      font-size: clamp(0.95rem, 1.2vw, 1.1rem);
      color: color-mix(in srgb, currentColor 80%, transparent);
      line-height: 1.4;
    }
    .description.empty {
      display: none;
    }
    .value-row {
      display: inline-flex;
      align-items: baseline;
      gap: 0.5rem;
      font-size: clamp(1.1rem, 1.6vw, 1.35rem);
    }
    .value {
      font-weight: 600;
    }
    .value.empty::before {
      content: "";
    }
    .sigma {
      font-size: 0.85em;
      padding: 0 0.35em;
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
      <h1
        class="title"
        data-testid="title"
        data-view-kind="BusinessScoreCardNode"
        data-id=${this.vm.id}
      >
        ${this.vm.title}
      </h1>
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
    "business-score-card-as-parent": BusinessScoreCardNodeAsParent;
  }
}
