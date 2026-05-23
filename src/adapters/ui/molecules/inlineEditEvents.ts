/**
 * Inline-edit event contracts for the focused-panel views (SPEC §17.28).
 *
 * The TextNode / BusinessScoreCard "as parent" views surface two
 * click-to-edit affordances on the focused panel:
 *
 *   - **Title edit** — clicking the `<h1 class="title">` swaps it for
 *     a single-line input; pressing Enter or blurring commits.
 *     Dispatches `inline-edit-title { nodeId, title }`.
 *
 *   - **Value edit** — clicking the value body / figure swaps it for
 *     an editor (textarea for TextNode, number input for BSC); commits
 *     the same way. Dispatches `inline-edit-value { nodeId, value, asOf? }`
 *     so the composition root can append a new `TimestampedValue` to
 *     the node's history (NOT replace the previous entry — the inline
 *     edit grows the history, mirroring the §17.13 / §17.14 contract).
 *
 * The events are defined in their own module (rather than re-declared
 * in each view) so the composition root has a single import for both
 * detail types and so the per-view files keep imports tight. Both events
 * `bubble` + `composed` so the screen catches them above the per-kind
 * shadow trees and re-emits them as-is to `main.ts`.
 *
 * `value` on `inline-edit-value` is `string | number` — the discriminant
 * is implicit by node kind (the composition root resolves the kind from
 * the node id). A future refactor could narrow this with a discriminated
 * union if a kind ever has a non-primitive value, but today every value
 * is a primitive so the simpler shape pays for itself.
 */

export const INLINE_EDIT_TITLE_EVENT = "inline-edit-title";
export const INLINE_EDIT_VALUE_EVENT = "inline-edit-value";
/** SPEC §17.126 — click-to-edit on the §17.125 `(unit)` chip. */
export const INLINE_EDIT_UNIT_EVENT = "inline-edit-unit";

/** Detail payload of {@link INLINE_EDIT_TITLE_EVENT}. */
export type InlineEditTitleDetail = {
  readonly nodeId: string;
  readonly title: string;
};

/** Detail payload of {@link INLINE_EDIT_VALUE_EVENT}. */
export type InlineEditValueDetail = {
  readonly nodeId: string;
  /** Primitive value matching the node kind (string for TextNode, number for BSC). */
  readonly value: string | number;
  /**
   * Optional override; when omitted the composition root substitutes
   * `new Date()`. Pinned in the seam so a future "back-fill an old
   * observation" inline editor can supply a date without changing the
   * event shape.
   */
  readonly asOf?: Date;
};

/** SPEC §17.126 — detail of {@link INLINE_EDIT_UNIT_EVENT}; empty
 *  `unit` is allowed (a metric can be unit-less). */
export type InlineEditUnitDetail = {
  readonly nodeId: string;
  readonly unit: string;
};

declare global {
  interface HTMLElementEventMap {
    "inline-edit-title": CustomEvent<InlineEditTitleDetail>;
    "inline-edit-value": CustomEvent<InlineEditValueDetail>;
    "inline-edit-unit": CustomEvent<InlineEditUnitDetail>;
  }
}
