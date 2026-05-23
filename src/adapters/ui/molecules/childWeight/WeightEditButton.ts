/**
 * `<weight-edit-button>` -- the §17.52 corner-icon affordance for
 * inline weight editing on a child tile.
 *
 * Iconography history (preserved as design rationale):
 *
 *   - §17.52 first cut: dumbbell, retired on operator follow-up.
 *   - §17.52 ship: cast-iron weight SVG with U-shaped handle, drawn
 *     because no Unicode codepoint reads as "cast iron weight" in
 *     plain text.
 *   - §17.129: SVG lifted into a reusable atom (`atoms/weightGlyph.ts`).
 *   - §17.130 (current ship): switched to `U+2696 SCALES` followed by
 *     `U+FE0E` (text-presentation variation selector). REVERSES the
 *     §17.52 design Q&A "balance scale rejected" decision on operator
 *     instruction. The trade-offs the §17.52 docblock listed against
 *     the scales remain factual ("balance" is a different metaphor
 *     than "weight"), but the simpler Unicode-only path (no SVG, no
 *     custom atom, single glyph the browser font system can render
 *     crisply at any size) won out. The cast-iron SVG atom is gone
 *     in the same strand; the scales glyph reads at the same
 *     `clamp(0.85rem, 5cqmin, 1.6rem)` tile-icon scale via a matching
 *     `font-size` on the inner `<button>`.
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

/**
 * SPEC §17.130 — child-weight icon is `U+2696 SCALES` followed by the
 * `U+FE0E` text-presentation variation selector. Reverses the §17.52
 * design Q&A "no balance scale" decision: the cast-iron-weight SVG
 * primitive (`atoms/weightGlyph.ts`) was visually accurate but did not
 * survive the operator's "use the scale Unicode glyph" follow-up.
 * VS15 forces the monochrome / text rendering on platforms that would
 * otherwise emoji-color the scales (older macOS Safari + some Linux
 * fonts). The `WeightEditPopover` is the affordance that actually
 * carries the slider; the icon's only job is to read as "this is the
 * weight knob" at small tile sizes.
 */
const SCALES_GLYPH = "\u2696\uFE0E";

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
         the same reason). SPEC 17.130 -- the glyph is now a
         Unicode character (U+2696 SCALES + VS15) so the
         font-size matches the button's own clamped box; the
         line-height: 1 stops the metric box from pushing the
         glyph below the visual centre. */
      width: clamp(0.85rem, 5cqmin, 1.6rem);
      height: clamp(0.85rem, 5cqmin, 1.6rem);
      font-size: clamp(0.85rem, 5cqmin, 1.6rem);
      line-height: 1;
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
  `;

  render() {
    return html`<button
      type="button"
      tabindex="-1"
      aria-label="Edit weight"
      title="Edit weight"
      data-testid="weight-edit-button"
      @click=${this.handleClick}
    >${SCALES_GLYPH}</button>`;
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
