/**
 * `<parent-identity-strip>` — Lit element that renders the focused node in
 * the parent role at the top of the kiosk viewport (SPEC §4 / §12.1).
 *
 * Sizing (20–25 % of the viewport, always visible at the top in both
 * orientations per option c1) is owned by the shell's CSS grid; this
 * element just slots in. It is intentionally thin: a `data-testid` /
 * `data-focused-id` wrapper around `<node-view view-role="asParent">`.
 *
 * Importing `../views/index.js` is the side-effect import that registers
 * + freezes `nodeViewRegistry`; the strip never registers entries itself.
 *
 * §17.23 — close-to-parent affordance:
 *   When the focus has a parent (`parentId` is set), the strip overlays a
 *   small circular "X" button at the top-right corner of its frame. Tapping
 *   it dispatches a bubbling + composed `focus-close-to-parent` CustomEvent
 *   `{ parentId }` that the composition root maps to the same
 *   `nav.focusByUuid + router.push + refresh` triple the breadcrumb uses
 *   (SPEC §11.3). At root focus (`parentId === ""`) the button is omitted
 *   — there's no parent to close back to. The button does NOT replay the
 *   `encap--drill` animation: that's a drill-*in* cue; an `encap--leave`
 *   inverse is deferred per §17.20, so today the navigation commits
 *   synchronously like a breadcrumb tap.
 *
 *   Why on the strip and not on the per-kind asParent template:
 *     - The X is a **shell-level** affordance, not a per-kind concern; the
 *       per-kind templates would each duplicate the same JSX + dispatch.
 *     - The strip is the natural visual frame of the focused panel — its
 *       border-bottom delineates the panel from the children grid, so the
 *       "close this panel" affordance lives on that frame, not inside the
 *       value area.
 *     - The strip already knows whether the focus is at root (the shell
 *       derives `parentId` from `breadcrumbPath` and passes it down), so
 *       no extra plumbing is needed in the per-kind VMs.
 *
 * §17.28 — edit-node affordance:
 *   A small circular **pencil** button sits to the **left of the close-X**
 *   in the same top-right gutter. Tapping it dispatches a bubbling +
 *   composed `edit-node-open` CustomEvent `{ nodeId }` that the
 *   composition root maps to opening `<edit-node-modal>` populated with
 *   the focused node's full pre-edit snapshot. The pencil glyph is drawn
 *   with two CSS bars (the "shaft" + a 45° "tip") sized in `cqmin` so it
 *   stays crisp at any size and inherits `currentColor`, matching the X
 *   styling idiom (no SVG / icon font).
 *
 *   The pencil is always rendered when a focused vm is present: editing
 *   is a node-level operation that's meaningful at root focus too (the
 *   board's root is editable just like any other node). When `vm` is
 *   `null` the strip renders neither button.
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../views/index.js";
import type { NodeViewModel } from "../views/NodeViewModel.js";

/** Event name used by the close-X button. */
export const FOCUS_CLOSE_TO_PARENT_EVENT = "focus-close-to-parent";

/** Detail payload of {@link FOCUS_CLOSE_TO_PARENT_EVENT}. */
export type FocusCloseToParentDetail = {
  readonly parentId: string;
};

/** Event name used by the edit-node pencil button (SPEC §17.28). */
export const EDIT_NODE_OPEN_EVENT = "edit-node-open";

/** Detail payload of {@link EDIT_NODE_OPEN_EVENT}. */
export type EditNodeOpenDetail = {
  readonly nodeId: string;
};

@customElement("parent-identity-strip")
export class ParentIdentityStrip extends LitElement {
  @property({ attribute: false })
  vm: NodeViewModel | null = null;

