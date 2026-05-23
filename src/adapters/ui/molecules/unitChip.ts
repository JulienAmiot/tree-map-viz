/**
 * SPEC §17.125 — `(unit)` bracket chip rendered as a left-of-title
 * prefix on every BSC + CBSN tile (both AsChild + AsParent roles).
 *
 * Operator-requested move from the §17.116 / §17.116d `.unit-below`
 * block sibling (which sat under the value-area) to a subtle
 * parenthesised chip at the head of the title row, immediately to
 * the left of the title text. Three drivers:
 *
 *  - **Free real estate under the value** — once the unit sits on
 *    the title row, the value-area can use the freed vertical
 *    space for the target row + timestamp without competing with
 *    a `.unit-below` block. The §17.116d "title → value → unit →
 *    timestamp" top-to-bottom scan collapses to "title(unit) →
 *    value → timestamp" which is shorter and pulls the eye to
 *    the figure faster.
 *  - **Pairs the unit with the metric's identity** — the unit is
 *    a property of the metric (a definition), not of the
 *    *measurement* (the figure). Anchoring it to the title row
 *    mirrors how operators write metric names ("Revenue (USD)",
 *    "On-time delivery (%)") and how the unit is read aloud when
 *    the title is announced by assistive tech.
 *  - **Editable inline as a single affordance in §17.126** — once
 *    the chip lives in the title row the §17.126 strand can grow
 *    a click-to-edit affordance on the chip itself (without
 *    rebuilding the value-area), reusing the §17.28 inline-edit
 *    pattern with a new `INLINE_EDIT_UNIT_EVENT`.
 *
 * The chip is rendered with parentheses baked into the template
 * text (`(USD)` rather than a `(`/`)` pseudo-element pair) so the
 * unit text reads correctly to screen readers without a custom
 * `aria-label` — the parens are part of the chip's accessible name.
 *
 * The chip styling is opt-in via {@link unitChipStyles} which view
 * modules mix into their static `styles` array. Sizing follows the
 * surrounding title's `em` scale — the chip reads at ~0.7em with
 * a desaturated colour so it sits as a quiet annotation rather than
 * a competing element.
 *
 * Empty / non-applicable units (BSC `childrenCount` branch, or an
 * empty unit string) collapse to `nothing` so the helper is safe
 * to drop into the title row unconditionally.
 */

import {
  css,
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult,
} from "lit";

import {
  INLINE_EDIT_UNIT_EVENT,
  type InlineEditUnitDetail,
} from "../views/inlineEditEvents.js";
import { focusAndSelectInline, inlineEditKey } from "../views/inlineEditHelpers.js";
import type {
  BusinessScoreCardValueViewModel,
  ComputedValueViewModel,
} from "../views/NodeViewModel.js";

/**
 * SPEC §17.125 — render the unit chip when {@param unit} is
 * non-empty; return `nothing` when there is no unit to surface
 * (childrenCount branches, empty unit strings).
 */
export function renderUnitChip(unit: string): TemplateResult | typeof nothing {
  if (!unit) return nothing;
  return html`<span class="unit-chip" data-testid="unit-chip">(${unit})</span>`;
}

/**
 * SPEC §17.125 — type-safe unit extraction for a BSC value
 * view-model. The `childrenCount` branch has no unit by domain
 * contract (n-children rendering carries no measurement units),
 * so the helper returns the empty string there.
 */
export function unitFromBscValue(value: BusinessScoreCardValueViewModel): string {
  if (value.kind === "childrenCount") return "";
  return value.unit;
}

/**
 * SPEC §17.125 — type-safe unit extraction for a Computed* value
 * view-model. Only the `numeric` branch carries a unit; the
 * `empty` + `childrenCount` warning branches have no unit so the
 * helper returns the empty string.
 */
export function unitFromComputedValue(value: ComputedValueViewModel): string {
  if (value.kind === "numeric") return value.unit;
  return "";
}

/**
 * SPEC §17.125 — shared styles for the `.unit-chip` element. View
 * modules add this to their static `styles` array alongside
 * `tileLayoutStyles` so the chip reads consistently across every
 * BSC + CBSN tile.
 *
 * The chip is sized relative to the surrounding title (`0.7em`)
 * so it shrinks proportionally on the tree-map grid (3vh title
 * row) and reads at a matching scale on the focused panel
 * (2.4vh title row). The desaturated colour (75 % currentColor
 * mixed with transparent) keeps it as a quiet annotation rather
 * than a competing element on the title row.
 *
 * `margin-right: 0.25em` provides air between the chip and the
 * title text. `white-space: nowrap` prevents a multi-word unit
 * from breaking onto a second line and pushing the title down.
 */
