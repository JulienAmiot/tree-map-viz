/**
 * `<children-grid>` — Lit element that lays out the focused node's children
 * as a squarified treemap (SPEC §4 / §12.1).
 *
 * Inputs:
 *  - `slots: readonly ChildSlotViewModel[]` — node slots + an optional
 *    trailing `+` slot (the view-model mapper appends it iff capacity allows,
 *    per §4 + `shouldRenderPlusTile`).
 *
 *    NOTE: the property is called `slots`, not `children`, because Lit
 *    properties live on the element instance and `children` would shadow the
 *    native `Element.children: HTMLCollection` getter — that breaks the
 *    structural assignability of `ChildrenGrid` to `Element` (e.g. when
 *    passing the host to a `ResizeObserver` test double whose `target` is
 *    typed `Element`).
 *
 * Layout pipeline:
 *  - A `TreemapController` owns a `ResizeObserver` over the host element
 *    and re-runs `layoutSquarified` whenever the host's content rect changes.
 *  - On every render, `willUpdate` calls `controller.layout(weights, opts)`
 *    with the current slot weights.
 *  - `render` reads `controller.rects[i]` and absolutely positions the i-th
 *    tile with `left/top/width/height` inline styles.
 *
 * Children/plus dispatch:
 *  - `slot === "node"` → `<node-view view-role="asChild" .vm=${slot.vm}>`,
 *    wrapped in a tile with `data-id`, `data-view-kind`, `data-slot="node"`.
 *  - `slot === "plus"` → `<plus-tile parent-id=${slot.parentId}>`, wrapped
 *    in a tile with `data-parent-id`, `data-slot="plus"`.
 *
 * The `<plus-tile>` listener (the modal in DT-7) lives on the shell, not
 * on the grid — `plus-tile-activate` bubbles + composed crosses both shadow
 * boundaries.
 *
 * Importing `../views/index.js` registers + freezes `nodeViewRegistry`. The
 * grid does not register entries itself.
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { TreemapController } from "../controllers/TreemapController.js";
import "../molecules/childWeight/WeightEditButton.js";
import {
  WEIGHT_EDIT_OPEN_EVENT,
  type WeightEditOpenDetail,
} from "../molecules/childWeight/weightEditEvents.js";
import "../views/index.js";
import type { ChildSlotViewModel } from "../molecules/NodeViewModel.js";

const TILE_PADDING_PX = 4;

/** Bubbling+composed event fired when a node tile is activated (SPEC §4 — drill). */
export const TILE_DRILL_EVENT = "tile-drill";

export type TileDrillDetail = {
  /** Uuid of the node the user wants to drill into. */
  readonly nodeId: string;
};

/**
 * SPEC §17.52 -- long-press threshold for the child-tile weight edit
 * gesture. 500 ms is the standard mobile / kiosk press-and-hold
 * convention (< 400 ms accidentally triggers on a slow-tap-to-drill;
 * > 700 ms feels sluggish). Exposed as a constant so unit tests can
 * read it without re-deriving the literal.
 */
export const WEIGHT_LONG_PRESS_MS = 500;

/**
 * SPEC §17.52 -- pointer-movement tolerance during the long-press
 * window. If the operator's finger drifts more than this many
 * device pixels from the initial pointer-down position before the
 * long-press timer fires, we treat it as a scroll / drift gesture
 * (cancel the timer; let the eventual click drill normally). Tuned
 * from the Material guideline (8 px) doubled for kiosk-class
 * surfaces where finger jitter is higher.
 */
export const WEIGHT_LONG_PRESS_MOVE_TOLERANCE_PX = 16;

@customElement("children-grid")
export class ChildrenGrid extends LitElement {
  @property({ attribute: false })
  slots: readonly ChildSlotViewModel[] = [];

  treemap = new TreemapController(this);

