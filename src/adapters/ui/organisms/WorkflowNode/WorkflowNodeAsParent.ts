/**
 * `<workflow-node-as-parent>` — large parent-strip rendering for
 * `WorkflowNode` (SPEC §17.117, §17.121e refresh, §17.136 S7).
 *
 * Mirrors `<text-node-as-parent>` end-to-end (bright off-white title,
 * markdown body with shrink-to-fit, click-to-edit title + value,
 * INLINE_EDIT_* dispatched events for the title + value mutations
 * the composition root routes back to `EditNodeService.editFields`
 * / `appendValue`) and adds the §17.117 status badge.
 *
 * §17.136 S7 — the entire render output is wrapped in a `<card-frame>`
 * molecule with inline `--card-header-height: 18%` (§17.141) +
 * --card-footer-height: 8%` overrides (focused-panel host is ~85vh;
 * the molecule's 22%/12% defaults would dominate). Slot routing
 * (same shape as S1 / S3 / S5): `icons` carries the §17.121i disabled
 * switch (WorkflowNode has no aggregation flag, so no §17.116 sigma
 * badge); `unit` stays empty (no unit chip on a workflow card);
 * `title` carries the inline-editable `<h1>` wrapped in a `<div
 * slot="title">` (same wrap pattern as the §17.136 S3 Computed
 * AsParent); `subtitle` carries the §17.121f inline status-badge
 * picker; `body` carries the markdown `.md-body` value-area;
 * `footer-right` carries the §17.18 timestamp; `footer-left` +
 * `header-actions` stay empty until S13. The pre-§17.30 `:host {
 * position: static }` strip-escape retires (the timestamp now lives
 * in card-frame's footer-right slot in natural flow, not as an
 * absolute corner-anchor).
 *
 * SPEC §17.121e — the badge sits inside the shared `.subtitle` slot
 * directly under the title (was a bottom-left absolutely-positioned
 * corner pre-§17.121e). The slot is declared by `tileLayoutStyles`
 * and opted into via `--subtitle-row-height: 2vh` on `:host` below.
 * Both AsChild + AsParent opt into the same `2vh` so the badge sits
 * at the same vertical position relative to the title across the
 * two roles.
 *
 * SPEC §17.121f — the parent-strip status is now INLINE EDITABLE.
 * The subtitle slot renders a `<select class="status-badge-picker">`
 * (mirror of the §17.104 Computed* strategy picker); a change fires
 * `workflow-status-change` which `main.ts` routes to
 * `EditNodeService.editFields({ kind: "Workflow", statusId })`. The
 * AsChild role keeps the read-only badge.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { renderMarkdownToHtml } from "../../atoms/markdownToHtml.js";
import "../../molecules/cardFrame/CardFrame.js";
import {
  INLINE_EDIT_VALUE_EVENT,
  type InlineEditValueDetail,
} from "../../molecules/inlineEditEvents.js";
import {
  focusAndSelectInline,
  inlineEditKey,
} from "../../molecules/inlineEditHelpers.js";
import {
  InlineTitleEditController,
  type InlineTitleEditTarget,
  titleInlineEditStyles,
} from "../../molecules/inlineTitleEdit.js";
import type { WorkflowNodeViewModel } from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "../TextNode/textBody.js";
import { disabledToggleStyles } from "../../molecules/disabledToggle.js";
import {
  headerActionsStyles,
  renderHeaderActions,
} from "../../molecules/headerActions.js";
import {
  WORKFLOW_STATUS_CHANGE_EVENT,
  renderStatusBadgePicker,
  statusBadgeStyles,
  type WorkflowStatusChangeDetail,
} from "../../molecules/statusBadge.js";

@customElement("workflow-node-as-parent")
export class WorkflowNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: WorkflowNodeViewModel | null = null;

  /** SPEC §17.136 S13a -- focused-node parent id; consumed by the
      `header-actions` slot via `renderHeaderActions`. */
  @property({ attribute: "parent-id" })
  parentId = "";

  @state()
  private editingValue = false;

  private resizeObserver: ResizeObserver | null = null;

  private readonly titleEditor = new InlineTitleEditController(this);

  getInlineTitleEditTarget(): InlineTitleEditTarget | null {
    return this.vm ? { nodeId: this.vm.id, title: this.vm.title } : null;
  }

  static readonly styles = [
    tileLayoutStyles,
    textBodyStyles,
    statusBadgeStyles,
    titleInlineEditStyles,
    disabledToggleStyles,
    headerActionsStyles,
    css`
      :host {
        /* SPEC §17.121e — opt into the shared .subtitle slot from
           tileLayoutStyles. The 2vh row reserves space for the
           status badge directly under the title (was bottom-left
           absolute corner pre-§17.121e); the shared .value-area
           height formula reads this var and subtracts it from the
           body region. AsChild + AsParent both opt into the same
           2vh so the badge sits at the same vertical position
           relative to the title across the two roles.

           SPEC 17.136 S7 -- the pre-17.30 :host position:static
           strip-escape (which let the absolute timestamp resolve
           against the outer parent-identity-strip) retires; the
           timestamp lives in card-frame's footer-right slot in
           natural flow now. The shared tileLayoutStyles
           :host position:relative takes effect again. */
        --subtitle-row-height: 2vh;
      }
      /* SPEC §17.136 S7 — card-frame's footer-right slot flows the
         timestamp in the natural footer row; the shared
         tileLayoutStyles still pins position:absolute + bottom + right
         for the unmigrated Workflow/Picture/URL AsChild views (S8-S12
         retire those; S13 drops the shared absolute rule), so we
         override here to drop the absolute positioning while leaving
         the age-color / font-size / tabular-nums / nowrap declarations
         from tileLayoutStyles intact. */
      .timestamp {
        position: static;
        bottom: auto;
        right: auto;
      }
      .md-body.is-editable {
        cursor: text;
      }
      .value-edit {
        box-sizing: border-box;
        width: 100%;
        background: color-mix(in srgb, currentColor 6%, transparent);
        color: inherit;
        border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
        border-radius: 4px;
        padding: 0.25rem 0.4rem;
        font: inherit;
        min-height: 6rem;
        height: 100%;
        resize: none;
        font-family: inherit;
        line-height: 1.4;
      }
      .value-edit:focus {
        outline: none;
        border-color: color-mix(in srgb, currentColor 65%, transparent);
        background: color-mix(in srgb, currentColor 12%, transparent);
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
    if (this.editingValue) {
      const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>(
        "textarea.value-edit",
      );
      focusAndSelectInline(ta ?? null);
    }
  }

  private fitBody(): void {
    if (this.editingValue) return;
    const body = this.shadowRoot?.querySelector<HTMLElement>(".md-body");
    fitMarkdownBodyToTile(body ?? null);
  }

  render() {
    if (!this.vm) return html``;
    const { value, status } = this.vm;
    const dateLabel = value.dateIso ? formatAge(value.dateIso) : "";
    const empty = value.text.length === 0;
    const dateStyle = value.dateColor ? `--age-color: ${value.dateColor}` : "";
    const bodyClass = empty ? "md-body empty is-editable" : "md-body is-editable";
    const bodyContent = empty ? "" : unsafeHTML(renderMarkdownToHtml(value.text));
    // SPEC §17.136 S7 -- panel-relative header + footer heights
    // (focused-panel host is ~85vh; card-frame's 22%/12% defaults
    // would dominate the value-area).
    const sizing = "--card-header-height: 18%; --card-footer-height: 8%";
    const titleH1 = this.titleEditor.renderTitle("WorkflowNode", nothing);
    return html`<card-frame style=${sizing}>
      <span slot="icons" data-testid="icons-slot"></span>
      <span slot="header-actions"
        >${renderHeaderActions(this, { nodeId: this.vm.id, parentId: this.parentId })}</span
      >
      <div slot="title" data-testid="title-slot">${titleH1}</div>
      <div class="subtitle" slot="subtitle" data-testid="subtitle">
        ${renderStatusBadgePicker(
          this.vm.id,
          status,
          this.vm.availableStatuses,
          this.dispatchStatusChange,
        )}
      </div>
      <div class="value-area" slot="body" data-testid="value-row">
        ${this.editingValue
          ? this.renderValueEditor(value.text)
          : html`<div
              class=${bodyClass}
              data-testid="value"
              data-value-kind="textValue"
              role="button"
              tabindex="0"
              title="Click to edit value"
              @click=${this.startValueEdit}
            >
              ${bodyContent}
            </div>`}
      </div>
      ${value.dateIso && !this.editingValue
        ? html`<time
            class="timestamp"
            slot="footer-right"
            data-testid="value-date"
            datetime=${value.dateIso}
            style=${dateStyle}
            >${dateLabel}</time
          >`
        : nothing}
    </card-frame>`;
  }

  private renderValueEditor(initial: string) {
    return html`<textarea
      class="value-edit"
      data-testid="value-edit"
      .value=${initial}
      @keydown=${this.handleValueKey}
      @blur=${this.handleValueBlur}
    ></textarea>`;
  }

  private readonly startValueEdit = (): void => {
    if (!this.vm) return;
    this.editingValue = true;
  };

  private readonly handleValueKey = (e: KeyboardEvent): void => {
    const intent = inlineEditKey(e, /* multiline */ true);
    if (intent === "commit") {
      e.preventDefault();
      this.commitValue(e.currentTarget as HTMLTextAreaElement);
    } else if (intent === "cancel") {
      e.preventDefault();
      this.editingValue = false;
    }
  };

  private readonly handleValueBlur = (e: FocusEvent): void => {
    this.commitValue(e.target as HTMLTextAreaElement | null);
  };

  /**
   * SPEC §17.121f — dispatch the inline status-picker change as a
   * bubbling + composed `workflow-status-change` event. The arrow
   * binding makes the function identity-stable across renders so
   * Lit's `@change` listener doesn't have to rebind every paint.
   */
  private readonly dispatchStatusChange = (newStatusId: string): void => {
    if (!this.vm) return;
    this.dispatchEvent(
      new CustomEvent<WorkflowStatusChangeDetail>(WORKFLOW_STATUS_CHANGE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id, newStatusId },
      }),
    );
  };


  private commitValue(area: HTMLTextAreaElement | null): void {
    if (!this.editingValue) return;
    if (!this.vm || !area) {
      this.editingValue = false;
      return;
    }
    const next = area.value;
    this.editingValue = false;
    if (next === this.vm.value.text) return;
    this.dispatchEvent(
      new CustomEvent<InlineEditValueDetail>(INLINE_EDIT_VALUE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id, value: next },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "workflow-node-as-parent": WorkflowNodeAsParent;
  }
}
