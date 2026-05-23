/**
 * `<workflow-node-as-child>` — compact treemap-tile rendering for
 * `WorkflowNode` (SPEC §17.117, §17.121e refresh).
 *
 * Same overall layout as `<text-node-as-child>` (title row at top,
 * markdown body fills the middle, age-coloured timestamp at the
 * bottom-right) plus a §17.117 status badge. The badge's border +
 * text are coloured from the mapper-baked `vm.status.color`; the
 * background stays transparent per the operator's "only the text
 * and border are colored" requirement.
 *
 * SPEC §17.121e moved the badge from its pre-§17.121e bottom-left
 * absolute-positioned corner into the shared `.subtitle` slot
 * directly under the title. The slot is declared by
 * `tileLayoutStyles` and opt-in per view via `--subtitle-row-height`
 * (`2vh` here, declared on `:host` below). The badge's CSS contract
 * stays unchanged otherwise (coloured border / text, transparent
 * background, `pointer-events: none`).
 *
 * Markdown rendering + JS shrink-to-fit reuse the §17.27 `textBody`
 * primitives verbatim — WorkflowNode IS-A TextNode in the domain, and
 * the body content (the latest history entry's string) shares the
 * exact markdown pipeline. The role-level additions vs the TextNode
 * view are the status badge subtitle + the swapped `data-view-kind`
 * attribute so e2e selectors can target the new tile shape.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { renderMarkdownToHtml } from "../../atoms/markdownToHtml.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../../molecules/disabledToggle.js";
import { renderStaticTitle } from "../../molecules/inlineTitleEdit.js";
import type { WorkflowNodeViewModel } from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "../TextNode/textBody.js";
import { renderStatusBadge, statusBadgeStyles } from "../../molecules/statusBadge.js";

@customElement("workflow-node-as-child")
export class WorkflowNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: WorkflowNodeViewModel | null = null;

  private resizeObserver: ResizeObserver | null = null;

  static readonly styles = [
    tileLayoutStyles,
    textBodyStyles,
    statusBadgeStyles,
    disabledToggleStyles,
    css`
      /* SPEC §17.121e — opt into the shared .subtitle slot from
         tileLayoutStyles. The 2vh row reserves space for the status
         badge directly under the title; the shared .value-area
         height formula reads this var and subtracts it from the
         body region, so the value area shrinks by exactly the slot
         we add. */
      :host {
        --subtitle-row-height: 2vh;
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
    if (!this.vm) return html``;
    const { value, status } = this.vm;
    const dateLabel = value.dateIso ? formatAge(value.dateIso) : "";
    const empty = value.text.length === 0;
    const dateStyle = value.dateColor ? `--age-color: ${value.dateColor}` : "";
    const disabled = this.vm.disabled ?? false;
    return html`
      ${renderStaticTitle({
        target: { nodeId: this.vm.id, title: this.vm.title },
        viewKind: "WorkflowNode",
        prefix: renderDisabledIndicator(disabled),
      })}
      <div class="subtitle" data-testid="subtitle">
        ${renderStatusBadge(status)}
      </div>
      ${value.dateIso
        ? html`<time
            class="timestamp"
            data-testid="value-date"
            datetime=${value.dateIso}
            style=${dateStyle}
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

declare global {
  interface HTMLElementTagNameMap {
    "workflow-node-as-child": WorkflowNodeAsChild;
  }
}
