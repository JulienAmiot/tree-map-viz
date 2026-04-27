/**
 * `<text-node-as-child>` — compact treemap-tile rendering for `TextNode`.
 *
 * Same fields as `TextNodeAsParent` (§5 — uniform fields across roles),
 * just smaller typography and tighter padding.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { TextNodeViewModel } from "../NodeViewModel.js";

@customElement("text-node-as-child")
export class TextNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: TextNodeViewModel | null = null;

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
      margin: 0;
      font-size: clamp(0.8rem, 0.95vw, 0.9rem);
      color: color-mix(in srgb, currentColor 70%, transparent);
      line-height: 1.3;
    }
    .description.empty {
      display: none;
    }
  `;

  render() {
    if (!this.vm) {
      return html``;
    }
    const desc = this.vm.description;
    return html`
      <h2 class="title" data-testid="title" data-view-kind="TextNode" data-id=${this.vm.id}>
        ${this.vm.title}
      </h2>
      <p
        class=${desc.length === 0 ? "description empty" : "description"}
        data-testid="description"
      >
        ${desc}
      </p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "text-node-as-child": TextNodeAsChild;
  }
}
