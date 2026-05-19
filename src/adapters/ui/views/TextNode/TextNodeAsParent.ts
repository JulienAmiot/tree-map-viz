/**
 * `<text-node-as-parent>` — large parent-strip rendering for `TextNode`
 * (SPEC §5 — refined in §17.14, §17.18, §17.27, §17.30).
 *
 * Layout (post-§17.30):
 *   - Title (top, `3vh` row, `vh`-scaled font, consistent across tiles).
 *   - Value (fills the tile below the title) — the `text` of the latest
 *     entry, parsed as **markdown** (SPEC §17.27) and rendered into a
 *     `.md-body` block whose font-size is tile-relative (`cqmin`
 *     clamp) and tightened by a JS shrink-to-fit pass so the full
 *     content stays visible regardless of tile size.
 *   - Timestamp (**bottom-right** corner of the focused-panel strip,
 *     §17.30) — the `asOf` of the latest entry in the underlying
 *     `TextCard` history. The `bottom: 0.4rem` / `right: 0.6rem`
 *     offsets (inherited from `tileLayoutStyles`) measure against the
 *     `<parent-identity-strip>` wrapper, not this element's own host
 *     (the per-view's `:host { position: static }` override lets the
 *     absolute positioning escape one layer outward), so the parent
 *     date sits at the same visual distance from the focused panel's
 *     outer edge as a child tile's date sits from its tile outer
 *     edge — **0.4rem / 0.6rem in both cases**.
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

import { renderMarkdownToHtml } from "../../markdown/markdownToHtml.js";
import { disabledToggleStyles, renderDisabledToggleFor } from "../disabledToggle.js";
import {
  INLINE_EDIT_TITLE_EVENT,
  INLINE_EDIT_VALUE_EVENT,
  type InlineEditTitleDetail,
  type InlineEditValueDetail,
} from "../inlineEditEvents.js";
import {
  focusAndSelectInline,
  inlineEditKey,
} from "../inlineEditHelpers.js";
import type { TextNodeViewModel } from "../NodeViewModel.js";
import { formatAge } from "../ageFormat.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import { fitMarkdownBodyToTile, textBodyStyles } from "./textBody.js";

@customElement("text-node-as-parent")
export class TextNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: TextNodeViewModel | null = null;

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
    css`
      :host {
        --subtitle-row-height: 2vh;
      }
      /* SPEC 17.30 -- escape the parent strip's outer padding so the
         absolutely-positioned .timestamp lands at the strip's outer
         bottom-right corner with the same 0.4rem / 0.6rem offsets a
         child tile uses. The shared tileLayoutStyles sets :host {
         position: relative } which makes this element its own
         containing block; flipping back to static lets the timestamp
         resolve its containing block to <parent-identity-strip>'s
         .strip wrapper (the next positioned ancestor up the tree),
         so the inherited .timestamp { bottom: 0.4rem; right: 0.6rem }
         measures against the focused panel itself. The container-type:
         size from tileLayoutStyles (used by the value's cqmin
         font-size) is preserved -- it does NOT require position:
         relative. */
      :host {
        position: static;
      }
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
         3vh title row (no vertical overflow). Pre-17.37 the input
         inherited the value-edit's 0.25rem top + 0.25rem bottom
         padding, which combined with the 2.4vh font-size and the
         1px border made the input ~5-6px taller than the title
         row, visibly bulging into the value area whenever the
         operator clicked the title to edit. Post-17.37 the input
         occupies the full title-row height (height: 100%) with
         no vertical padding and a line-height of 1, so it sits
         flush with where the static title sat -- entering edit
         mode no longer shifts the focused panel's layout
         downward. min-width: 0 + max-width defeat the input's
         intrinsic min-content so a narrow title row still
         constrains the input to the row width and the input never
         extends past the strip (and therefore never past the
         viewport).

         SPEC 17.50 -- the inline title-edit must NOT run behind
         the §17.47 close-X / edit-pencil buttons that overlay the
         title row's right end. The static title text gets clipped
         by text-overflow: ellipsis, but an INTERACTIVE input has
         to keep the operator's typed text visible. The strip
         publishes --strip-gutter-right (one OR two button widths,
         see ParentIdentityStrip) and we subtract it from max-width.
         The fallback 0px keeps unit fixtures that mount the per-
         view OUTSIDE the strip rendering at the row's full width. */
      .title-edit {
        height: 100%;
        padding: 0 0.4rem;
        line-height: 1;
        min-width: 0;
        max-width: calc(100% - var(--strip-gutter-right, 0px));
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
    return html`
      ${this.renderTitle()}
      <div class="subtitle" data-testid="subtitle">
        ${renderDisabledToggleFor(this, this.vm.id, this.vm.disabled ?? false)}
      </div>
      ${value.dateIso && this.editingField !== "value"
        ? html`<time
            class="timestamp"
            data-testid="value-date"
            datetime=${value.dateIso}
            style=${value.dateColor ? `--age-color: ${value.dateColor}` : ""}
            >${dateLabel}</time
          >`
        : nothing}
      <div class="value-area" data-testid="value-row">
        ${this.editingField === "value"
          ? this.renderValueEditor(value.text)
          : html`<div
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
      </div>
    `;
  }

  /** SPEC 17.28 -- title row, click-to-edit affordance. */
  private renderTitle() {
    if (!this.vm) return nothing;
    if (this.editingField === "title") {
      return html`<h1
        class="title"
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
      data-testid="title"
      data-view-kind="TextNode"
      data-id=${this.vm.id}
      role="button"
      tabindex="0"
      title="Click to edit title"
      @click=${this.startTitleEdit}
    >
      ${this.vm.title}
    </h1>`;
  }

  /** SPEC 17.28 -- multi-line markdown source editor. */
  private renderValueEditor(initial: string) {
    return html`<textarea
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
