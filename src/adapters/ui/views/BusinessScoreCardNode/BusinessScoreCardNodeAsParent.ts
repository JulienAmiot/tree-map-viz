/**
 * `<business-score-card-as-parent>` — large parent-strip rendering for
 * `BusinessScoreCardNode` (SPEC §5 — refined in §17.14, §17.18, §17.30).
 *
 * Layout (post-§17.30):
 *   - Title (top, `3vh` row, consistent across tiles).
 *   - **Description** (just below the title, vh-relative, muted) when
 *     `vm.description` is non-empty (§17.30). The metric's definition
 *     is high-signal information on the **focused panel** but would
 *     crowd a child tile, so it is intentionally **only rendered in
 *     the parent role**. Read-only here; the operator edits it
 *     through the §17.28 edit modal (which already exposes the field).
 *   - Value (fills the remaining vertical space) — number + unit
 *     (1/3 size) for value branches; `<n> children` for childrenCount
 *     > 0; empty for childrenCount = 0. The Σ badge for `computedMean`
 *     is rendered adjacent to the value.
 *   - Timestamp (**bottom-right** corner of the focused-panel strip,
 *     §17.30) — own `asOf` for `recordedValue`, the **most recent date
 *     amongst children's current-value dates** for `computedMean` /
 *     `childrenCount` (the answer to "as of when is this aggregate
 *     current?", computed by `domain/aggregation/currentValueDate`).
 *     The timestamp's `bottom: 0.4rem` / `right: 0.6rem` offsets
 *     (inherited from `tileLayoutStyles`) measure against the
 *     `<parent-identity-strip>` wrapper rather than this element's
 *     own host (the per-view's `:host { position: static }` override
 *     lets the absolute positioning escape one layer outward), so
 *     the parent's date sits at the same visual distance from the
 *     focused panel's outer edge as a child tile's date does from
 *     its tile outer edge — **0.4rem / 0.6rem in both cases**.
 *   - Timestamp colour follows a warm-orange → cold-pale-blue lerp
 *     by age in days (`dateAgeColor`), so a glance at the wall of
 *     tiles tells the user which numbers are *fresh* and which are
 *     *stale* without reading the date.
 *
 * Why the description is only on the parent role (not on child tiles):
 *   - On a child tile a multi-line description would compete with the
 *     big figure for the limited tile body. The §17.14 layout reserved
 *     the per-tile body for the timestamped value precisely because
 *     "title + figure + date" is the right at-a-glance signature for
 *     a tile in a wall of tiles.
 *   - On the focused panel, the user has zoomed in on a single node;
 *     the metric's definition ("Quarterly revenue across the EU-North
 *     region; sourced from the BI data warehouse.") is exactly the
 *     context they need to interpret the figure they came to see.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

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
import type { BusinessScoreCardNodeViewModel } from "../NodeViewModel.js";
import { tileLayoutStyles } from "../tileLayoutStyles.js";
import {
  formatDate,
  renderValueTemplate,
  timestampForValue,
} from "./valueTemplate.js";

@customElement("business-score-card-as-parent")
export class BusinessScoreCardNodeAsParent extends LitElement {
  @property({ attribute: false })
  vm: BusinessScoreCardNodeViewModel | null = null;

  /**
   * SPEC 17.28 -- inline edit lifecycle. `value` is only reachable for
   * `recordedValue` BSCs (the other branches are derived from children
   * and have no recorded value to mutate); `title` is always reachable.
   */
  @state()
  private editingField: "title" | "value" | null = null;

  static styles = [
    tileLayoutStyles,
    css`
      /* SPEC 17.30 -- escape the parent strip's outer padding so the
         absolutely-positioned .timestamp lands at the strip's outer
         bottom-right corner with the same 0.4rem / 0.6rem offsets a
         child tile uses. The shared tileLayoutStyles sets :host {
         position: relative } which makes the per-view its own
         containing block; flipping back to static lets the timestamp
         resolve its containing block to <parent-identity-strip>'s
         .strip wrapper (the next positioned ancestor up the tree),
         so .timestamp { bottom: 0.4rem; right: 0.6rem } measures
         against the focused panel itself. The container-type: size
         from tileLayoutStyles (used by the value's cqmin font-size)
         is preserved -- it does NOT require position: relative. */
      :host {
        position: static;
        /* Stack title -> description -> value-area vertically and
           let the value-area absorb the remaining vertical space.
           tileLayoutStyles uses display: block with .value-area
           hard-coded to height: calc(100% - 3vh) -- that calc only
           accounts for the title row, so it would overlap the new
           description row. A flex column with flex:1 on the
           value-area keeps the layout self-adjusting whether the
           description is rendered or not (§17.30). */
        display: flex;
        flex-direction: column;
      }
      .title {
        font-size: 2.4vh;
        font-weight: 700;
        flex: 0 0 auto;
        /* SPEC 17.31 -- the focused-panel title is painted with the
           board's fresh-date colour (the same accent that drives the
           timestamp's age gradient). The --board-fresh custom
           property is set on the tree-graph-screen host by the
           composition root on every refresh and inherits through the
           shadow boundaries down to here. The currentColor fallback
           keeps unit fixtures readable without the prop being set. */
        color: var(--board-fresh, currentColor);
      }
      /* SPEC 17.30 -- the metric's definition. vh-relative so it
         matches the title's typographic scale; muted colour so the
         title remains the dominant element on the focused panel.
         max-height + line-clamp keeps a long description from
         pushing the value off-screen on a small kiosk display. */
      .description {
        margin: 0.4vh 0 0 0;
        font-size: 1.5vh;
        line-height: 1.35;
        color: color-mix(in srgb, currentColor 65%, transparent);
        font-style: italic;
        white-space: pre-line;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        flex: 0 0 auto;
      }
      .value-area {
        /* Override the shared height:calc(100% - 3vh) -- with the
           flex column above, value-area fills whatever is left after
           title (+ optional description). */
        height: auto;
        flex: 1 1 auto;
        min-height: 0;
        /* SPEC 17.39 -- escape the parent strip's right-side gutter so
           the centered .value lands at the strip's full-width center
           (matching the drill morph's end-state) instead of at the
           padding-right-shrunk content-area's center.

           Pre-§17.39 path: when the strip carried both close-X and
           pencil buttons, .strip { padding-right: clamp(5.5rem, 8vw,
           7.5rem) } shrunk the per-view's content area to
           strip-width - gutter. .value-area inherits that width;
           justify-content: center centered the .value span inside
           the shrunken value-area. The morphing tile, however, is
           positioned outside the strip's shadow DOM and so does NOT
           inherit the strip's padding -- it fills the strip's full
           rect, with the centered .value span at full-width center.
           At commit Lit re-rendered the strip with the per-view in
           the parent role and the .value snapped left by gutter / 2
           (~60 px on a 1280 px viewport) -- the operator's "centered
           value jumping to the left in the end" feedback.

           Post-§17.39 fix: a negative margin-right exactly cancels
           the strip's padding-right via the --strip-gutter-right
           custom property the strip publishes (single source of
           truth for the gutter literal). The .value-area's effective
           width becomes (content-area-width + gutter-right) =
           strip-width, so the centered .value lands at the strip's
           full-width center -- same as the morph end-state, no jump.
           The fallback (0px) makes the rule a no-op when the strip
           carries no buttons (root focus or VM=null). */
        margin-right: calc(0px - var(--strip-gutter-right, 0px));
      }
      .title.is-editable,
      .value.is-editable {
        cursor: text;
      }
      .title-edit,
      .value-edit {
        box-sizing: border-box;
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
        width: 100%;
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
         downward. min-width: 0 + max-width: 100% defeat the
         input's intrinsic min-content so a narrow title row
         still constrains the input to the row width and the
         input never extends past the strip (and therefore never
         past the viewport). */
      .title-edit {
        height: 100%;
        padding: 0 0.4rem;
        line-height: 1;
        min-width: 0;
        max-width: 100%;
      }
      .value-edit {
        font-size: inherit;
        text-align: center;
        max-width: 60%;
      }
    `,
  ];

  override updated(): void {
    if (this.editingField === "title") {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(
        "input.title-edit",
      );
      focusAndSelectInline(input ?? null);
    } else if (this.editingField === "value") {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(
        "input.value-edit",
      );
      focusAndSelectInline(input ?? null);
    }
  }

  render() {
    if (!this.vm) {
      return html``;
    }
    const dateIso = timestampForValue(this.vm);
    const dateColor = this.vm.dateColor;
    const description = this.vm.description.trim();
    return html`
      ${this.renderTitle()}
      ${description.length > 0
        ? html`<p class="description" data-testid="description">
            ${this.vm.description}
          </p>`
        : nothing}
      ${dateIso && this.editingField !== "value"
        ? html`<time
            class="timestamp"
            data-testid="value-date"
            datetime=${dateIso}
            style=${dateColor ? `--age-color: ${dateColor}` : ""}
            >${formatDate(dateIso)}</time
          >`
        : nothing}
      <div class="value-area" data-testid="value-row">
        ${this.renderValue()}
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
        data-view-kind="BusinessScoreCardNode"
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
      data-view-kind="BusinessScoreCardNode"
      data-id=${this.vm.id}
      role="button"
      tabindex="0"
      title="Click to edit title"
      @click=${this.startTitleEdit}
    >
      ${this.vm.title}
    </h1>`;
  }

  /**
   * SPEC 17.28 -- value content. The `recordedValue` branch is the
   * only one editable inline (the other branches derive from children).
   * For `recordedValue`, the value `<span>` becomes a click-to-edit
   * affordance; the input swap preserves the unit (still rendered as
   * a sibling) so the operator only changes the number.
   */
  private renderValue() {
    if (!this.vm) return nothing;
    const v = this.vm.value;
    if (this.editingField === "value" && v.kind === "recordedValue") {
      return html`<span class="value" data-testid="value" data-value-kind="recordedValue">
        <input
          class="value-edit"
          data-testid="value-edit"
          type="number"
          step="any"
          .value=${String(v.value)}
          @keydown=${(e: KeyboardEvent) => this.handleValueKey(e)}
          @blur=${(e: FocusEvent) => this.commitValue(e.target as HTMLInputElement)}
        /><span class="unit">&nbsp;${v.unit}</span>
      </span>`;
    }
    if (v.kind === "recordedValue") {
      return html`<span
        class="value is-editable"
        data-testid="value"
        data-value-kind="recordedValue"
        role="button"
        tabindex="0"
        title="Click to edit value"
        @click=${this.startValueEdit}
        >${v.value}<span class="unit">&nbsp;${v.unit}</span></span
      >`;
    }
    return renderValueTemplate(v);
  }

  private startTitleEdit = (): void => {
    if (!this.vm) return;
    this.editingField = "title";
  };

  private startValueEdit = (): void => {
    if (!this.vm) return;
    if (this.vm.value.kind !== "recordedValue") return;
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
    const intent = inlineEditKey(e, /* multiline */ false);
    if (intent === "commit") {
      e.preventDefault();
      this.commitValue(e.currentTarget as HTMLInputElement);
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

  private commitValue(input: HTMLInputElement | null): void {
    if (this.editingField !== "value") return;
    if (!this.vm || !input) {
      this.editingField = null;
      return;
    }
    const v = this.vm.value;
    if (v.kind !== "recordedValue") {
      this.editingField = null;
      return;
    }
    const raw = input.value.trim();
    const parsed = Number(raw);
    this.editingField = null;
    if (raw.length === 0 || Number.isNaN(parsed) || parsed === v.value) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<InlineEditValueDetail>(INLINE_EDIT_VALUE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id, value: parsed },
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "business-score-card-as-parent": BusinessScoreCardNodeAsParent;
  }
}
