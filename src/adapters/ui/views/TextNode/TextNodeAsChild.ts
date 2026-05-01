/**
 * `<text-node-as-child>` — compact treemap-tile rendering for `TextNode`
 * (SPEC §5 — refined in §17.14, §17.18, §17.27).
 *
 * Same fields as `<text-node-as-parent>` (§5 — uniform fields across
 * roles); same shared `tileLayoutStyles` + `textBodyStyles`. The role
 * only differs through a slightly different `.title` weight, picked up
 * here. Timestamp sits in the **bottom-right** corner with an age-based
 * colour gradient (`dateAgeColor`).
 *
 * SPEC §17.27 — the value is rendered as **markdown**: the latest
 * `TimestampedValue<string>` text passes through `renderMarkdownToHtml`
 * (a small zero-dep, escape-first parser) and is injected via
 * `unsafeHTML` into a `.md-body` element. The body's font-size is
 * tile-relative (`cqmin` clamp) and gets a JS shrink-to-fit pass so the
 * full content stays visible regardless of tile size.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { renderMarkdownToHtml } from "../../markdown/markdownToHtml.js";
import type { TextNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "./textBody.js";

@customElement("text-node-as-child")
export class TextNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: TextNodeViewModel | null = null;

  /**
   * SPEC §17.27 — re-fits the markdown body whenever the tile is
   * resized. Bound here so `connectedCallback` / `disconnectedCallback`
   * can attach / detach the same observer instance.
   */
  private resizeObserver: ResizeObserver | null = null;

  static styles = [
    tileLayoutStyles,
    textBodyStyles,
    css`
      .title {
        font-weight: 600;
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
    // Re-fit after every render — vm changes (different markdown
    // content) and Lit reconciliation both land here. The fitter is
    // a no-op in jsdom (zero `getBoundingClientRect`).
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
    "text-node-as-child": TextNodeAsChild;
  }
}