  /**
   * SPEC §17.52 -- per-tile long-press lifecycle state. Keyed by
   * the pointerId so a multi-touch operator (very rare on the
   * kiosk, but the W3C contract says we need to handle it) gets
   * one independent timer per finger. The value carries everything
   * the cancel path needs to clean up + everything the fire path
   * needs to dispatch the open event without re-walking the DOM.
   */
  private longPressTimers = new Map<
    number,
    {
      readonly tile: HTMLElement;
      readonly nodeId: string;
      readonly weight: number;
      readonly startX: number;
      readonly startY: number;
      readonly timer: number;
      fired: boolean;
    }
  >();

  static styles = css`
    :host {
      position: relative;
      display: block;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .tile {
      position: absolute;
      box-sizing: border-box;
      /* SPEC §17.52 -- animate the squarify-driven left/top/width/
         height when the operator commits a weight change (the only
         realistic source of post-mount tile movement). The transition
         is CSS-only (no JS animation orchestration); it kicks in
         whenever the inline style writes a new rect, which Lit only
         does when the underlying weights change (or the host is
         resized; the resize-driven re-layout also benefits from a
         smoother transition than the pre-§17.52 hard cut). The
         320 ms duration matches DRILL_SETTLE_MS in
         drillTransitions.ts so the operator's mental model of "the
         layout is settling" reads consistently across drill, weight
         edit, and resize. The drill morph itself uses transforms
         (not L/T/W/H) so it does NOT race this transition.
         (Backticks omitted in this CSS comment per §17.14.) */
      transition: top 320ms ease, left 320ms ease, width 320ms ease,
        height 320ms ease;
    }
    /* SPEC §17.52 -- tighten the pre-existing .tile > * (which
       forced every direct child to fill the tile) to specifically
       <node-view> only. The §17.52 weight-edit button sits as a
       sibling of <node-view> inside the tile wrapper and must NOT
       inherit width: 100% / height: 100% (it is an absolutely-
       positioned corner glyph with cqmin-clamped intrinsic size).
       Plus tile is a different selector below so it picks up the
       100 / 100 fill rule without ambiguity. */
    .tile > node-view {
      display: block;
      width: 100%;
      height: 100%;
    }
    .tile > plus-tile {
      display: block;
      width: 100%;
      height: 100%;
    }
    /* SPEC §17.17 — node tiles are visually distinguishable from each
       other via a subtle background tint + a 1 px border + an 8 px
       border-radius. The border ensures the tile boundary is visible
       even when the value text is empty (e.g. a fresh TextNode whose
       history hasn't been seeded yet). The currentColor-derived mix
       adapts to dark/light themes without a media query, and the
       contrast ratio of the border is tuned to clear WCAG 1.4.11
       (Non-text contrast 3:1 against the page background) on the
       dark kiosk theme. The plus tile is intentionally NOT styled
       here — its inner button already carries a 2 px dashed border
       in plus-tile.ts, and stacking another solid border on top of
       that would muddle the affordance.

       SPEC §17.36 — the bg / border / radius read from the screen-
       level panel custom properties so the parent-identity-strip
       and every child tile share the same source of truth (and so
       the drill-into morph can transition smoothly between the
       two). The color-mix fallbacks are kept for standalone unit
       tests (a grid mounted outside <tree-map-screen> won't
       inherit the vars). */
    .tile[data-slot="node"] {
      background: var(
        --panel-tile-bg,
        color-mix(in srgb, currentColor 7%, transparent)
      );
      border: 1px solid
        var(
          --panel-border-color,
          color-mix(in srgb, currentColor 28%, transparent)
        );
      border-radius: var(--panel-border-radius, 8px);
      overflow: hidden;
      /* §17.20 — node tiles are navigation targets (tap → drill).
         The cursor hint is the only on-grid affordance for that;
         the actual drill animation lives on the shell's layout
         wrapper (encap--drill in TreeMapScreen). */
      cursor: pointer;
    }
  `;

