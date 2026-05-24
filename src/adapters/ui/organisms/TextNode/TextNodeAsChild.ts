/**
 * `<text-node-as-child>` — compact treemap-tile rendering for `TextNode`
 * (SPEC §5 — refined in §17.14, §17.18, §17.27, §17.136 S6).
 *
 * Same fields as `<text-node-as-parent>` (§5 — uniform fields across
 * roles); same shared `tileLayoutStyles` + `textBodyStyles`. §17.42
 * collapsed the title font-weight so child and parent both render
 * at 700; the role no longer carries any per-role `.title` override.
 *
 * §17.136 S6 — the entire render output is wrapped in a `<card-frame>`
 * molecule with the molecule's default `22 % / 12 %` header/footer
 * (small tree-map tile, defaults apply — same as S2 BSC AsChild + S4
 * Computed AsChild). Slot routing: disabled indicator in `icons`
 * (no §17.116 sigma badge — TextNode has no aggregation flag), title
 * text in `title`, §17.121j placeholder in `subtitle`, §17.27
 * markdown `.md-body` value-area in `body`, §17.18 timestamp in
 * `footer-right`. `footer-left` + `header-actions` stay empty until
 * S13 cuts over the weight button. Pre-§17.136 S6 the timestamp was
 * absolutely positioned at the tile's bottom-right corner via the
 * shared `tileLayoutStyles .timestamp { position: absolute; bottom:
 * 0.2rem; right: 0.35rem }` rule; with card-frame the timestamp lives
 * in the footer-right slot in natural flow, so we override the
 * shared rule with `position: static; bottom: auto; right: auto`
 * (same pattern as S2 / S4 / S5).
 *
 * SPEC §17.27 — the value is rendered as **markdown**: the latest
 * `TimestampedValue<string>` text passes through `renderMarkdownToHtml`
 * (a small zero-dep, escape-first parser) and is injected via
 * `unsafeHTML` into a `.md-body` element. The body's font-size is
 * tile-relative (`cqmin` clamp) and gets a JS shrink-to-fit pass so the
 * full content stays visible regardless of tile size.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { renderMarkdownToHtml } from "../../atoms/markdownToHtml.js";
import "../../molecules/cardFrame/CardFrame.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../../molecules/disabledToggle.js";
import type { TextNodeViewModel } from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
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

  static readonly styles = [
    tileLayoutStyles,
    textBodyStyles,
    disabledToggleStyles,
    css`
      /* SPEC §17.136 S6 -- card-frame's footer-right slot flows the
         timestamp in the natural footer row; the shared
         tileLayoutStyles still pins position:absolute + bottom + right
         for the unmigrated WorkflowNode/PictureNode/URLNode AsChild
         per-views (S7-S12 will migrate those and S13 will retire the
         shared absolute rule once every per-view has been moved off
         it), so we override here to drop the absolute positioning
         while leaving the age-color / font-size / tabular-nums /
         nowrap declarations from tileLayoutStyles intact. */
      .timestamp {
        position: static;
        bottom: auto;
        right: auto;
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
    const dateLabel = value.dateIso ? formatAge(value.dateIso) : "";
    const empty = value.text.length === 0;
    const disabled = this.vm.disabled ?? false;
    return html`<card-frame>
      <span slot="icons" data-testid="icons-slot"
        >${renderDisabledIndicator(disabled)}</span
      >
      <h2
        class="title"
        slot="title"
        data-testid="title"
        data-view-kind="TextNode"
        data-id=${this.vm.id}
      >${this.vm.title}</h2>
      <div class="subtitle" slot="subtitle" data-testid="subtitle"></div>
      <div class="value-area" slot="body" data-testid="value-row">
        <div
          class=${empty ? "md-body empty" : "md-body"}
          data-testid="value"
          data-value-kind="textValue"
        >
          ${empty ? "" : unsafeHTML(renderMarkdownToHtml(value.text))}
        </div>
      </div>
      ${value.dateIso
        ? html`<time
            class="timestamp"
            slot="footer-right"
            data-testid="value-date"
            datetime=${value.dateIso}
            style=${value.dateColor ? `--age-color: ${value.dateColor}` : ""}
            >${dateLabel}</time
          >`
        : nothing}
    </card-frame>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "text-node-as-child": TextNodeAsChild;
  }
}
