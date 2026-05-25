/**
 * `<weight-edit-button>` -- the §17.52 corner-icon affordance for
 * inline weight editing on a child tile.
 *
 * Iconography history (preserved as design rationale):
 *
 *   - §17.52 first cut: dumbbell, retired on operator follow-up.
 *   - §17.52 ship: cast-iron weight SVG with U-shaped handle.
 *   - §17.129: SVG briefly lifted into an atom, then retired.
 *   - §17.130: switched to `U+2696 SCALES` + `U+FE0E` (text-
 *     presentation variation selector).
 *   - §17.132: Unicode glyph replaced by `<ds-icon name="scale">`
 *     (Lucide balance-scale SVG, monochrome `currentColor`).
 *   - §17.136 S0a: switched to `<ds-icon name="dumbbell">` on
 *     operator instruction ("Replace the scale by a weight icon
 *     from lucide.") -- the §17.132 `scale` balance picture
 *     overlapped visually with the §17.52a balance-vs-weight
 *     design Q&A.
 *   - §17.136 S0a-followup (current ship): switched again on
 *     operator follow-up ("Replace the dumbell icone by the
 *     'weight' icon") to `<ds-icon name="weight">` -- the Lucide
 *     `weight` slug is a cast-iron foundry-weight silhouette (a
 *     trapezoidal body with a U-shaped handle on top), which
 *     mirrors the §17.52-polish cast-iron SVG the kiosk shipped
 *     before the §17.132 / S0a Lucide swaps. Closes the
 *     iconography loop on the same shape the operator picked four
 *     years ago, now sourced from the shared library.
 *
 * Position (post-§17.136 S13b): inside each AsChild's
 * `<card-frame slot="footer-left">` cell. The pre-strand
 * `position: absolute; bottom: 0.2rem; left: 0.35rem` corner anchor
 * + `z-index: 2` retire -- the card-frame's three-row grid puts
 * the footer-left slot exactly where the corner overlay used to
 * sit (bottom row, left column of the AsChild's host box). The
 * host now sits inline as flex content; the inner button keeps
 * its `clamp(0.85rem, 5cqmin, 1.6rem)` sizing so the icon still
 * scales with the tile.
 *
 * Tap behaviour: dispatches `weight-edit-open` (bubbling + composed
 * so it crosses the children-grid shadow boundary) with the host
 * tile's current `nodeId`, current `weight`, and a snapshot of the
 * tile's `getBoundingClientRect()` so the popover can anchor in
 * viewport coordinates without holding a live element reference.
 * `event.stopPropagation()` is called BEFORE the dispatch so the
 * tap does NOT bubble to `<children-grid>`'s `@click` drill handler
 * -- the operator gets the popover, not a navigation jump.
 *
 * The button is intentionally NOT focusable via Tab (no `tabindex`
 * attribute on the host; the inner `<button>` carries `tabindex="-1"`
 * via Lit) because the kiosk runtime is touch-first and screen
 * readers reach the long-press path via the tile's title -- adding
 * a third focusable surface per tile would clutter the tab order
 * (every tile already has its own click target through the wrapper
 * `<div class="tile">`).
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../../atoms/icon/Icon.js";
import {
  WEIGHT_EDIT_OPEN_EVENT,
  type WeightEditOpenDetail,
} from "./weightEditEvents.js";

@customElement("weight-edit-button")
export class WeightEditButton extends LitElement {
  /** Uuid of the node this button represents. */
  @property({ type: String, attribute: "node-id" })
  nodeId = "";

  /** Current weight (mirrors the domain `Weight.value`); used to
   * pre-fill the slider in the popover. */
  @property({ type: Number })
  weight = 1;

  static styles = css`
    :host {
      /* SPEC §17.136 S13b -- the pre-strand absolute corner
         anchor on the host retires (see file-level docstring
         for the literal values that left). The button now lives
         in each AsChild's card-frame footer-left cell, which is
         already a positioned cell in the molecule's three-row
         grid; the host sits inline as flex content; the inner
         button drives the visible size + hit target. line-height
         + pointer-events stay so the inner button hugs the host
         box and clicks register. */
      line-height: 0;
      pointer-events: auto;
    }
    button {
      /* SPEC 17.52 / 17.140 -- size in cqmin so the icon scales
         with the tile (visible on 1/12 floor tiles, comfortable
         on giant single-child layouts). The font-size clamp drives
         the icon's visual size; the width / height add lateral
         padding around the icon so the clickable surface is bigger
         than the glyph itself (operator feedback: the reactive
         area of the weight icon should be larger). The button is
         now ~2.4em wide x 1.8em tall in cqmin space -- about
         double the pre-17.140 hit target -- while the icon stays
         at the same 1em size it had before. */
      width: clamp(2rem, 12cqmin, 3.4rem);
      height: clamp(1.4rem, 8cqmin, 2.4rem);
      font-size: clamp(0.85rem, 5cqmin, 1.6rem);
      line-height: 1;
      padding: 0 0.25em;
      margin: 0;
      background: transparent;
      color: color-mix(in srgb, currentColor 60%, transparent);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      -webkit-tap-highlight-color: transparent;
      transition: color 160ms ease, background 160ms ease;
    }
    button:hover,
    button:focus-visible {
      outline: none;
      color: color-mix(in srgb, currentColor 95%, transparent);
      background: color-mix(in srgb, currentColor 14%, transparent);
    }
    button:active {
      background: color-mix(in srgb, currentColor 22%, transparent);
    }
  `;

  render() {
    return html`<button
      type="button"
      tabindex="-1"
      aria-label="Edit weight"
      title="Edit weight"
      data-testid="weight-edit-button"
      @click=${this.handleClick}
    ><ds-icon name="weight"></ds-icon></button>`;
  }

  private handleClick = (e: MouseEvent): void => {
    // SPEC §17.52 -- swallow the click so it does NOT bubble up to
    // the `<children-grid>` tile wrapper's `@click=` drill handler
    // (the wrapper is one shadow boundary above the host). The
    // operator wants the popover, not a navigation jump. Without
    // this swallow the drill would fire on every weight-edit tap
    // and the popover would never open (the focus would have moved
    // to the tapped tile's children before the popover even
    // mounted).
    e.stopPropagation();
    e.preventDefault();
    const host = this as HTMLElement;
    // SPEC §17.52 -- snapshot the tile's rect, NOT the button's
    // own rect. The popover anchors to the tile (so a bottom-LEFT
    // icon can position the popover above-OR-below-OR-beside the
    // tile rather than the icon, which is too small to reason
    // against). Walks up the assigned slot / parent chain to find
    // the wrapper element with `data-testid="child"`; falls back
    // to the host's own rect if the chain doesn't surface a tile
    // wrapper (unit-fixture mounts where the button sits outside
    // the children-grid).
    const tile = WeightEditButton.findTileAncestor(host) ?? host;
    // SPEC §17.52-polish -- capture the host's own rect alongside
    // the tile rect. The popover uses the icon rect to start the
    // panel to the RIGHT of the icon (operator request: *"appear
    // at the right of the weight icon (not overlapping it)"*) and
    // the tile rect to constrain the panel's max-width to the
    // tile's right edge (*"shouldn't exceed the tile width"*).
    const iconRect = host.getBoundingClientRect();
    const detail: WeightEditOpenDetail = {
      nodeId: this.nodeId,
      weight: this.weight,
      anchorRect: tile.getBoundingClientRect(),
      iconRect,
    };
    this.dispatchEvent(
      new CustomEvent<WeightEditOpenDetail>(WEIGHT_EDIT_OPEN_EVENT, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

  /**
   * Walks up the DOM (crossing shadow-root boundaries via
   * `getRootNode().host` when needed) until it finds an ancestor
   * carrying `data-testid="child"` (the children-grid tile wrapper).
   * Returns `null` when the chain ends without one -- the only
   * realistic case is a unit fixture that mounts `<weight-edit-
   * button>` outside the grid for isolated testing.
   */
  private static findTileAncestor(start: HTMLElement): HTMLElement | null {
    let current: Node | null = start;
    while (current) {
      if (
        current instanceof HTMLElement &&
        current.dataset["testid"] === "child"
      ) {
        return current;
      }
      const parent: Node | null = (current as Node).parentNode;
      if (parent) {
        current = parent;
        continue;
      }
      const root = (current as Node).getRootNode();
      if (root instanceof ShadowRoot) {
        current = root.host;
        continue;
      }
      current = null;
    }
    return null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "weight-edit-button": WeightEditButton;
  }
}
