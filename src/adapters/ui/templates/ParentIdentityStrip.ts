/**
 * `<parent-identity-strip>` — Lit element that renders the focused node in
 * the parent role at the top of the kiosk viewport (SPEC §4 / §12.1).
 *
 * Sizing (20–25 % of the viewport, always visible at the top in both
 * orientations per option c1) is owned by the shell's CSS grid; this
 * element just slots in. It is intentionally thin: a `data-testid` /
 * `data-focused-id` wrapper around `<node-view view-role="asParent">`.
 *
 * Importing `../molecules/registerNodeViews.js` is the side-effect import
 * that registers + freezes `nodeViewRegistry`; the strip never registers
 * entries itself.
 *
 * §17.23 — close-to-parent affordance:
 *   When the focus has a parent (`parentId` is set), the strip overlays a
 *   small circular "X" button at the top-right corner of its frame. Tapping
 *   it dispatches a bubbling + composed `focus-close-to-parent` CustomEvent
 *   `{ parentId }` that the composition root maps to the same
 *   `nav.focusByUuid + router.push + refresh` triple the breadcrumb uses
 *   (SPEC §9). At root focus (`parentId === ""`) the button is omitted
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

import "../molecules/registerNodeViews.js";
import type { NodeViewModel } from "../molecules/NodeViewModel.js";

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
    /* SPEC §17.36 — the parent strip is now a panel, not a divider.
       Pre-§17.36 the strip carried only a 1 px border-bottom to
       delineate it from the children grid below. Operator feedback
       was that the focused panel and the child tiles read as two
       different visual languages: rounded, bordered, tinted cards
       below; a flush band on top. The strip now mirrors the child
       tile's panel aesthetic — same border colour, same radius,
       same family of bg tint — so the focus surface and the
       children read as one consistent layout.
       The bg uses --panel-strip-bg (~12 %) where children use
       --panel-tile-bg (~7 %): same border, slightly stronger fill
       so the eye still reads the parent strip as the focused panel
       (it would otherwise blend with a single large child tile).
       The drill-into morph (drillTransitions.ts) transitions the
       tapped tile's bg from --panel-tile-bg to --panel-strip-bg
       as it flies up, making the parent-promotion read smoothly.

       SPEC §17.37 -- padding 0 (was clamp(0.5rem, 1.5vw, 1.25rem)
       pre-§17.37). Operator feedback after §17.36: the title on the
       focused panel sat noticeably lower-and-more-indented than the
       title on a child tile, and the drill-into FLIP morph made the
       discrepancy visible as a vertical+horizontal jump at the moment
       the tile re-rendered as the strip's per-view (the morphed tile
       had its title at the per-view's 0.4rem 0.6rem host-padding
       inset; the strip's content rendered the same per-view but
       offset by an extra clamp(0.5rem, 1.5vw, 1.25rem) on every
       side). Removing the outer padding aligns the title (and every
       inner element) at exactly the same 0.4rem top / 0.6rem
       left inset on both surfaces -- the morph now lands cleanly with
       no visible jump. The inner per-view's own :host { padding:
       0.4rem 0.6rem } (from tileLayoutStyles) is the only padding
       in play on either surface; the strip is now a pure visual
       frame. The right-side gutter for the close-X / pencil buttons
       moves to a class modifier below so the gutter does not pollute
       the symmetric padding-0 defaults. */
    .strip {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: 0;
      background: var(
        --panel-strip-bg,
        color-mix(in srgb, currentColor 12%, transparent)
      );
      border: 1px solid
        var(
          --panel-border-color,
          color-mix(in srgb, currentColor 28%, transparent)
        );
      border-radius: var(--panel-border-radius, 8px);
    }
    /* SPEC 17.47 -- the has-close / has-edit modifier classes used to
       reserve a clamp(3rem, ...) right-side gutter on .strip so the
       title (and the rest of the per-view's content) could not run
       under the absolute-positioned buttons. Pre-17.47 the per-view's
       content-area was therefore narrower than the strip's own width,
       and the BSC parent had to read a republished gutter custom
       property and apply a negative margin-right on the metric-pane
       to escape the reservation for the centered value (17.39).
       Post-17.47 the buttons shrink to match the title row's 3vh
       height (so they sit visually inside the title row instead of
       dangling below it into the body) and the gutter is dropped
       entirely -- the per-view's content fills the strip's full
       inner width, the centered value lands at the strip's full
       center without any escape gymnastics, and the buttons overlay
       only the right-end of the title row (the title's text-overflow:
       ellipsis from tileLayoutStyles cuts off any title that would
       otherwise extend behind them).

       SPEC 17.50 -- the modifier classes still carry no layout-
       affecting padding (the §17.47 retirement holds), but they now
       also publish a CSS custom property --strip-gutter-right that
       per-views consume for inline-edit inputs ONLY. Static read-only
       content (title text, value figure, description body) keeps
       text-overflow: ellipsis / overflow: hidden so a long title is
       clipped under the buttons and does not appear truncated by a
       reservation. Inline edit inputs are different: they are
       INTERACTIVE, so a long edit value MUST stay visible while the
       operator is typing -- letting the input run BEHIND the buttons
       hides the right end of what the operator is editing. The
       per-view picks up --strip-gutter-right via CSS custom
       property cascade (which crosses shadow DOM boundaries, same
       mechanism §17.32 uses for --drill-title-color) and subtracts
       it from the inline-edit input's max-width so the input stops
       short of the buttons. Static rendering is unaffected. */
    .strip {
      /* Default: no right-side gutter. Overridden by .has-close /
         .has-edit modifiers below. The clamp(...) literals match the
         button-positioning rules further down (.close-x.right,
         .edit-pencil.right, the 0.25rem inter-button gap) so the
         gutter width tracks the buttons' actual footprint at every
         clamp-resolved size. */
      --strip-gutter-right: 0px;
    }
    .strip.has-close:not(.has-edit),
    .strip.has-edit:not(.has-close) {
      /* One button visible (close-X xor edit-pencil): the gutter is
         the button's clamp width plus its right offset. */
      --strip-gutter-right: calc(
        1px + 0.35rem + clamp(1.5rem, 3vh, 2.25rem)
      );
    }
    .strip.has-close.has-edit {
      /* Both buttons visible: two button widths + the 0.25rem inter-
         button gap + the close-X's right offset. */
      --strip-gutter-right: calc(
        1px + 0.35rem + clamp(1.5rem, 3vh, 2.25rem) + 0.25rem +
          clamp(1.5rem, 3vh, 2.25rem)
      );
    }
    node-view {
      display: block;
      width: 100%;
      height: 100%;
    }
    /* SPEC 17.47 -- close-X + edit-pencil buttons overlay the right
       end of the title row. The two short lines that form each glyph
       are drawn via ::before / ::after pseudo-elements so they stay
       crisp at any size and inherit currentColor from the strip.
       Pre-17.47 the buttons were 2.25rem square (>= 36 px touch
       target on a 16-px root) but at that size they extended below
       the title row's 3vh height into the body area on every kiosk-
       class viewport (3vh ~= 21.6 px on a 720-px viewport, ~= 32.4
       px on 1080 px) and the strip had to reserve a clamp(3rem, ...)
       right-side gutter to keep the title clear of them.
       Post-17.47 the button is sized to the title row's height
       (3vh) with a 1.5rem floor (24 px -- still finger-tappable on
       the smallest kiosk viewports) and a 2.25rem ceiling (kept for
       very tall viewports so the touch target never grows
       unboundedly). Anchored at top: 1px (border) + 0.2rem (per-
       view's host padding-top, see tileLayoutStyles 17.46) so the
       button's top edge aligns with the title row's top edge -- on
       the typical 1080p kiosk where 3vh resolves to ~32.4 px the
       button height clamps to the same 32.4 px and the two surfaces
       sit on the exact same horizontal line. */
    .strip-action {
      position: absolute;
      top: calc(1px + 0.2rem);
      width: clamp(1.5rem, 3vh, 2.25rem);
      height: clamp(1.5rem, 3vh, 2.25rem);
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
    /* SPEC 17.47 -- close-X sits at the strip's far right, flush with
       the per-view's host padding-right (0.35rem) plus the strip's
       own 1 px border so the button's right edge aligns with the
       host's content-area right edge. The X cross-bars scale with
       the button's font-size proxy via percentage widths so they
       look proportional on every clamp-resolved size. */
    .close-x {
      right: calc(1px + 0.35rem);
    }
    .close-x::before,
    .close-x::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      width: 60%;
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
    /* SPEC 17.47 -- the pencil sits immediately to the left of the
       close-X. Both buttons are clamp(1.5rem, 3vh, 2.25rem) square
       so the offset uses the same clamp; a 0.25rem gap separates
       them visually. */
    .edit-pencil {
      right: calc(1px + 0.35rem + clamp(1.5rem, 3vh, 2.25rem) + 0.25rem);
    }
    /* When the close-X is hidden (root focus), the pencil takes the
       far-right slot. */
    .edit-pencil.is-trailing {
      right: calc(1px + 0.35rem);
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
       is at the top-left and the tip end is at the bottom-right.
       Width is a percentage of the button so it scales proportionally
       with the §17.47 clamp-resolved button size. */
    .edit-pencil::before {
      width: 60%;
      height: 2px;
      transform: translate(-50%, -50%) rotate(-45deg);
    }
    /* Tip -- a tiny perpendicular bar near the bottom-right end of the
       shaft, drawn slightly offset and rotated 90deg from the shaft
       so it reads as the writing point. */
    .edit-pencil::after {
      width: 0.3rem;
      height: 2px;
      transform: translate(0.15rem, 0.28rem) rotate(45deg);
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
