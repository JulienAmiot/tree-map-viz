import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "../../../../../adapters/ui/shell/ChildrenGrid.js";
import type { ChildrenGrid } from "../../../../../adapters/ui/shell/ChildrenGrid.js";
import type { ChildSlotViewModel } from "../../../../../adapters/ui/views/NodeViewModel.js";
import { FakeResizeObserver } from "../../../../fixtures/fakeResizeObserver.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

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
  const o = FakeResizeObserver.instances.at(-1);
  if (!o) throw new Error("no FakeResizeObserver instance was created");
  return o;
}

function nodeSlot(id: string, title: string, weight = 1): ChildSlotViewModel {
  return {
    slot: "node",
    weight,
    vm: { kind: "TextNode", id, title, description: "" },
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
});
