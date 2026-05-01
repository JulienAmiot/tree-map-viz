/**
 * `<text-node-as-parent>` — large parent-strip rendering for `TextNode`
 * (SPEC §5 — refined in §17.14, §17.18, §17.27).
 *
 * Layout (post-§17.18):
 *   - Title (top, `3vh` row, `vh`-scaled font, consistent across tiles).
 *   - Timestamp (**bottom-right** corner, `vh`-scaled) — the `asOf` of
 *     the latest entry in the underlying `TextCard` history. Colour
 *     follows a board-level fresh-colour → desaturated lerp by age in
 *     days (`dateAgeColor`).
 *   - Value (fills the tile below the title) — the `text` of the latest
 *     entry, parsed as **markdown** (SPEC §17.27) and rendered into a
 *     `.md-body` block whose font-size is tile-relative (`cqmin`
 *     clamp) and tightened by a JS shrink-to-fit pass so the full
 *     content stays visible regardless of tile size.
 *
 * Description is intentionally **not** rendered in the tile (it stays a
 * domain field on `NodeIdentity`, but the per-tile body is reserved for
 * the timestamped value per the unified §17.14 layout).
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { renderMarkdownToHtml } from "../../markdown/markdownToHtml.js";
import type { TextNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "./textBody.js";

@customElement("text-node-as-parent")
export class TextNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: TextNodeViewModel | null = null;

  private resizeObserver: ResizeObserver | null = null;

  static styles = [
    tileLayoutStyles,
    textBodyStyles,
    css`
      /* Parent strip uses a slightly larger title than the children,
         while still respecting the §17.14 vh-relative sizing. */
      .title {
        font-size: 2.4vh;
        font-weight: 700;
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.fitBody());
      this.resizeObserver.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  override updated(): void {
    this.fitBody();
  }

  private fitBody(): void {
    const body = this.shadowRoot?.querySelector<HTMLElement>(".md-body");
    fitMarkdownBodyToTile(body ?? null);
  }

  render() {
    if (!this.vm) {
      return html``;
    }
    const { value } = this.vm;
    const dateLabel = value.dateIso ? formatDate(value.dateIso) : "";
    const empty = value.text.length === 0;
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
            style=${value.dateColor ? `--age-color: ${value.dateColor}` : ""}
            >${dateLabel}</time
          >`
        : html``}
      <div class="value-area" data-testid="value-row">
        <div
          class=${empty ? "md-body empty" : "md-body"}
          data-testid="value"
          data-value-kind="textValue"
        >
          ${empty ? "" : unsafeHTML(renderMarkdownToHtml(value.text))}
        </div>
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
