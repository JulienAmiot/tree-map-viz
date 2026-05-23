import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/shell/ChildrenGrid.js";
import {
  ChildrenGrid,
  TILE_DRILL_EVENT,
  WEIGHT_LONG_PRESS_MS,
  WEIGHT_LONG_PRESS_MOVE_TOLERANCE_PX,
  type TileDrillDetail,
} from "../../../../../adapters/ui/shell/ChildrenGrid.js";
import type { WeightEditOpenDetail } from "../../../../../adapters/ui/views/childWeight/weightEditEvents.js";
import { WEIGHT_EDIT_OPEN_EVENT } from "../../../../../adapters/ui/views/childWeight/weightEditEvents.js";
import type { ChildSlotViewModel } from "../../../../../adapters/ui/molecules/NodeViewModel.js";
import { FakeResizeObserver } from "../../../../fixtures/fakeResizeObserver.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

// SPEC §17.52 -- jsdom (the Vitest default DOM implementation) does
// not expose a `PointerEvent` constructor; the §17.52 long-press
// tests need to dispatch `pointerdown` / `pointerup` / `pointermove`
// to drive the gesture. Same shim as the §17.51 test file -- only
// activates when the constructor is genuinely absent.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventShim extends Event {
    pointerId: number;
    clientX: number;
    clientY: number;
    constructor(
      type: string,
      init: EventInit & {
        pointerId?: number;
        clientX?: number;
        clientY?: number;
      } = {},
    ) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.clientX = init.clientX ?? 0;
      this.clientY = init.clientY ?? 0;
    }
  }
  (globalThis as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent =
    PointerEventShim as unknown as typeof PointerEvent;
}

/**
 * Vitest unit tests for `<children-grid>`. Swap a FakeResizeObserver in
 * for `globalThis.ResizeObserver` so the controller-driven resize path
 * fires synchronously inside a test.
 */

let originalRO: typeof globalThis.ResizeObserver;

beforeEach(() => {
  originalRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  FakeResizeObserver.reset();
});

afterEach(() => {
  cleanupLitFixtures();
  globalThis.ResizeObserver = originalRO;
});

function lastObserver(): FakeResizeObserver {
  // SPEC §17.27 — TextNode tiles also install a `ResizeObserver` (one
  // per tile, for the markdown-body shrink-to-fit). The bare
  // `instances.at(-1)` picks up the most recently constructed
  // observer, which post-§17.27 is a per-tile observer rather than
  // the children-grid's own. Filter to the observer that's watching
  // a `<children-grid>` host so this helper keeps returning the
  // grid's resize observer.
  const candidates = FakeResizeObserver.instances.filter((obs) =>
    Array.from(obs.observed).some(
      (el) => el.tagName.toLowerCase() === "children-grid",
    ),
  );
  const o = candidates.at(-1);
  if (!o) throw new Error("no <children-grid> ResizeObserver was registered");
  return o;
}

function nodeSlot(id: string, title: string, weight = 1): ChildSlotViewModel {
  return {
    slot: "node",
    weight,
    vm: {
      kind: "TextNode",
      id,
      title,
      value: {
        text: title,
        dateIso: "2026-04-23T00:00:00.000Z",
        dateColor: "rgb(255, 145, 50)",
      },
    },
  };
}

function plusSlot(parentId: string, weight = 1): ChildSlotViewModel {
  return { slot: "plus", weight, parentId };
}

async function mountGrid(slots: readonly ChildSlotViewModel[]): Promise<ChildrenGrid> {
  return mountLitElement<ChildrenGrid>("children-grid", (el) => {
    el.slots = slots;
  });
}

function tilesOf(el: ChildrenGrid): HTMLElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(".tile"));
}

function childTilesOf(el: ChildrenGrid): HTMLElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[data-testid="child"]'));
}

function plusTilesOf(el: ChildrenGrid): HTMLElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[data-slot="plus"]'));
}

