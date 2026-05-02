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
import "../views/index.js";
import type { ChildSlotViewModel } from "../views/NodeViewModel.js";

const TILE_PADDING_PX = 4;

/** Bubbling+composed event fired when a node tile is activated (SPEC §4 — drill). */
export const TILE_DRILL_EVENT = "tile-drill";

export type TileDrillDetail = {
  /** Uuid of the node the user wants to drill into. */
  readonly nodeId: string;
};

@customElement("children-grid")
export class ChildrenGrid extends LitElement {
  @property({ attribute: false })
  slots: readonly ChildSlotViewModel[] = [];

  treemap = new TreemapController(this);

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
    }
    .tile > * {
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
       tests (a grid mounted outside <tree-graph-screen> won't
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
         wrapper (encap--drill in TreeGraphScreen). */
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
      return html`<div
        class="tile"
        data-testid="child"
        data-slot="node"
        data-id=${nodeId}
        data-view-kind=${slot.vm.kind}
        style=${style}
        @click=${(): void => this.dispatchTileDrill(nodeId)}
      >
        <node-view view-role="asChild" .vm=${slot.vm}></node-view>
      </div>`;
    })}`;
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
