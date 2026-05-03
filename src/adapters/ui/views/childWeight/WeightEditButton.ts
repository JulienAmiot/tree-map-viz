/**
 * `<weight-edit-button>` -- the §17.52 corner-icon affordance for
 * inline weight editing on a child tile.
 *
 * The icon is an inline SVG drawn as a stylised cast-iron weight
 * silhouette: a trapezoidal body (slightly wider at the base, like
 * the foundry weights stamped "1 KG" / "2 KG" on a metal-shop scale)
 * topped by a U-shaped handle -- a literal answer to the operator's
 * follow-up *"the weight icon should look like a cast iron weight
 * with handle"*. The shape was iterated through three candidates --
 * a balance scale (rejected at the §17.52 design Q&A), a dumbbell
 * (the §17.52 first-cut glyph, retired here), and finally the
 * cast-iron weight that ships now. Drawn in SVG (not Unicode, not
 * CSS-only) because:
 *
 *   1. There is no Unicode code-point for a cast-iron weight (or a
 *      generic "weight") in the Basic Multilingual Plane. The
 *      closest candidates are the colour-emoji \u{1F3CB} (weight
 *      lifter) or \u2696 (scales) -- the first is colour-by-default
 *      and locks us out of `currentColor`, the second is the
 *      rejected "balance" the operator turned down.
 *   2. CSS-only (the §17.28 pencil approach: two pseudo-elements +
 *      a transform stack) is feasible but renders less crisply at
 *      small tile sizes than a vector primitive -- the cast-iron
 *      weight needs a curved handle stroke + a trapezoidal body
 *      path which doesn't fit comfortably in `::before` + `::after`.
 *   3. SVG with `fill="currentColor"` + a fixed `viewBox` lets the
 *      browser rasterise the glyph at any size with sub-pixel
 *      precision, and inherits the tile's text colour through the
 *      same `currentColor` mechanism the §17.18 timestamp uses for
 *      `--age-color` fallback.
 *
 * Position: bottom-LEFT corner of the tile (mirror of the §17.18
 * bottom-right timestamp). `position: absolute` against the host's
 * `position: relative` (already established by `tileLayoutStyles`
 * for the timestamp's containing block); the host's
 * `overflow: hidden` clips the corner if the icon ever grows past
 * the tile's inner padding.
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
      /* SPEC 17.52 -- corner anchor. Mirrors the 17.18 timestamp's
         bottom-right anchor on the LEFT side. The 0.2rem / 0.35rem
         offsets match the host padding shrunk in 17.46 so the icon
         sits flush with the tile's inner padding edge rather than
         floating in the padding gap. position: absolute on the
         host attaches to the per-view's position: relative in
         tileLayoutStyles. */
      position: absolute;
      bottom: 0.2rem;
      left: 0.35rem;
      /* The icon's hit target is the surrounding button; we let
         the inner button drive z-index / pointer-events instead
         of giving the host its own. */
      z-index: 2;
      line-height: 0;
      pointer-events: auto;
    }
    button {
      /* SPEC 17.52 -- size in cqmin so the icon scales with the
         tile (visible on 1/12 floor tiles, comfortable on giant
         single-child layouts). The clamp floor (0.85rem) keeps
         the touch target legible on small tiles; the ceiling
         (1.6rem) prevents typographic blow-out on giant layouts.
         The buttons in the parent strip (close-X / edit-pencil)
         live in vh; here the icon is per-tile so cqmin is the
         right axis (the §17.46 value's clamp uses 42cqmin for
         the same reason). */
      width: clamp(0.85rem, 5cqmin, 1.6rem);
      height: clamp(0.85rem, 5cqmin, 1.6rem);
      padding: 0;
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
    svg {
      width: 100%;
      height: 100%;
      display: block;
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
    >
      <svg
        viewBox="0 0 32 32"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <!-- Handle: U-shaped arch sitting on top of the body. The
             SPEC 17.52-polish ask was "cast iron weight WITH HANDLE":
             a hollow loop drawn as a stroked path keeps the metallic
             "cast bar bent into a U" silhouette. Stroke width 2.4 +
             round linecaps give the bend a visible thickness without
             collapsing into a thin line at small tile sizes. -->
        <path
          d="M 10 13 C 10 5.5 22 5.5 22 13"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- Body: trapezoidal weight, slightly wider at the base than
             at the shoulders (the classic "1 KG" foundry-weight
             silhouette) with rounded bottom corners so the shape
             reads as cast metal rather than a flat block. The shoulder
             y=12.6 sits just below the handle's stroked end so the
             handle visually tucks INTO the body without an awkward
             gap; the bottom y=28 is flush with the viewBox so the
             weight feels grounded. -->
        <path
          d="M 8 12.6 L 24 12.6 Q 25.4 12.6 25.6 14 L 27 26
             Q 27.2 28 25.2 28 L 6.8 28 Q 4.8 28 5 26 L 6.4 14
             Q 6.6 12.6 8 12.6 Z"
        />
      </svg>
    </button>`;
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
