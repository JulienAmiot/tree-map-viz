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

import { css, html, nothing, type TemplateResult } from "lit";

import type {
  BusinessScoreCardValueViewModel,
  ComputedValueViewModel,
} from "./NodeViewModel.js";

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
`;
