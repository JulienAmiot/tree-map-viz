/**
 * `<text-node-as-parent>` — large parent-strip rendering for `TextNode`
 * (SPEC §5 — refined in §17.14).
 *
 * Layout (post-§17.14):
 *   - Title (top, `3vh` row, `vh`-scaled font, consistent across tiles).
 *   - Timestamp (top-right corner, `vh`-scaled, muted) — the `asOf` of
 *     the latest entry in the underlying `TextCard` history.
 *   - Value (fills the tile below the title) — the `text` of the latest
 *     entry, sized via `cqmin` so it grows to occupy the available
 *     space. Empty when the history is empty (graceful degradation).
 *
 * Description is intentionally **not** rendered in the tile (it stays a
 * domain field on `NodeIdentity`, but the per-tile body is reserved for
 * the timestamped value per the unified §17.14 layout).
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { TextNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";

@customElement("text-node-as-parent")
export class TextNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: TextNodeViewModel | null = null;

  static styles = [
    tileLayoutStyles,
    css`
      /* Parent strip uses a slightly larger title than the children,
         while still respecting the §17.14 vh-relative sizing. */
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
    const { value } = this.vm;
    const dateLabel = value.dateIso ? formatDate(value.dateIso) : "";
    return html`
      <h1
        class="title"
        data-testid="title"
        data-view-kind="TextNode"
        data-id=${this.vm.id}
      >
        ${this.vm.title}
      </h1>
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
    "text-node-as-parent": TextNodeAsParent;
  }
}