  protected override willUpdate(): void {
    const weights = this.slots.map((s) => s.weight);
    this.treemap.layout(weights, { padding: TILE_PADDING_PX });
  }

  render() {
    if (this.slots.length === 0) return html``;
    const rects = this.treemap.rects;
    if (rects.length === 0) return html``;

    return html`${this.slots.map((slot, i) => {
      const r = rects[i];
      if (!r) return html``;
      const style = `left: ${r.x}px; top: ${r.y}px; width: ${r.w}px; height: ${r.h}px;`;

      if (slot.slot === "plus") {
        // Plus wrapper deliberately has no `data-testid` — the `<plus-tile>`
        // inner button carries `data-testid="plus-tile"` already, and e2e
        // tests count node tiles via `data-testid="child"` (which excludes
        // the `+` affordance per §12.3 / `views/plus_tile.feature`).
        return html`<div
          class="tile"
          data-slot="plus"
          data-parent-id=${slot.parentId}
          style=${style}
        >
          <plus-tile parent-id=${slot.parentId} .parentId=${slot.parentId}></plus-tile>
        </div>`;
      }

      const nodeId = slot.vm.id;
      const weight = slot.weight;
      return html`<div
        class="tile"
        data-testid="child"
        data-slot="node"
        data-id=${nodeId}
        data-view-kind=${slot.vm.kind}
        data-weight=${String(weight)}
        style=${style}
        @click=${(e: MouseEvent): void => this.handleTileClick(e, nodeId)}
        @pointerdown=${(e: PointerEvent): void =>
          this.handleTilePointerDown(e, nodeId, weight)}
        @pointermove=${this.handleTilePointerMove}
        @pointerup=${this.handleTilePointerUp}
        @pointercancel=${this.handleTilePointerUp}
        @pointerleave=${this.handleTilePointerUp}
      >
        <node-view view-role="asChild" .vm=${slot.vm}></node-view>
        <weight-edit-button
          node-id=${nodeId}
          .weight=${weight}
        ></weight-edit-button>
      </div>`;
    })}`;
  }

  /**
   * SPEC §4 / §17.52 -- click on a tile body normally drills into the
   * node. The §17.52 long-press path arms a `firedLongPress` flag on
   * the same tile element when the long-press timer commits; the
   * subsequent click that fires when the operator releases must be
   * suppressed (otherwise releasing a long-press would simultaneously
   * open the weight popover AND drill into the tile, leaving the
   * popover orphaned over a different focused node). The flag is
   * cleared on the next pointerdown so a follow-up tap-to-drill
   * works normally.
   */
  private handleTileClick(e: MouseEvent, nodeId: string): void {
    const tile = e.currentTarget as HTMLElement;
    if (tile.dataset["firedLongPress"] === "true") {
      delete tile.dataset["firedLongPress"];
      e.stopPropagation();
      return;
    }
    this.dispatchTileDrill(nodeId);
  }