  /**
   * The id of the focused node's parent, or `""` when the focus is at the
   * root (no parent → no close-X). Set by the shell from
   * `breadcrumbPath[breadcrumbPath.length - 2]?.id` on every refresh.
   */
  @property({ type: String, attribute: "parent-id" })
  parentId = "";

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
    }
    .strip {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: clamp(0.5rem, 1.5vw, 1.25rem);
      border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    }
    /* When the top-right buttons are rendered, reserve right gutter so
       a long focused title does not run into the buttons hit zones.
       The buttons themselves sit in the gutter via absolute positioning.
       Modifiers (additive, set independently by render()):
         - has-close (SPEC 17.23) -- the close-X button is rendered.
         - has-edit  (SPEC 17.28) -- the edit-pencil button is rendered.
       When both are set the gutter widens to accommodate both buttons;
       when only one is set the narrower gutter is enough. */
    .strip.has-close,
    .strip.has-edit {
      padding-right: clamp(3rem, 4vw, 3.75rem);
    }
    .strip.has-close.has-edit {
      padding-right: clamp(5.5rem, 8vw, 7.5rem);
    }
    node-view {
      display: block;
      width: 100%;
      height: 100%;
    }
    /* Close-X button — overlays the top-right of the strip. The two short
       lines that form the X are drawn via ::before / ::after pseudo-elements
       so the glyph stays crisp at any size and inherits currentColor from
       the strip. The 2.25rem touch target fits the SPEC §1 "no-keyboard,
       finger-friendly" assumption (>= 36 px on a 16 px root). */
    .strip-action {
      position: absolute;
      top: clamp(0.4rem, 1vw, 0.75rem);
      width: 2.25rem;
      height: 2.25rem;
      padding: 0;
      margin: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      z-index: 1;
    }
    .strip-action:hover {
      background: color-mix(in srgb, currentColor 12%, transparent);
    }
    .strip-action:focus-visible {
      background: color-mix(in srgb, currentColor 12%, transparent);
      outline: 2px solid color-mix(in srgb, currentColor 35%, transparent);
      outline-offset: 1px;
    }
    .strip-action:active {
      background: color-mix(in srgb, currentColor 22%, transparent);
    }
    .close-x {
      right: clamp(0.4rem, 1vw, 0.75rem);
    }
    .close-x::before,
    .close-x::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: 1.1rem;
      height: 2px;
      background: currentColor;
      border-radius: 1px;
      transform-origin: center;
    }
    .close-x::before {
      transform: translate(-50%, -50%) rotate(45deg);
    }
    .close-x::after {
      transform: translate(-50%, -50%) rotate(-45deg);
    }
    /* SPEC 17.28 -- pencil button. Same touch-target footprint as the
       close-X sitting in a second slot to its left. The glyph is drawn
       with two CSS bars: a long shaft tilted 45deg and a tiny tip near
       one end so the silhouette reads as a stylised pencil rather than
       a plus. Sized in rem (not cqmin) so it stays consistent with the
       X across viewport sizes -- the strip itself does not establish a
       containment context. */
    .edit-pencil {
      /* Sit immediately to the left of the close-X. The close-x button
         is 2.25rem wide; we leave a small gap for visual separation. */
      right: calc(clamp(0.4rem, 1vw, 0.75rem) + 2.25rem + 0.35rem);
    }
    /* When the close-X is hidden (root focus), the pencil takes the
       far-right slot so the gutter does not read as "missing button".
       Aligned via a modifier set on the button by render(). */
    .edit-pencil.is-trailing {
      right: clamp(0.4rem, 1vw, 0.75rem);
    }
    .edit-pencil::before,
    .edit-pencil::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      background: currentColor;
      border-radius: 1px;
      transform-origin: center;
    }
    /* Shaft -- the long body of the pencil, tilted 45deg so the cap end
       is at the top-left and the tip end is at the bottom-right. */
    .edit-pencil::before {
      width: 1.1rem;
      height: 2px;
      transform: translate(-50%, -50%) rotate(-45deg);
    }
    /* Tip -- a tiny perpendicular bar near the bottom-right end of the
       shaft, drawn slightly offset and rotated 90deg from the shaft so
       it reads as the writing point. */
    .edit-pencil::after {
      width: 0.35rem;
      height: 2px;
      transform: translate(0.18rem, 0.32rem) rotate(45deg);
    }
  `;

  render() {
    const focusedId = this.vm?.id ?? "";
    const hasClose = this.parentId !== "";
    const hasEdit = this.vm !== null;
    // §17.28 — `has-close` and `has-edit` are additive modifiers on the
    // strip wrapper so each button can independently flag the right
    // gutter padding it needs. When both are set the CSS widens the
    // gutter to fit both 2.25 rem buttons + the inter-button gap.
    const classes = ["strip"];
    if (hasClose) classes.push("has-close");
    if (hasEdit) classes.push("has-edit");
    const stripClass = classes.join(" ");
    return html`<header
      class=${stripClass}
      data-testid="parent-strip"
      data-focused-id=${focusedId}
    >
      ${this.vm
        ? html`<node-view view-role="asParent" .vm=${this.vm}></node-view>`
        : nothing}
      ${hasEdit
        ? html`<button
            class=${hasClose ? "strip-action edit-pencil" : "strip-action edit-pencil is-trailing"}
            type="button"
            data-testid="edit-node"
            data-node-id=${focusedId}
            aria-label="Edit this node"
            title="Edit this node"
            @click=${this.handleEditClick}
          ></button>`
        : nothing}
      ${hasClose
        ? html`<button
            class="strip-action close-x"
            type="button"
            data-testid="close-to-parent"
            data-parent-id=${this.parentId}
            aria-label="Close — navigate to parent"
            title="Close — navigate to parent"
            @click=${this.handleCloseClick}
          ></button>`
        : nothing}
    </header>`;
  }

  private handleCloseClick = (): void => {
    if (this.parentId === "") {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<FocusCloseToParentDetail>(FOCUS_CLOSE_TO_PARENT_EVENT, {
        bubbles: true,
        composed: true,
        detail: { parentId: this.parentId },
      }),
    );
  };

  /**
   * §17.28 — emit `edit-node-open` so the composition root can resolve
   * the focused node from its id and populate `<edit-node-modal>` with
   * the full pre-edit snapshot. The strip itself does not have access
   * to the domain node (it consumes a VM), so it can't build the
   * snapshot here — the composition root is the only layer that knows
   * how to map TreeNode → EditNodeTarget.
   */
  private handleEditClick = (): void => {
    if (!this.vm) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<EditNodeOpenDetail>(EDIT_NODE_OPEN_EVENT, {
        bubbles: true,
        composed: true,
        detail: { nodeId: this.vm.id },
      }),
    );
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "parent-identity-strip": ParentIdentityStrip;
  }
  interface HTMLElementEventMap {
    "focus-close-to-parent": CustomEvent<FocusCloseToParentDetail>;
    "edit-node-open": CustomEvent<EditNodeOpenDetail>;
  }
}
