/**
 * `<workflow-node-as-child>` — compact treemap-tile rendering for
 * `WorkflowNode` (SPEC §17.117, §17.121e refresh, §17.136 S8).
 *
 * Same overall layout as `<text-node-as-child>` (title row at top,
 * markdown body fills the middle, age-coloured timestamp at the
 * bottom-right) plus a §17.117 status badge. The badge's border +
 * text are coloured from the mapper-baked `vm.status.color`; the
 * background stays transparent per the operator's "only the text
 * and border are colored" requirement.
 *
 * §17.136 S8 — the entire render output is wrapped in a `<card-frame>`
 * molecule with the molecule's default `22 % / 12 %` header/footer
 * (small tree-map tile, defaults apply — same as S2 BSC AsChild + S4
 * Computed AsChild + S6 TextNode AsChild). Slot routing: disabled
 * indicator in `icons`, title text in `title`, §17.117 status badge
 * in `subtitle`, markdown `.md-body` value-area in `body`, §17.18
 * timestamp in `footer-right`. The pre-§17.136 S8 timestamp lived
 * at the tile's bottom-right corner via the shared
 * `tileLayoutStyles .timestamp { position: absolute; bottom: 0.2rem;
 * right: 0.35rem }` rule; with card-frame the timestamp lives in
 * the footer-right slot in natural flow, so we override the shared
 * rule with `position: static; bottom: auto; right: auto` (same
 * pattern as S2 / S4 / S5 / S6).
 *
 * Markdown rendering + JS shrink-to-fit reuse the §17.27 `textBody`
 * primitives verbatim — WorkflowNode IS-A TextNode in the domain, and
 * the body content (the latest history entry's string) shares the
 * exact markdown pipeline.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { renderMarkdownToHtml } from "../../atoms/markdownToHtml.js";
import "../../molecules/cardFrame/CardFrame.js";
import "../../molecules/childWeight/WeightEditButton.js";
import {
  disabledToggleStyles,
  renderDisabledIndicator,
} from "../../molecules/disabledToggle.js";
import type { WorkflowNodeViewModel } from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "../TextNode/textBody.js";
import { renderStatusBadge, statusBadgeStyles } from "../../molecules/statusBadge.js";

@customElement("workflow-node-as-child")
export class WorkflowNodeAsChild extends LitElement {
  @property({ attribute: false })
  vm: WorkflowNodeViewModel | null = null;

  /** SPEC §17.136 S13b -- per-child weight forwarded from
      `<children-grid>` via `<node-view>`; pre-fills the
      `<weight-edit-button>` in card-frame's footer-left slot. */
  @property({ type: Number })
  weight = 1;

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
      /* SPEC §17.136 S8 -- card-frame's footer-right slot flows the
         timestamp in the natural footer row; the shared
         tileLayoutStyles still pins position:absolute + bottom + right
         for the unmigrated Picture/URL AsChild views (S10/S12 retire
         those; S13 drops the shared absolute rule), so we override
         here to drop the absolute positioning while leaving the
         age-color / font-size / tabular-nums / nowrap declarations
         from tileLayoutStyles intact. */
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
    return html`<card-frame>
      <span slot="icons" data-testid="icons-slot"
        >${renderDisabledIndicator(disabled)}</span
      >
      <h2
        class="title"
        slot="title"
        data-testid="title"
        data-view-kind="WorkflowNode"
        data-id=${this.vm.id}
      >${this.vm.title}</h2>
      <div class="subtitle" slot="subtitle" data-testid="subtitle">
        ${renderStatusBadge(status)}
      </div>
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
            style=${dateStyle}
            >${dateLabel}</time
          >`
        : nothing}
      <weight-edit-button
        slot="footer-left"
        node-id=${this.vm.id}
        .weight=${this.weight}
      ></weight-edit-button>
    </card-frame>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "workflow-node-as-child": WorkflowNodeAsChild;
  }
}