  /**
   * SPEC §17.52 -- start the long-press timer. Stored per-pointerId
   * so a multi-touch operator gets one timer per finger; nearly
   * always single-touch on the kiosk but the W3C pointer-events
   * contract requires the keying. Captures the pointer's start
   * coords so `pointermove` can cancel the gesture if the operator
   * drifts past the WEIGHT_LONG_PRESS_MOVE_TOLERANCE_PX threshold
   * (= probably scrolling / hesitating, not pressing-and-holding).
   */
  private handleTilePointerDown = (
    e: PointerEvent,
    nodeId: string,
    weight: number,
  ): void => {
    const tile = e.currentTarget as HTMLElement;
    delete tile.dataset["firedLongPress"];
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const timer = window.setTimeout(() => {
      const entry = this.longPressTimers.get(pointerId);
      if (!entry) return;
      entry.fired = true;
      // Mark the tile so the impending click event (when the
      // operator releases the long-press) is suppressed by
      // handleTileClick.
      tile.dataset["firedLongPress"] = "true";
      // SPEC §17.52-polish -- query the weight-edit-button child
      // on this tile and capture its rect alongside the tile's,
      // so the popover can sit to the right of the icon without
      // exceeding the tile width. The button is always rendered
      // for node tiles (the plus-tile branch never gets here --
      // its pointerdown handler isn't wired to long-press), so
      // `?.getBoundingClientRect()` only resolves to `null` in a
      // unit-fixture mount that omits the button.
      const iconEl = tile.querySelector<HTMLElement>("weight-edit-button");
      const iconRect = iconEl?.getBoundingClientRect() ?? null;
      const detail: WeightEditOpenDetail = {
        nodeId: entry.nodeId,
        weight: entry.weight,
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
    }, WEIGHT_LONG_PRESS_MS);
    this.longPressTimers.set(pointerId, {
      tile,
      nodeId,
      weight,
      startX,
      startY,
      timer,
      fired: false,
    });
  };

  /**
   * SPEC §17.52 -- if the operator's finger drifts past
   * WEIGHT_LONG_PRESS_MOVE_TOLERANCE_PX before the timer fires, the
   * gesture is no longer a press-and-hold (probably a scroll or a
   * slow drag away from the tile). Cancel the timer; let the
   * eventual click drill normally if the pointer comes back.
   */
  private handleTilePointerMove = (e: PointerEvent): void => {
    const entry = this.longPressTimers.get(e.pointerId);
    if (!entry || entry.fired) return;
    const dx = e.clientX - entry.startX;
    const dy = e.clientY - entry.startY;
    if (
      Math.abs(dx) > WEIGHT_LONG_PRESS_MOVE_TOLERANCE_PX ||
      Math.abs(dy) > WEIGHT_LONG_PRESS_MOVE_TOLERANCE_PX
    ) {
      window.clearTimeout(entry.timer);
      this.longPressTimers.delete(e.pointerId);
    }
  };

  /**
   * SPEC §17.52 -- pointerup / pointercancel / pointerleave clear
   * the timer for that pointer. Note: when the long-press DID fire,
   * the `firedLongPress` flag is left on the tile so the trailing
   * click event can be suppressed; the entry itself is still
   * cleaned up here so the timer-id Map doesn't leak.
   */
  private handleTilePointerUp = (e: PointerEvent): void => {
    const entry = this.longPressTimers.get(e.pointerId);
    if (!entry) return;
    if (!entry.fired) {
      window.clearTimeout(entry.timer);
    }
    this.longPressTimers.delete(e.pointerId);
  };

  /**
   * SPEC §17.52 -- defensive cleanup of any in-flight long-press
   * timers when the grid is torn down (a board switch, an import,
   * etc.). Without this the chained timer would fire against a
   * detached element and the `dispatchEvent` would silently no-op
   * (the host has no listeners) but leak the closure until GC'd.
   */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const entry of this.longPressTimers.values()) {
      window.clearTimeout(entry.timer);
    }
    this.longPressTimers.clear();
  }

  /**
   * SPEC §4 — "Activating a real child tile → drill into it." The grid
   * dispatches a bubbling+composed event; the composition root (via the
   * shell) owns the navigation commit + the optional CSS drill animation.
   * The plus tile is intentionally NOT a `tile-drill` source: its wrapper
   * carries `data-slot="plus"` (no `@click=` listener attached here), and
   * `<plus-tile>` itself stops propagation on the inner-button click so
   * the event never reaches a sibling node tile either.
   */
  private dispatchTileDrill(nodeId: string): void {
    const detail: TileDrillDetail = { nodeId };
    this.dispatchEvent(
      new CustomEvent(TILE_DRILL_EVENT, {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "children-grid": ChildrenGrid;
  }
  interface HTMLElementEventMap {
    "tile-drill": CustomEvent<TileDrillDetail>;
  }
}
