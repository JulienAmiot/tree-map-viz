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
    /* When the close-X is rendered, reserve right gutter so a long focused
       title doesn't run into the button's hit zone. The button itself sits
       in the gutter via absolute positioning. */
    .strip.has-close {
      padding-right: clamp(3rem, 4vw, 3.75rem);
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
    .close-x {
      position: absolute;
      top: clamp(0.4rem, 1vw, 0.75rem);
      right: clamp(0.4rem, 1vw, 0.75rem);
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
    .close-x:hover {
      background: color-mix(in srgb, currentColor 12%, transparent);
    }
    .close-x:focus-visible {
      background: color-mix(in srgb, currentColor 12%, transparent);
      outline: 2px solid color-mix(in srgb, currentColor 35%, transparent);
      outline-offset: 1px;
    }
    .close-x:active {
      background: color-mix(in srgb, currentColor 22%, transparent);
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
  `;

  render() {
    const focusedId = this.vm?.id ?? "";
    const hasClose = this.parentId !== "";
    return html`<header
      class=${hasClose ? "strip has-close" : "strip"}
      data-testid="parent-strip"
      data-focused-id=${focusedId}
    >
      ${this.vm
        ? html`<node-view view-role="asParent" .vm=${this.vm}></node-view>`
        : nothing}
      ${hasClose
        ? html`<button
            class="close-x"
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
}

declare global {
  interface HTMLElementTagNameMap {
    "parent-identity-strip": ParentIdentityStrip;
  }
  interface HTMLElementEventMap {
    "focus-close-to-parent": CustomEvent<FocusCloseToParentDetail>;
  }
}