describe("<children-grid>", () => {
  it("renders no tiles when the slot list is empty", async () => {
    const el = await mountGrid([]);
    expect(tilesOf(el)).toHaveLength(0);
  });

  it("renders one tile per child slot after a resize observation seeds dimensions", async () => {
    const el = await mountGrid([
      nodeSlot("a", "A"),
      nodeSlot("b", "B"),
      plusSlot("p"),
    ]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    expect(tilesOf(el)).toHaveLength(3);
  });

  it("renders 0 tiles before any resize even when slots is non-empty (jsdom 0×0 default)", async () => {
    const el = await mountGrid([nodeSlot("a", "A"), nodeSlot("b", "B")]);
    expect(tilesOf(el)).toHaveLength(0);
  });

  it("absolutely positions each tile with squarify-driven left/top/width/height", async () => {
    const el = await mountGrid([nodeSlot("a", "A"), nodeSlot("b", "B")]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    const tiles = tilesOf(el);
    expect(tiles).toHaveLength(2);
    for (const tile of tiles) {
      const style = tile.getAttribute("style") ?? "";
      expect(style).toMatch(/left:\s*\d+(\.\d+)?px/);
      expect(style).toMatch(/top:\s*\d+(\.\d+)?px/);
      expect(style).toMatch(/width:\s*\d+(\.\d+)?px/);
      expect(style).toMatch(/height:\s*\d+(\.\d+)?px/);
    }
  });

  it("tile areas are proportional to slot weights (2:1)", async () => {
    const el = await mountGrid([nodeSlot("a", "A", 2), nodeSlot("b", "B", 1)]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    const [t0, t1] = tilesOf(el);
    const a0 = parseFloat(t0!.style.width) * parseFloat(t0!.style.height);
    const a1 = parseFloat(t1!.style.width) * parseFloat(t1!.style.height);
    expect(a0 / a1).toBeCloseTo(2, 1);
  });

  it("renders a `<node-view view-role=\"asChild\">` inside each node tile, with the right vm.id", async () => {
    const el = await mountGrid([nodeSlot("uuid-1", "Title 1"), nodeSlot("uuid-2", "Title 2")]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    const childTiles = childTilesOf(el);
    expect(childTiles).toHaveLength(2);
    const nodeViews = childTiles.map((t) => t.querySelector("node-view"));
    expect(nodeViews[0]?.getAttribute("view-role")).toBe("asChild");
    expect(nodeViews[1]?.getAttribute("view-role")).toBe("asChild");
    expect(childTiles[0]?.dataset["id"]).toBe("uuid-1");
    expect(childTiles[1]?.dataset["id"]).toBe("uuid-2");
  });

  it("emits `data-testid=\"child\"` only on node tiles (the `+` is not a child, §12.3)", async () => {
    const el = await mountGrid([nodeSlot("a", "A"), plusSlot("focused-parent")]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    expect(childTilesOf(el)).toHaveLength(1);
    expect(plusTilesOf(el)).toHaveLength(1);
    expect(tilesOf(el)).toHaveLength(2);
  });

  it("renders a `<plus-tile>` inside each plus slot, passing the parentId through", async () => {
    const el = await mountGrid([nodeSlot("a", "A"), plusSlot("focused-parent")]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    const plusWrappers = plusTilesOf(el);
    expect(plusWrappers).toHaveLength(1);
    const plus = plusWrappers[0]?.querySelector("plus-tile");
    expect(plus?.getAttribute("parent-id")).toBe("focused-parent");
    expect(plusWrappers[0]?.dataset["parentId"]).toBe("focused-parent");
  });

  it("re-renders tiles when the slots property changes", async () => {
    const el = await mountGrid([nodeSlot("a", "A")]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;
    expect(tilesOf(el)).toHaveLength(1);

    el.slots = [nodeSlot("a", "A"), nodeSlot("b", "B"), plusSlot("p")];
    await el.updateComplete;
    expect(tilesOf(el)).toHaveLength(3);
  });

  it("re-runs squarify when the host resizes, mirroring the new dimensions", async () => {
    // The grid uses an internal padding (TILE_PADDING_PX in ChildrenGrid.ts),
    // so the tiles fill the inner (W − 2p) × (H − 2p) box. The exact value of
    // the padding is an implementation detail — we just assert the total area
    // strictly grows when the host grows, and matches a reasonable fraction
    // of the host area.
    const el = await mountGrid([nodeSlot("a", "A"), nodeSlot("b", "B")]);
    lastObserver().fire([{ target: el, rect: { width: 400, height: 200 } }]);
    await el.updateComplete;
    const sumArea = (): number =>
      tilesOf(el).reduce(
        (s, t) => s + parseFloat(t.style.width) * parseFloat(t.style.height),
        0,
      );
    const small = sumArea();
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThanOrEqual(400 * 200);

    lastObserver().fire([{ target: el, rect: { width: 800, height: 400 } }]);
    await el.updateComplete;
    const big = sumArea();
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThanOrEqual(800 * 400);
    // Doubling each axis ⇒ ~4× the inner area.
    expect(big / small).toBeCloseTo(4, 0);
  });

  it("plus tile carries the same weight=1 contract as the slot (kept tappable, §4)", async () => {
    // Heavy node + plus tile (weight=1). Plus tile must still get a non-zero area
    // because §4 mandates the 1/12 floor on every tile.
    const el = await mountGrid([nodeSlot("heavy", "H", 9), plusSlot("p", 1)]);
    lastObserver().fire([{ target: el, rect: { width: 1200, height: 600 } }]);
    await el.updateComplete;

    const plusWrapper = plusTilesOf(el)[0]!;
    const area =
      parseFloat(plusWrapper.style.width) * parseFloat(plusWrapper.style.height);
    const childrenArea = 1200 * 600;
    expect(area).toBeGreaterThanOrEqual(childrenArea / 12 - 1);
  });

  it("node tiles get a distinguishable look: bg tint + 1px border + radius (\u00a717.17)", async () => {
    // SPEC §17.17 — child tiles must be visually distinguishable from
    // each other so the operator can tell where one ends and the next
    // begins, even when the value text is empty. jsdom doesn't compute
    // styles from <style> tag rules, so we pin the rule at the source:
    // the static CSS string. (Real-browser behaviour is verified in
    // `tile_layout.feature` via Playwright getComputedStyle.)
    const cssText = String(
      // CSSResult exposes its template as `cssText`.
      (ChildrenGrid.styles as unknown as { cssText?: string }).cssText ??
        ChildrenGrid.styles,
    );
    expect(cssText).toMatch(/\.tile\[data-slot="node"\][\s\S]*background:/);
    expect(cssText).toMatch(/\.tile\[data-slot="node"\][\s\S]*border:\s*1px\s*solid/);
    expect(cssText).toMatch(/\.tile\[data-slot="node"\][\s\S]*border-radius:/);
    // The plus slot is intentionally NOT covered by the tinted/bordered
    // rule — its dashed border lives on the inner button (plus-tile.ts).
    expect(cssText).not.toMatch(/\.tile\[data-slot="plus"\]/);
  });

  it("clicking a node tile dispatches a bubbling+composed `tile-drill` carrying the nodeId (\u00a717.20)", async () => {
    const el = await mountGrid([nodeSlot("uuid-a", "A"), nodeSlot("uuid-b", "B")]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    const tiles = childTilesOf(el);
    expect(tiles).toHaveLength(2);

    const seen: TileDrillDetail[] = [];
    el.addEventListener(TILE_DRILL_EVENT, (e) => {
      seen.push((e as CustomEvent<TileDrillDetail>).detail);
    });
    tiles[1]!.click();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.nodeId).toBe("uuid-b");
  });

  it("clicking the plus tile does NOT dispatch `tile-drill` (the `+` is not a navigation target, \u00a74)", async () => {
    const el = await mountGrid([nodeSlot("a", "A"), plusSlot("focused-parent")]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener(TILE_DRILL_EVENT, handler);

    const plusWrapper = plusTilesOf(el)[0]!;
    plusWrapper.click(); // the wrapper itself has no @click; sanity that the wrapper is not a drill source.
    expect(handler).not.toHaveBeenCalled();
  });

  it("the cursor hint on node tiles signals tap-to-drill (\u00a717.20)", () => {
    const cssText = String(
      (ChildrenGrid.styles as unknown as { cssText?: string }).cssText ??
        ChildrenGrid.styles,
    );
    expect(cssText).toMatch(/\.tile\[data-slot="node"\][\s\S]*cursor:\s*pointer/);
  });

  it("renders one tile per slot with the correct data-slot for downstream styling (\u00a717.17)", async () => {
    // The §17.17 distinction is selected via `[data-slot="node"]`; pin
    // that the attribute is actually emitted on every node wrapper and
    // never on a plus wrapper (the plus wrapper carries `data-slot="plus"`).
    const el = await mountGrid([
      nodeSlot("a", "A"),
      nodeSlot("b", "B"),
      plusSlot("p"),
    ]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    for (const tile of childTilesOf(el)) {
      expect(tile.dataset["slot"]).toBe("node");
    }
    for (const tile of plusTilesOf(el)) {
      expect(tile.dataset["slot"]).toBe("plus");
    }
  });

  // -- SPEC §17.52 -- child-tile weight edit affordance ----------------

  describe("\u00a717.52 \u2014 child-tile weight edit", () => {
    it("each node tile embeds a <weight-edit-button> with the slot's nodeId + weight", async () => {
      // SPEC §17.52 -- the corner icon is a per-tile affordance
      // rendered as a sibling of <node-view> inside the tile
      // wrapper. The button carries the node-id + the live weight
      // so the popover can pre-fill the slider without a second
      // VM lookup.
      const el = await mountGrid([
        nodeSlot("uuid-a", "A", 2.5),
        nodeSlot("uuid-b", "B", 0.5),
      ]);
      lastObserver().fire([
        { target: el, rect: { width: 600, height: 300 } },
      ]);
      await el.updateComplete;
      const tiles = childTilesOf(el);
      expect(tiles).toHaveLength(2);
      const buttons = tiles.map((t) => t.querySelector("weight-edit-button"));
      expect(buttons[0]?.getAttribute("node-id")).toBe("uuid-a");
      expect(buttons[1]?.getAttribute("node-id")).toBe("uuid-b");
      expect((buttons[0] as HTMLElement & { weight: number }).weight).toBe(
        2.5,
      );
      expect((buttons[1] as HTMLElement & { weight: number }).weight).toBe(
        0.5,
      );
      // The tile wrapper publishes the live weight as a data
      // attribute too -- handy for e2e selectors and for the
      // §17.52 long-press handler which reads it without going
      // back to the slot list.
      expect(tiles[0]?.dataset["weight"]).toBe("2.5");
      expect(tiles[1]?.dataset["weight"]).toBe("0.5");
    });

    it("plus tiles do NOT embed a <weight-edit-button> (\u00a74 \u2014 the + has no weight to edit)", async () => {
      const el = await mountGrid([nodeSlot("a", "A"), plusSlot("p")]);
      lastObserver().fire([
        { target: el, rect: { width: 600, height: 300 } },
      ]);
      await el.updateComplete;
      const plus = plusTilesOf(el)[0]!;
      expect(plus.querySelector("weight-edit-button")).toBeNull();
    });

    it("a long-press on a tile dispatches `weight-edit-open` after WEIGHT_LONG_PRESS_MS (\u00a717.52)", async () => {
      // SPEC §17.52 -- the second trigger (besides the corner
      // icon): pressing-and-holding the tile body for 500 ms
      // opens the popover. The press-and-hold is a hidden
      // gesture meant for power users; the visible icon is the
      // discoverable path.
      vi.useFakeTimers();
      try {
        const el = await mountGrid([nodeSlot("uuid-a", "A", 3)]);
        lastObserver().fire([
          { target: el, rect: { width: 600, height: 300 } },
        ]);
        await el.updateComplete;
        const tile = childTilesOf(el)[0]!;
        const seen: WeightEditOpenDetail[] = [];
        el.addEventListener(WEIGHT_EDIT_OPEN_EVENT, (e) => {
          seen.push(
            (e as CustomEvent<WeightEditOpenDetail>).detail,
          );
        });
        tile.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        // Pre-threshold: no event yet.
        vi.advanceTimersByTime(WEIGHT_LONG_PRESS_MS - 1);
        expect(seen).toHaveLength(0);
        // Cross the threshold.
        vi.advanceTimersByTime(2);
        expect(seen).toHaveLength(1);
        expect(seen[0]?.nodeId).toBe("uuid-a");
        expect(seen[0]?.weight).toBe(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it("releasing before WEIGHT_LONG_PRESS_MS does NOT dispatch `weight-edit-open` (\u00a717.52 \u2014 short tap = drill)", async () => {
      vi.useFakeTimers();
      try {
        const el = await mountGrid([nodeSlot("uuid-a", "A")]);
        lastObserver().fire([
          { target: el, rect: { width: 600, height: 300 } },
        ]);
        await el.updateComplete;
        const tile = childTilesOf(el)[0]!;
        const handler = vi.fn();
        el.addEventListener(WEIGHT_EDIT_OPEN_EVENT, handler);
        tile.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        vi.advanceTimersByTime(200);
        tile.dispatchEvent(
          new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
        );
        vi.advanceTimersByTime(2000);
        expect(handler).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("a pointer-drift past WEIGHT_LONG_PRESS_MOVE_TOLERANCE_PX cancels the long-press timer (\u00a717.52)", async () => {
      vi.useFakeTimers();
      try {
        const el = await mountGrid([nodeSlot("uuid-a", "A")]);
        lastObserver().fire([
          { target: el, rect: { width: 600, height: 300 } },
        ]);
        await el.updateComplete;
        const tile = childTilesOf(el)[0]!;
        const handler = vi.fn();
        el.addEventListener(WEIGHT_EDIT_OPEN_EVENT, handler);
        tile.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        // Drift past the tolerance in y.
        tile.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            pointerId: 1,
            clientX: 100,
            clientY: 100 + WEIGHT_LONG_PRESS_MOVE_TOLERANCE_PX + 1,
          }),
        );
        vi.advanceTimersByTime(WEIGHT_LONG_PRESS_MS + 100);
        expect(handler).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("the click that follows a fired long-press does NOT dispatch `tile-drill` (\u00a717.52 \u2014 long-press wins)", async () => {
      // SPEC §17.52 -- when the long-press fires, the
      // subsequent click (when the operator releases) must be
      // suppressed. Without this contract releasing a long-press
      // would simultaneously open the weight popover AND drill
      // into the tile, leaving the popover orphaned over a
      // different focused node.
      vi.useFakeTimers();
      try {
        const el = await mountGrid([nodeSlot("uuid-a", "A")]);
        lastObserver().fire([
          { target: el, rect: { width: 600, height: 300 } },
        ]);
        await el.updateComplete;
        const tile = childTilesOf(el)[0]!;
        const drillHandler = vi.fn();
        el.addEventListener(TILE_DRILL_EVENT, drillHandler);
        tile.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        vi.advanceTimersByTime(WEIGHT_LONG_PRESS_MS + 1);
        // Long-press fired -- now the operator releases. The
        // browser would normally fire `click` after pointerup,
        // but we simulate it directly since jsdom doesn't.
        tile.dispatchEvent(
          new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
        );
        tile.click();
        expect(drillHandler).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("a normal short-tap click DOES dispatch `tile-drill` (no long-press in flight, \u00a74 carry-through)", async () => {
      // SPEC §4 carry-through -- the §17.52 long-press path
      // must NOT regress the canonical drill gesture for a
      // simple tap.
      const el = await mountGrid([
        nodeSlot("uuid-a", "A"),
        nodeSlot("uuid-b", "B"),
      ]);
      lastObserver().fire([
        { target: el, rect: { width: 600, height: 300 } },
      ]);
      await el.updateComplete;
      const tile = childTilesOf(el)[1]!;
      const seen: TileDrillDetail[] = [];
      el.addEventListener(TILE_DRILL_EVENT, (e) => {
        seen.push((e as CustomEvent<TileDrillDetail>).detail);
      });
      tile.click();
      expect(seen).toHaveLength(1);
      expect(seen[0]?.nodeId).toBe("uuid-b");
    });

    it("the .tile selector carries a CSS transition on top/left/width/height for the post-commit reflow (\u00a717.52)", () => {
      const cssText = String(
        (ChildrenGrid.styles as unknown as { cssText?: string }).cssText ??
          ChildrenGrid.styles,
      );
      expect(cssText).toMatch(
        /\.tile\s*\{[^}]*transition:\s*top\s+320ms\s+ease,\s*left\s+320ms\s+ease,\s*width\s+320ms\s+ease,\s*height\s+320ms\s+ease/,
      );
    });

    it("the .tile > * fill rule narrows to .tile > node-view + .tile > plus-tile so the corner button sizes naturally (\u00a717.52)", () => {
      // SPEC §17.52 -- the pre-§17.52 `.tile > *` rule forced
      // every direct child to fill the tile, which would have
      // forced the absolutely-positioned corner button to width
      // 100% / height 100%. The §17.52 split keeps the fill rule
      // for the two intentional fillers (<node-view> + <plus-
      // tile>) and lets the weight-edit-button auto-size.
      const cssText = String(
        (ChildrenGrid.styles as unknown as { cssText?: string }).cssText ??
          ChildrenGrid.styles,
      );
      expect(cssText).toMatch(
        /\.tile\s*>\s*node-view\s*\{[^}]*width:\s*100%/,
      );
      expect(cssText).toMatch(
        /\.tile\s*>\s*plus-tile\s*\{[^}]*width:\s*100%/,
      );
      // The pre-§17.52 broad selector must be gone (a literal
      // `.tile > *` would re-trip the corner-button sizing).
      expect(cssText).not.toMatch(/\.tile\s*>\s*\*\s*\{/);
    });
  });
});
