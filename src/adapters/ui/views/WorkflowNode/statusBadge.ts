/**
 * Shared status-badge CSS + render helper for the WorkflowNode views
 * (SPEC §17.117, §17.121e refresh).
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
 *   - Sized in `vh` units (1.15vh) to read at a similar visual
 *     weight as the corner timestamp.
 *   - **§17.121e — lives inside the shared `.subtitle` slot**
 *     (defined in `tileLayoutStyles`), a centered row directly
 *     under the title. Pre-§17.121e the badge was absolutely
 *     positioned at the tile's bottom-left corner (mirror of the
 *     bottom-right timestamp); operator feedback was that an
 *     "in-flow" property strip right under the title reads more
 *     naturally — the eye scans "title → property → value" top-
 *     to-bottom — and frees the bottom-left corner for future
 *     overlays. The §17.121e move drops `position: absolute` +
 *     the `bottom` / `left` offsets and lets the parent
 *     `.subtitle` row place the badge centered under the title.
 *     Visual parity across the AsParent / AsChild roles is now
 *     a consequence of both views opting into the same shared
 *     subtitle slot rather than a side-effect of the AsParent's
 *     `:host { position: static }` containing-block trick (that
 *     override stays in place for the timestamp's outer-corner
 *     escape, but the badge no longer depends on it).
 *   - `pointer-events: none` because the badge is a status indicator,
 *     not an interactive control; the surrounding tile's click /
 *     drill / inline-edit affordances stay reachable through it.
 */

import { css, html, type TemplateResult } from "lit";

export const statusBadgeStyles = css`
  .status-badge {
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
