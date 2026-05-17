/**
 * Shared status-badge CSS + render helper for the WorkflowNode views
 * (SPEC §17.117).
 *
 * Both `<workflow-node-as-parent>` and `<workflow-node-as-child>`
 * render a single small pill carrying the board-resolved status
 * label. The visual contract is:
 *
 *   - Transparent background (so the tile's own background still
 *     shows through — operator requirement: "only the text and
 *     border are colored").
 *   - 1.5 px coloured border + matching text colour, both driven by
 *     the per-element CSS custom property `--status-color`
 *     (baked into the inline `style` attribute by the view layer
 *     from `vm.status.color`).
 *   - Rounded rectangle (border-radius 0.4 rem) → reads as a
 *     "label button" without behaving as a button (no click target,
 *     no pointer-events). Editing the status happens through the
 *     Edit-node modal; the badge itself is presentational only.
 *   - Sized in `vh` units to match the bottom-right timestamp's
 *     visual weight (the two corner glyphs read as a paired set).
 *   - Positioned absolutely at the tile's bottom-left — the mirror
 *     of the timestamp's bottom-right — so the value-area in the
 *     middle of the tile is not crowded by either corner. The
 *     0.2 rem / 0.35 rem offsets match the host padding in
 *     `tileLayoutStyles` (§17.46) so the badge hugs the inner padded
 *     edge rather than floating in the padding gap.
 *   - `pointer-events: none` because the badge is a status indicator,
 *     not an interactive control; the surrounding tile's click /
 *     drill / inline-edit affordances stay reachable through it.
 *
 * For the AsParent role the `:host { position: static }` override in
 * `WorkflowNodeAsParent` cascades the badge's containing-block
 * resolution out to the `<parent-identity-strip>` (same mechanism the
 * §17.30 timestamp uses) so the parent-strip badge sits at the
 * focused panel's outer bottom-left corner with the same offsets a
 * child tile uses — visual parity across roles.
 */

import { css, html, type TemplateResult } from "lit";

export const statusBadgeStyles = css`
  .status-badge {
    position: absolute;
    bottom: 0.2rem;
    left: 0.35rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    /* §17.117 — transparent background; the colour goes on the
       border + text via --status-color. */
    background: transparent;
    border: 1.5px solid var(--status-color, currentColor);
    color: var(--status-color, currentColor);
    border-radius: 0.4rem;
    /* Visual weight matches the bottom-right timestamp (§17.46:
       1.15vh) so the two corner glyphs read as a balanced pair. */
    font-size: 1.15vh;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    padding: 0.18em 0.55em;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    font-variant-numeric: tabular-nums;
  }
`;

/**
 * Render the status pill or an empty fragment if the VM has no
 * status (defensive — the mapper always emits one today, but unit
 * fixtures may stub it out and the view should still render).
 *
 * The CSS custom property `--status-color` is set inline rather
 * than via a Lit `styleMap` because the value is a single string
 * already validated by the `WorkflowStatus.of` factory + baked into
 * the VM at map time — no run-time computation, no need for the
 * styleMap directive's overhead.
 */
export function renderStatusBadge(
  status: { id: string; label: string; color: string } | undefined,
): TemplateResult {
  if (!status || status.label.length === 0) return html``;
  return html`<span
    class="status-badge"
    data-testid="status-badge"
    data-status-id=${status.id}
    style=${`--status-color: ${status.color}`}
    >${status.label}</span
  >`;
}
