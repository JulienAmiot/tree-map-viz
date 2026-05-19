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

/**
 * SPEC §17.121f — event name + payload shape for the focused-panel
 * WorkflowNode status picker. Mirrors the §17.104
 * `computation-kind-change` event the Computed* strategy picker
 * fires: a `change` on the inline `<select>` bubbles + composes
 * a `{ nodeId, newStatusId }` detail up to the composition root,
 * which routes it to `EditNodeService.editFields` with
 * `{ kind: "Workflow", statusId: newStatusId }`. The selected id is
 * forwarded verbatim — the service's `setStatusId` is the only
 * trim + non-empty guard, and the board's referential check is
 * intentionally lazy (an unknown id falls back to the muted-grey
 * orphan badge at next render rather than rejecting the swap).
 */
export const WORKFLOW_STATUS_CHANGE_EVENT = "workflow-status-change";
export type WorkflowStatusChangeDetail = {
  readonly nodeId: string;
  readonly newStatusId: string;
};

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
  /* SPEC §17.121f — interactive variant rendered on the AsParent
     workflow tile only. Visually mirrors the read-only .status-badge
     (transparent background, coloured border + text driven by
     --status-color, rounded pill, same vh-scaled font) so the
     operator's eye-path stays consistent across roles; the only
     deltas are (a) pointer-events: auto so the native <select>
     receives clicks, (b) cursor: pointer so the affordance reads
     as tappable, and (c) a slim chevron after the label provided
     by the UA's native select chrome (kept by NOT zeroing out
     -webkit-appearance / appearance — operator-feedback-light, no
     custom popup component to maintain). */
  .status-badge-picker {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    background: transparent;
    border: 1.5px solid var(--status-color, currentColor);
    color: var(--status-color, currentColor);
    border-radius: 0.4rem;
    font: inherit;
    font-size: 1.15vh;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    padding: 0.18em 0.55em;
    white-space: nowrap;
    user-select: none;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  /* Keep the dropdown rows readable (the system popup falls back to
     the page's default font-size / colour). The inline rule is
     scoped to the picker's <option>s so it does not leak into other
     selects in the shadow root. */
  .status-badge-picker option {
    color: initial;
    background: initial;
    font-size: 0.85rem;
    letter-spacing: normal;
  }
`;

type WorkflowStatusVM = { id: string; label: string; color: string };

/**
 * Render the read-only status pill or an empty fragment if the VM
 * has no status (defensive — the mapper always emits one today, but
 * unit fixtures may stub it out and the view should still render).
 *
 * The CSS custom property `--status-color` is set inline rather
 * than via a Lit `styleMap` because the value is a single string
 * already validated by the `WorkflowStatus.of` factory + baked into
 * the VM at map time — no run-time computation, no need for the
 * styleMap directive's overhead.
 */
export function renderStatusBadge(
  status: WorkflowStatusVM | undefined,
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

/**
 * SPEC §17.121f — render the inline-edit `<select>` variant used on
 * the focused-panel WorkflowNode tile. The native `<select>` is
 * styled (via `.status-badge-picker`) to read as the same coloured
 * pill the read-only badge renders; the active option text comes
 * from the resolved-status VM so the picker's visible label matches
 * the badge's pre-§17.121f rendering at idle.
 *
 * The fallback policy mirrors `renderStatusBadge`: an empty
 * `availableStatuses` list collapses the picker back to the
 * read-only badge so unit fixtures + board-less paths degrade
 * gracefully rather than blowing up with an empty dropdown.
 *
 * The dispatched event (`workflow-status-change`) bubbles + composes
 * so the composition root can register a single listener on the
 * top-level `<tree-map-screen>` element (mirror of the §17.110
 * `computation-kind-change` wiring).
 */
export function renderStatusBadgePicker(
  nodeId: string,
  currentStatus: WorkflowStatusVM | undefined,
  availableStatuses: readonly WorkflowStatusVM[] | undefined,
  onChange: (newStatusId: string) => void,
): TemplateResult {
  if (!currentStatus || currentStatus.label.length === 0) return html``;
  if (!availableStatuses || availableStatuses.length === 0) {
    return renderStatusBadge(currentStatus);
  }
  return html`<select
    class="status-badge-picker"
    data-testid="status-badge-picker"
    data-node-id=${nodeId}
    data-status-id=${currentStatus.id}
    style=${`--status-color: ${currentStatus.color}`}
    .value=${currentStatus.id}
    @change=${(e: Event) => {
      const target = e.target as HTMLSelectElement;
      onChange(target.value);
    }}
  >
    ${availableStatuses.map(
      (s) => html`<option value=${s.id} ?selected=${s.id === currentStatus.id}
        >${s.label}</option
      >`,
    )}
  </select>`;
}
