/**
 * `<text-node-as-parent>` — large parent-strip rendering for `TextNode` (SPEC §5).
 *
 * Field rules (§5 table, row 3): `Title + Description`, no value, no `Σ`.
 * Roles only differ in size/typography — content is identical to
 * `TextNodeAsChild`.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { TextNodeViewModel } from "../NodeViewModel.js";

@customElement("text-node-as-parent")
export class TextNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: TextNodeViewModel | null = null;

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
      margin: 0;
      font-size: clamp(0.95rem, 1.2vw, 1.1rem);
      color: color-mix(in srgb, currentColor 80%, transparent);
      line-height: 1.4;
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
      <h1 class="title" data-testid="title" data-view-kind="TextNode" data-id=${this.vm.id}>
        ${this.vm.title}
      </h1>
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
    "text-node-as-parent": TextNodeAsParent;
  }
}
