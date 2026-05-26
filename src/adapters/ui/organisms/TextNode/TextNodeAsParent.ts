/**
 * `<text-node-as-parent>` — large parent-strip rendering for `TextNode`
 * (SPEC §5 — refined in §17.14, §17.18, §17.27, §17.30, §17.136 S5).
 *
 * Layout (post-§17.136 S5 — `<card-frame>` molecule drives the grid):
 *   - The entire render output is now wrapped in a single `<card-frame>`
 *     molecule with inline `--card-header-height: 18%` (§17.141) +
 *     `--card-footer-height: 8%` overrides (same focused-panel ratio
 *     S1 / S3 use; the molecule's 22 % / 12 % defaults would dominate
 *     the ~85 vh focused-panel host).
 *   - `slot="icons"`: the §17.121i disabled-switch toggle (TextNode
 *     has no aggregation flag, so no §17.116 sigma badge here).
 *   - `slot="unit"`: empty (TextNode has no unit chip).
 *   - `slot="title"`: title text only (the disabled switch moved to
 *     icons; pre-§17.136 the switch was the title's `firstElementChild`).
 *   - `slot="subtitle"`: the §17.121j placeholder span (kept so the
 *     focused-panel column reads consistently across kinds).
 *   - `slot="body"`: the §17.27 markdown `.md-body` value-area; the
 *     §17.28 textarea editor takes its place during inline value edits.
 *   - `slot="footer-right"`: the §17.18 timestamp `<time>` element.
 *     Pre-§17.136 S5 the timestamp was absolutely positioned at the
 *     focused panel's outer bottom-right corner via a one-level
 *     `:host { position: static }` escape; with card-frame the
 *     timestamp lives in the footer's natural flow and the host
 *     `position` override + the `--strip-gutter-right` escape on
 *     `.title-edit { max-width }` retire (the title cell is sibling
 *     to `header-actions` inside card-frame, no outer gutter to
 *     escape any more).
 *   - `slot="footer-left"` + `slot="header-actions"`: empty until
 *     S13 cuts over the close-X / edit-pencil affordances (off
 *     `<parent-identity-strip>`) and the §17.52 weight button.
 *   - Timestamp colour follows the §17.42 fixed white → dark-grey
 *     age gradient (`dateAgeColor`); the per-board fresh colour
 *     §17.21 / §17.31 plumbed has been retired.
 *
 * Description: TextNode has **no** description field per §17.15 (the
 * current value IS the description for a text card). Only the BSC
 * parent view renders a description, see §17.30 in
 * `BusinessScoreCardNodeAsParent`.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { renderMarkdownToHtml } from "../../atoms/markdownToHtml.js";
import "../../molecules/cardBody/CardBody.js";
import "../../molecules/cardFrame/CardFrame.js";
import { disabledToggleStyles } from "../../molecules/disabledToggle.js";
import {
  headerActionsStyles,
  renderHeaderActions,
} from "../../molecules/headerActions.js";
import {
  INLINE_EDIT_TITLE_EVENT,
  INLINE_EDIT_VALUE_EVENT,
  type InlineEditTitleDetail,
  type InlineEditValueDetail,
} from "../../molecules/inlineEditEvents.js";
import {
  focusAndSelectInline,
  inlineEditKey,
} from "../../molecules/inlineEditHelpers.js";
import type { TextNodeViewModel } from "../../molecules/NodeViewModel.js";
import { formatAge } from "../../atoms/ageFormat.js";
import { tileLayoutStyles } from "../../atoms/tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "./textBody.js";

@customElement("text-node-as-parent")
export class TextNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: TextNodeViewModel | null = null;

  /** SPEC §17.136 S13a -- focused-node parent id; consumed by the
      shared `renderHeaderActions` helper stamped into card-frame's
      `header-actions` slot. */
  @property({ attribute: "parent-id" })
  parentId = "";

  /**
   * §17.28 — which displayed field is currently being inline-edited.
   * `null` is the default (read-only display). Click on the title /
   * value swaps the relevant element to an editor; commit / cancel
   * resets back to `null` so the next render shows the static element
   * again (the VM will reflect the persisted value via the composition
   * root's refresh).
   */
  @state()
  private editingField: "title" | "value" | null = null;

  private resizeObserver: ResizeObserver | null = null;

  static styles = [
    tileLayoutStyles,
    textBodyStyles,
    disabledToggleStyles,
    headerActionsStyles,
    css`
      /* SPEC 17.136 S5 -- the per-view's host is the outer wrapper for
         card-frame; the molecule's three-row grid drives the layout.
         The pre-17.136 :host { position: static } strip-escape retires
         (the timestamp lives in card-frame's footer-right slot in
         natural flow, not as an absolute corner-anchor any more), so
         the shared tileLayoutStyles :host { position: relative } takes
         effect again and the container-type: size still drives the
         value's cqmin font-size. */
      /* Parent strip uses a slightly larger title than the children,
         while still respecting the §17.14 vh-relative sizing. */
      .title {
        font-size: 2.4vh;
        /* SPEC 17.42 -- the focused-panel title is bright off-white
           (rgb(245, 245, 245)) regardless of board. The per-board
           fresh-date colour the §17.21 / §17.31 design plumbed
           through --board-fresh has been retired; the kiosk's
           dark theme already gives the title enough emphasis with
           a flat near-white, and the per-board colour picker added
           a personalisation surface that nobody used. */
        color: rgb(245, 245, 245);
      }
      /* SPEC 17.136 S5 -- card-frame's footer-right slot flows the
         timestamp in the natural footer row; the shared
         tileLayoutStyles still pins position:absolute + bottom + right
         for the §17.18 AsChild corner-anchor (S6 will migrate that),
         so we override here to drop the absolute positioning while
         leaving the age-color / font-size / tabular-nums / nowrap
         declarations from tileLayoutStyles intact. */
      .timestamp {
        position: static;
        bottom: auto;
        right: auto;
      }
      /* SPEC 17.28 -- click-to-edit affordances. The cursor flip on
         hover signals the click target is editable; the value body
         stays markdown-rendered so the operator sees the rendered
         output until they actually start editing. */
      .title.is-editable,
      .md-body.is-editable {
        cursor: text;
      }
      .title-edit,
      .value-edit {
        box-sizing: border-box;
        width: 100%;
        background: color-mix(in srgb, currentColor 6%, transparent);
        color: inherit;
        border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
        border-radius: 4px;
        padding: 0.25rem 0.4rem;
        font: inherit;
      }
      .title-edit:focus,
      .value-edit:focus {
        outline: none;
        border-color: color-mix(in srgb, currentColor 65%, transparent);
        background: color-mix(in srgb, currentColor 12%, transparent);
      }
      .title-edit {
        font-size: inherit;
        font-weight: inherit;
      }
      /* SPEC 17.37 -- the inline title-edit fits exactly within the
         title row (no vertical overflow). Pre-17.37 the input
         inherited the value-edit's 0.25rem top + 0.25rem bottom
         padding, which combined with the 2.4vh font-size and the
         1px border made the input ~5-6px taller than the title
         row, visibly bulging into the value area whenever the
         operator clicked the title to edit. Post-17.37 the input
         occupies the full title-row height (height: 100%) with
         no vertical padding and a line-height of 1, so it sits
         flush with where the static title sat -- entering edit
         mode no longer shifts the focused panel's layout
         downward. min-width: 0 defeats the input's intrinsic
         min-content so a narrow title row still constrains the
         input to the row width.

         SPEC 17.136 S5 -- the §17.50-era --strip-gutter-right
         escape on max-width retires; the title cell now sits
         inside card-frame's title row sibling to the
         header-actions slot, so the operator's typed text never
         runs under the close-X / edit-pencil affordances by
         construction. */
      .title-edit {
        height: 100%;
        padding: 0 0.4rem;
        line-height: 1;
        min-width: 0;
        max-width: 100%;
      }
      .value-edit {
        min-height: 6rem;
        height: 100%;
        resize: none;
        font-family: inherit;
        line-height: 1.4;
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
    // SPEC 17.28 -- focus the editor element after Lit re-renders the
    // template, so the operator's caret lands inside the input/textarea
    // without an extra tap.
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
    // SPEC 17.28 -- skip the shrink-to-fit pass while the value is being
    // edited; the textarea uses its own sizing rules and would fight the
    // fitter on every keystroke.
    if (this.editingField === "value") return;
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
    // SPEC §17.136 S5 -- panel-relative header + footer heights
    // (focused-panel host is ~85vh; card-frame's 22% / 12% defaults
    // would dominate the value-area).
    const sizing = "--card-header-height: 24%; --card-footer-height: 8%";
    return html`<card-frame style=${sizing}>
      <span slot="icons" data-testid="icons-slot"></span>
      <span slot="header-actions"
        >${renderHeaderActions(this, { nodeId: this.vm.id, parentId: this.parentId })}</span
      >
      ${this.renderTitle()}
      <div class="subtitle" slot="subtitle" data-testid="subtitle"></div>
      <card-body slot="body" data-layout="lead-only" data-testid="value-row">
        ${this.editingField === "value"
          ? this.renderValueEditor(value.text)
          : html`<div
              slot="lead"
              class=${empty ? "md-body empty is-editable" : "md-body is-editable"}
              data-testid="value"
              data-value-kind="textValue"
              role="button"
              tabindex="0"
              title="Click to edit value"
              @click=${this.startValueEdit}
            >
              ${empty ? "" : unsafeHTML(renderMarkdownToHtml(value.text))}
            </div>`}
      </card-body>
      ${value.dateIso && this.editingField !== "value"
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

  /** SPEC 17.28 -- title row, click-to-edit affordance.
      SPEC §17.136 S5 -- the disabled toggle moved out of the title
      element into card-frame's dedicated `icons` slot. */
  private renderTitle() {
    if (!this.vm) return nothing;
    if (this.editingField === "title") {
      return html`<h1
        class="title"
        slot="title"
        data-testid="title"
        data-view-kind="TextNode"
        data-id=${this.vm.id}
      >
        <input
          class="title-edit"
          data-testid="title-edit"
          type="text"
          maxlength="120"
          .value=${this.vm.title}
          @keydown=${(e: KeyboardEvent) => this.handleTitleKey(e)}
          @blur=${(e: FocusEvent) => this.commitTitle(e.target as HTMLInputElement)}
        />
      </h1>`;
    }
    return html`<h1
      class="title is-editable"
      slot="title"
      data-testid="title"
      data-view-kind="TextNode"
      data-id=${this.vm.id}
      role="button"
      tabindex="0"
      title="Click to edit title"
      @click=${this.startTitleEdit}
    >${this.vm.title}</h1>`;
  }

  /** SPEC 17.28 -- multi-line markdown source editor. */
  private renderValueEditor(initial: string) {
    return html`<textarea
      slot="lead"
      class="value-edit"
      data-testid="value-edit"
      .value=${initial}
      @keydown=${(e: KeyboardEvent) => this.handleValueKey(e)}
      @blur=${(e: FocusEvent) => this.commitValue(e.target as HTMLTextAreaElement)}
    ></textarea>`;
  }

  private startTitleEdit = (): void => {
    if (!this.vm) return;
    this.editingField = "title";
  };

  private startValueEdit = (): void => {
    if (!this.vm) return;
    this.editingField = "value";
  };

  private handleTitleKey(e: KeyboardEvent): void {
    const intent = inlineEditKey(e, /* multiline */ false);
    if (intent === "commit") {
      e.preventDefault();
      this.commitTitle(e.currentTarget as HTMLInputElement);
    } else if (intent === "cancel") {
      e.preventDefault();
      this.editingField = null;
    }
  }

  private handleValueKey(e: KeyboardEvent): void {
    const intent = inlineEditKey(e, /* multiline */ true);
    if (intent === "commit") {
      e.preventDefault();
      this.commitValue(e.currentTarget as HTMLTextAreaElement);
    } else if (intent === "cancel") {
      e.preventDefault();
      this.editingField = null;
    }
  }

  private commitTitle(input: HTMLInputElement | null): void {
    if (this.editingField !== "title") return;
    if (!this.vm || !input) {
      this.editingField = null;
      return;
    }
    const next = input.value.trim();
    this.editingField = null;
    if (next.length === 0 || next === this.vm.title) {
      // Empty title is invalid (Title.of would reject); same-value
      // commits are no-ops. Either way, swap back to the static title
      // without dispatching.
      return;
    }
    this.dispatchEvent(
      new CustomEvent<InlineEditTitleDetail>(INLINE_EDIT_TITLE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id, title: next },
      }),
    );
  }

  private commitValue(area: HTMLTextAreaElement | null): void {
    if (this.editingField !== "value") return;
    if (!this.vm || !area) {
      this.editingField = null;
      return;
    }
    const next = area.value;
    this.editingField = null;
    if (next === this.vm.value.text) {
      // Same source -- no new history entry.
      return;
    }
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
    "text-node-as-parent": TextNodeAsParent;
  }
}