export const unitChipStyles = css`
  .unit-chip {
    display: inline-block;
    margin-right: 0.25em;
    font-size: 0.7em;
    font-weight: 500;
    line-height: 1;
    color: color-mix(in srgb, currentColor 75%, transparent);
    white-space: nowrap;
    vertical-align: baseline;
  }
  /* SPEC §17.126 — click-to-edit + inline input variants. */
  .unit-chip.is-editable {
    cursor: text;
    border-radius: 3px;
    padding: 0 0.1em;
  }
  .unit-chip.is-editable:hover,
  .unit-chip.is-editable:focus-visible {
    background: color-mix(in srgb, currentColor 12%, transparent);
    outline: none;
  }
  .unit-chip-edit {
    box-sizing: border-box;
    width: 6ch;
    min-width: 4ch;
    max-width: 12ch;
    background: color-mix(in srgb, currentColor 8%, transparent);
    color: inherit;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    border-radius: 3px;
    padding: 0 0.15em;
    font: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: 1;
    vertical-align: baseline;
  }
  .unit-chip-edit:focus {
    outline: none;
    border-color: color-mix(in srgb, currentColor 65%, transparent);
    background: color-mix(in srgb, currentColor 16%, transparent);
  }
`;

/** SPEC §17.126 — host contract for {@link InlineUnitEditController}
 *  (parallel of §17.28's `InlineTitleEditHost` but for the chip). */
export interface InlineUnitEditTarget {
  readonly nodeId: string;
  readonly unit: string;
}

export interface InlineUnitEditHost extends ReactiveControllerHost, EventTarget {
  getInlineUnitEditTarget(): InlineUnitEditTarget | null;
  readonly shadowRoot: ShadowRoot | null;
}

/** SPEC §17.126 — owns the inline-unit-edit lifecycle (click swaps to
 *  input, Enter/blur commits via `INLINE_EDIT_UNIT_EVENT`, Escape
 *  cancels). Empty strings ARE allowed (a metric can be unit-less). */
export class InlineUnitEditController implements ReactiveController {
  private readonly host: InlineUnitEditHost;
  private isEditing = false;

  constructor(host: InlineUnitEditHost) {
    this.host = host;
    host.addController(this);
  }

  hostUpdated(): void {
    if (!this.isEditing) return;
    const input = this.host.shadowRoot?.querySelector<HTMLInputElement>(
      "input.unit-chip-edit",
    );
    focusAndSelectInline(input ?? null);
  }

  renderChip(): TemplateResult | typeof nothing {
    const target = this.host.getInlineUnitEditTarget();
    if (target === null) return nothing;
    if (this.isEditing) {
      return html`<input
        class="unit-chip unit-chip-edit"
        data-testid="unit-chip-edit"
        type="text"
        maxlength="20"
        .value=${target.unit}
        @keydown=${this.handleKey}
        @blur=${this.handleBlur}
        @click=${this.stopBubble}
      />`;
    }
    if (!target.unit) return nothing;
    return html`<span
      class="unit-chip is-editable"
      data-testid="unit-chip"
      role="button"
      tabindex="0"
      title="Click to edit unit"
      @click=${this.start}
    >(${target.unit})</span>`;
  }

  private readonly stopBubble = (e: Event): void => e.stopPropagation();

  private readonly start = (e: Event): void => {
    e.stopPropagation();
    this.isEditing = true;
    this.host.requestUpdate();
  };

  private readonly handleKey = (e: KeyboardEvent): void => {
    e.stopPropagation();
    const intent = inlineEditKey(e, /* multiline */ false);
    if (intent === "commit") {
      e.preventDefault();
      this.commit(e.currentTarget as HTMLInputElement);
    } else if (intent === "cancel") {
      e.preventDefault();
      this.isEditing = false;
      this.host.requestUpdate();
    }
  };

  private readonly handleBlur = (e: FocusEvent): void => {
    this.commit(e.target as HTMLInputElement | null);
  };

  private commit(input: HTMLInputElement | null): void {
    if (!this.isEditing) return;
    const target = this.host.getInlineUnitEditTarget();
    this.isEditing = false;
    this.host.requestUpdate();
    if (target === null || input === null) return;
    const next = input.value.trim();
    if (next === target.unit) return;
    this.host.dispatchEvent(
      new CustomEvent<InlineEditUnitDetail>(INLINE_EDIT_UNIT_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: target.nodeId, unit: next },
      }),
    );
  }
}
