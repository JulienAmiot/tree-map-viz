/**
 * Inline weight-edit events for the §17.52 child-tile weight slider.
 *
 * SPEC §17.52 surfaces a per-child-tile inline weight edit affordance:
 * a small weight glyph in the tile's bottom-LEFT corner (mirror of the
 * §17.18 bottom-right timestamp) AND a long-press anywhere on the tile
 * both open a popover with a horizontal range slider. The slider's
 * current value updates the popover's numeric label live; the
 * underlying treemap layout does NOT reflow until the operator
 * releases the slider thumb (the `change` event), at which point the
 * popover dispatches `inline-edit-weight`, the composition root calls
 * `EditNodeService.editFields(node, { kind, weight })`, and the tree
 * refreshes. The §17.52 commit-on-release contract is the §17.51
 * step-doesn-t-auto-commit invariant carried over to a different
 * input modality: the operator can scrub the slider through several
 * intermediate values, but only one persisted update (and one
 * history-snapshotted weight change) lands per gesture.
 *
 * Two events.
 *
 *   - `weight-edit-open { nodeId, weight, anchorRect }` — fired by
 *     `<weight-edit-button>` (the corner icon) on tap, AND by
 *     `<children-grid>`'s long-press handler on the tile wrapper.
 *     Both bubble + composed cross the children-grid shadow boundary
 *     so the screen-level handler in `<tree-map-screen>` sees them.
 *     `anchorRect` is the tile's `getBoundingClientRect()` snapshot;
 *     the popover positions itself in viewport coordinates relative
 *     to the rect (auto-flipping when the rect is near a viewport
 *     edge so the popover never clips). Capturing the rect at
 *     dispatch time (rather than re-reading the tile element later)
 *     keeps the popover indifferent to subsequent treemap reflows
 *     mid-edit -- the anchor is a frozen point in space, not a live
 *     element reference.
 *
 *   - `inline-edit-weight { nodeId, weight }` -- fired by
 *     `<weight-edit-popover>` once the operator releases the slider
 *     thumb (the native `change` event on `<input type="range">`,
 *     which fires only on commit, not during drag -- the live
 *     numeric label updates on the `input` event but doesn't
 *     dispatch). Bubbles + composed so the composition root listens
 *     on the screen the same way it listens to `inline-edit-title` /
 *     `inline-edit-value`. `weight` is a finite number in
 *     `[MIN_WEIGHT, MAX_WEIGHT]` -- the popover's `<input>` already
 *     enforces the slider range, so the composition root can call
 *     `editNodeSvc.editFields(node, { kind, weight })` directly
 *     without re-validating; `Weight.of` throws on the seam if a
 *     stale browser somehow lets a slider value slip through.
 *
 * Why two events instead of one. The `weight-edit-open` path is
 * "screen-level concern" -- it tells the shell to render a popover.
 * The `inline-edit-weight` path is "service-level concern" -- it
 * tells the composition root to apply a domain change. Splitting the
 * two keeps the screen / shell pair pure (it manages popover
 * visibility and anchor; it doesn't talk to `EditNodeService`) and
 * mirrors the existing §17.28 pattern where `edit-node-open` (shell
 * concern: "open the modal") is distinct from `edit-node-confirm`
 * (composition-root concern: "apply the payload"). Same dispatcher
 * separation we use everywhere else.
 */

export const WEIGHT_EDIT_OPEN_EVENT = "weight-edit-open";
export const INLINE_EDIT_WEIGHT_EVENT = "inline-edit-weight";

/** Detail payload of {@link WEIGHT_EDIT_OPEN_EVENT}. */
export type WeightEditOpenDetail = {
  readonly nodeId: string;
  readonly weight: number;
  /**
   * Frozen viewport-coordinate rect of the tile the operator
   * activated. The popover positions itself relative to this rect
   * (auto-flipping when the rect is near a viewport edge); a
   * subsequent treemap reflow does not move the popover because
   * the rect is a snapshot, not a live reference.
   */
  readonly anchorRect: DOMRect;
  /**
   * SPEC §17.52-polish — frozen viewport-coordinate rect of the
   * weight-edit corner icon on the activated tile. Threaded
   * through so the popover can:
   *
   *   1. Sit immediately to the RIGHT of the icon (operator
   *      request: *"appear at the right of the weight icon (not
   *      overlapping it)"*) — `panel.left = iconRect.right + gap`.
   *   2. Constrain its own width so the panel never exceeds the
   *      tile's right edge (operator request: *"shouldn't exceed
   *      the tile width"*) — `panel.maxWidth = anchorRect.right
   *      − panel.left − inset`.
   *
   * `null` means the dispatcher couldn't locate the icon (a unit
   * fixture mounting `<weight-edit-button>` outside a tile, or a
   * long-press on a future tile-kind that doesn't render the icon).
   * The popover falls back to the §17.52-first-cut bottom-left
   * anchor without the to-the-right offset in that case.
   */
  readonly iconRect: DOMRect | null;
};

/** Detail payload of {@link INLINE_EDIT_WEIGHT_EVENT}. */
export type InlineEditWeightDetail = {
  readonly nodeId: string;
  /** Operator-chosen weight in [MIN_WEIGHT, MAX_WEIGHT]. */
  readonly weight: number;
};

declare global {
  interface HTMLElementEventMap {
    "weight-edit-open": CustomEvent<WeightEditOpenDetail>;
    "inline-edit-weight": CustomEvent<InlineEditWeightDetail>;
  }
}
