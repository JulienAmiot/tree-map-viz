/**
 * `<workflow-node-as-parent>` — large parent-strip rendering for
 * `WorkflowNode` (SPEC §17.117, §17.121e refresh).
 *
 * Mirrors `<text-node-as-parent>` end-to-end (bright off-white title,
 * markdown body with shrink-to-fit, click-to-edit title + value,
 * INLINE_EDIT_* dispatched events for the title + value mutations
 * the composition root routes back to `EditNodeService.editFields`
 * / `appendValue`) and adds the §17.117 status badge.
 *
 * SPEC §17.121e — the badge sits inside the shared `.subtitle` slot
 * directly under the title (was a bottom-left absolutely-positioned
 * corner pre-§17.121e). The slot is declared by `tileLayoutStyles`
 * and opted into via `--subtitle-row-height: 2vh` on `:host` below.
 * Both AsChild + AsParent opt into the same `2vh` so the badge sits
 * at the same vertical position relative to the title across the
 * two roles — visual parity is now a direct consequence of opting
 * into the shared slot rather than a side-effect of an absolute-
 * positioning escape trick. The `:host { position: static }` override
 * stays in place for the timestamp's outer-corner escape (the
 * timestamp still rides the §17.30 playbook), but the badge no
 * longer depends on it.
 *
 * SPEC §17.121f — the parent-strip status is now INLINE EDITABLE.
 * The subtitle slot renders a `<select class="status-badge-picker">`
 * (mirror of the §17.104 Computed* strategy picker) whose options
 * come from `vm.availableStatuses` (baked by the §17.121f mapper
 * from `Board.workflowStatuses`). A change on the picker dispatches
 * a `workflow-status-change` event with `{ nodeId, newStatusId }`;
 * the composition root in `main.ts` routes the event to
 * `EditNodeService.editFields({ kind: "Workflow", statusId })`,
 * atomic + persister-rolled-back like every other inline-edit
 * surface. The AsChild role keeps the read-only badge — child
 * tiles never expose inline editors (the operator drills into
 * the parent to edit). The §17.117 "status mutations go through
 * the Edit-node modal" hedge is superseded: the modal still works,
 * but the picker is now the primary affordance on the focused
 * panel.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { renderMarkdownToHtml } from "../../markdown/markdownToHtml.js";
import {
  INLINE_EDIT_VALUE_EVENT,
  type InlineEditValueDetail,
} from "../inlineEditEvents.js";
import {
  focusAndSelectInline,
  inlineEditKey,
} from "../inlineEditHelpers.js";
import {
  InlineTitleEditController,
  type InlineTitleEditTarget,
  titleInlineEditStyles,
} from "../inlineTitleEdit.js";
import type { WorkflowNodeViewModel } from "../NodeViewModel.js";
import { formatAge } from "../ageFormat.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "../TextNode/textBody.js";
import {
  WORKFLOW_STATUS_CHANGE_EVENT,
  renderStatusBadgePicker,
  statusBadgeStyles,
  type WorkflowStatusChangeDetail,
} from "./statusBadge.js";

@customElement("workflow-node-as-parent")
export class WorkflowNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: WorkflowNodeViewModel | null = null;

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
    css`
      :host {
        position: static;
        /* SPEC §17.121e — opt into the shared .subtitle slot from
           tileLayoutStyles. The 2vh row reserves space for the
           status badge directly under the title (was bottom-left
           absolute corner pre-§17.121e); the shared .value-area
           height formula reads this var and subtracts it from the
           body region. AsChild + AsParent both opt into the same
           2vh so the badge sits at the same vertical position
           relative to the title across the two roles. */
        --subtitle-row-height: 2vh;
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
    return html`
      ${this.titleEditor.renderTitle("WorkflowNode")}
      <div class="subtitle" data-testid="subtitle">
        ${renderStatusBadgePicker(
          this.vm.id,
          status,
          this.vm.availableStatuses,
          this.dispatchStatusChange,
        )}
      </div>
      ${value.dateIso && !this.editingValue
        ? html`<time
            class="timestamp"
            data-testid="value-date"
            datetime=${value.dateIso}
            style=${dateStyle}
            >${dateLabel}</time
          >`
        : nothing}
      <div class="value-area" data-testid="value-row">
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
    `;
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
