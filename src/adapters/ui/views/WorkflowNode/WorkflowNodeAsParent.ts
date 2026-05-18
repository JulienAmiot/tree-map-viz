/**
 * `<workflow-node-as-parent>` — large parent-strip rendering for
 * `WorkflowNode` (SPEC §17.117).
 *
 * Mirrors `<text-node-as-parent>` end-to-end (bright off-white title,
 * markdown body with shrink-to-fit, click-to-edit title + value,
 * INLINE_EDIT_* dispatched events for the title + value mutations
 * the composition root routes back to `EditNodeService.editFields`
 * / `appendValue`) and adds a single new element: the §17.117 status
 * badge in the bottom-left corner of the focused panel.
 *
 * The badge follows the §17.30 timestamp playbook — the per-view's
 * `:host { position: static }` override lets the absolutely-positioned
 * badge escape one positioned-ancestor layer outward so its
 * containing block resolves to the `<parent-identity-strip>` wrapper,
 * landing the parent-role badge at the focused-panel's outer bottom-
 * left corner with the same 0.2rem / 0.35rem offsets a child tile
 * uses. The shared `tileLayoutStyles` `container-type: size` is
 * preserved (it does NOT require `position: relative`).
 *
 * The status itself is NOT inline-editable from the parent strip —
 * status mutations go through the Edit-node modal (§17.117 — the
 * status dropdown is sourced from `Board.workflowStatuses`, and the
 * parent strip's inline editors only handle the title + the
 * markdown-source value). A future strand may add a quick-cycle
 * affordance on the badge itself; today the badge is presentational.
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
  dispatchInlineTitleCommit,
  handleInlineTitleKey,
  renderInlineEditableTitle,
  titleInlineEditStyles,
} from "../inlineTitleEdit.js";
import type { WorkflowNodeViewModel } from "../NodeViewModel.js";
import { formatAge } from "../ageFormat.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "../TextNode/textBody.js";
import { renderStatusBadge, statusBadgeStyles } from "./statusBadge.js";

@customElement("workflow-node-as-parent")
export class WorkflowNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: WorkflowNodeViewModel | null = null;

  @state()
  private editingField: "title" | "value" | null = null;

  private resizeObserver: ResizeObserver | null = null;

  static readonly styles = [
    tileLayoutStyles,
    textBodyStyles,
    statusBadgeStyles,
    titleInlineEditStyles,
    css`
      :host {
        position: static;
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
    if (this.editingField === "title") {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(
        "input.title-edit",
      );
      focusAndSelectInline(input ?? null);
    } else if (this.editingField === "value") {
      const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>(
        "textarea.value-edit",
      );
      focusAndSelectInline(ta ?? null);
    }
  }

  private fitBody(): void {
    if (this.editingField === "value") return;
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
      ${this.renderTitle()}
      ${value.dateIso && this.editingField !== "value"
        ? html`<time
            class="timestamp"
            data-testid="value-date"
            datetime=${value.dateIso}
            style=${dateStyle}
            >${dateLabel}</time
          >`
        : nothing}
      <div class="value-area" data-testid="value-row">
        ${this.editingField === "value"
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
      ${renderStatusBadge(status)}
    `;
  }

  private renderTitle() {
    return renderInlineEditableTitle({
      target: this.vm ? { nodeId: this.vm.id, title: this.vm.title } : null,
      isEditing: this.editingField === "title",
      viewKind: "WorkflowNode",
      onStart: this.startTitleEdit,
      onKeydown: this.handleTitleKey,
      onBlur: this.handleTitleBlur,
    });
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

  private readonly startTitleEdit = (): void => {
    if (!this.vm) return;
    this.editingField = "title";
  };

  private readonly startValueEdit = (): void => {
    if (!this.vm) return;
    this.editingField = "value";
  };

  private readonly handleTitleKey = (e: KeyboardEvent): void => {
    handleInlineTitleKey(
      e,
      (input) => this.commitTitle(input),
      () => {
        this.editingField = null;
      },
    );
  };

  private readonly handleTitleBlur = (e: FocusEvent): void => {
    this.commitTitle(e.target as HTMLInputElement | null);
  };

  private readonly handleValueKey = (e: KeyboardEvent): void => {
    const intent = inlineEditKey(e, /* multiline */ true);
    if (intent === "commit") {
      e.preventDefault();
      this.commitValue(e.currentTarget as HTMLTextAreaElement);
    } else if (intent === "cancel") {
      e.preventDefault();
      this.editingField = null;
    }
  };

  private readonly handleValueBlur = (e: FocusEvent): void => {
    this.commitValue(e.target as HTMLTextAreaElement | null);
  };

  private commitTitle(input: HTMLInputElement | null): void {
    if (this.editingField !== "title") return;
    if (!this.vm || !input) {
      this.editingField = null;
      return;
    }
    const value = input.value;
    this.editingField = null;
    dispatchInlineTitleCommit(this, { nodeId: this.vm.id, title: this.vm.title }, value);
  }

  private commitValue(area: HTMLTextAreaElement | null): void {
    if (this.editingField !== "value") return;
    if (!this.vm || !area) {
      this.editingField = null;
      return;
    }
    const next = area.value;
    this.editingField = null;
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
