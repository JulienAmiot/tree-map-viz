/**
 * `<workflow-node-as-child>` — compact treemap-tile rendering for
 * `WorkflowNode` (SPEC §17.117).
 *
 * Same overall layout as `<text-node-as-child>` (title row at top,
 * markdown body fills the middle, age-coloured timestamp at the
 * bottom-right) plus a §17.117 status badge anchored at the
 * bottom-left. The badge's border + text are coloured from the
 * mapper-baked `vm.status.color`; the background stays transparent
 * per the operator's "only the text and border are colored"
 * requirement.
 *
 * Markdown rendering + JS shrink-to-fit reuse the §17.27 `textBody`
 * primitives verbatim — WorkflowNode IS-A TextNode in the domain, and
 * the body content (the latest history entry's string) shares the
 * exact markdown pipeline. The only role-level addition vs the
 * TextNode view is the status badge + the swapped `data-view-kind`
 * attribute so e2e selectors can target the new tile shape.
 */

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { renderMarkdownToHtml } from "../../markdown/markdownToHtml.js";
import type { WorkflowNodeViewModel } from "../NodeViewModel.js";
import { formatAge } from "../ageFormat.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "../TextNode/textBody.js";
import { renderStatusBadge, statusBadgeStyles } from "./statusBadge.js";

@customElement("workflow-node-as-child")
export class WorkflowNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: WorkflowNodeViewModel | null = null;

  private resizeObserver: ResizeObserver | null = null;

  static styles = [tileLayoutStyles, textBodyStyles, statusBadgeStyles];

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
    return html`
      <h2
        class="title"
        data-testid="title"
        data-view-kind="WorkflowNode"
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
      ${renderStatusBadge(status)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "workflow-node-as-child": WorkflowNodeAsChild;
  }
}
