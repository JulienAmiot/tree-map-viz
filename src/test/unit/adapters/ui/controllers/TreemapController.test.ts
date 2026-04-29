import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TreemapController } from "../../../../../adapters/ui/controllers/TreemapController.js";
import { FakeResizeObserver } from "../../../../fixtures/fakeResizeObserver.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

/**
 * Tiny test-only Lit element that hosts a TreemapController against a
 * FakeResizeObserver. The host does NOT call `controller.layout` from its
 * lifecycle — each test drives the controller (via `el.treemap.layout(...)`
 * and `lastObserver().fire(...)`) directly. That keeps the controller's
 * contract observable without a host policy interfering.
 */
@customElement("treemap-host")
class TreemapHost extends LitElement {
  treemap = new TreemapController(this, FakeResizeObserver);
  updates = 0;
  override requestUpdate(name?: PropertyKey, oldValue?: unknown): void {
    this.updates += 1;
    super.requestUpdate(name, oldValue);
  }
  render() {
    return html`<span data-testid="rect-count">${this.treemap.rects.length}</span>`;
  }
}

function lastObserver(): FakeResizeObserver {
  const o = FakeResizeObserver.instances.at(-1);
  if (!o) throw new Error("no FakeResizeObserver instance was created");
  return o;
}

beforeEach(() => FakeResizeObserver.reset());
afterEach(cleanupLitFixtures);

describe("TreemapController", () => {
  it("rects is empty before any layout call or observation", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    expect(el.treemap.rects).toEqual([]);
  });

  it("rects stays empty when host content size is 0 (jsdom default) even after layout()", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    el.treemap.layout([1, 1, 1]);
    expect(el.treemap.rects).toEqual([]);
  });

  it("computes one rect per weight after a resize observation seeds dimensions", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    el.treemap.layout([2, 1]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    expect(el.treemap.rects).toHaveLength(2);
  });

  it("rect areas reflect the supplied weights (2:1)", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    el.treemap.layout([2, 1]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    const [a, b] = el.treemap.rects;
    expect((a!.w * a!.h) / (b!.w * b!.h)).toBeCloseTo(2, 1);
  });

  it("rects fully cover the host area (sum of areas == width × height)", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    el.treemap.layout([1, 1, 1, 1]);
    lastObserver().fire([{ target: el, rect: { width: 400, height: 200 } }]);
    await el.updateComplete;

    const totalArea = el.treemap.rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(totalArea).toBeCloseTo(400 * 200, 0);
  });

  it("re-runs layout on resize while keeping the same weights", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    el.treemap.layout([1, 1, 1, 1]);

    lastObserver().fire([{ target: el, rect: { width: 400, height: 200 } }]);
    await el.updateComplete;
    const firstSum = el.treemap.rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(firstSum).toBeCloseTo(400 * 200, 0);

    lastObserver().fire([{ target: el, rect: { width: 800, height: 400 } }]);
    await el.updateComplete;
    const secondSum = el.treemap.rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(secondSum).toBeCloseTo(800 * 400, 0);
  });

  it("subscribes to ResizeObserver on hostConnected (observes the host)", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    const observer = lastObserver();
    expect(observer.observed.has(el)).toBe(true);
    expect(observer.observeCalls).toBe(1);
  });

  it("disconnects the ResizeObserver on hostDisconnected", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    const observer = lastObserver();
    el.remove();
    expect(observer.disconnectCalls).toBe(1);
    expect(observer.observed.size).toBe(0);
  });

  it("calls host.requestUpdate when a resize actually changes rects", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    el.treemap.layout([1, 1]);
    await el.updateComplete;

    const baseline = el.updates;
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;
    expect(el.updates).toBeGreaterThan(baseline);
  });

  it("does NOT call host.requestUpdate when a resize keeps the same dimensions", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    el.treemap.layout([1, 1]);
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;
    const baseline = el.updates;

    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;
    expect(el.updates).toBe(baseline);
  });

  it("layout() does NOT call host.requestUpdate (host is already rendering)", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    const baseline = el.updates;
    el.treemap.layout([1, 2, 3]);
    expect(el.updates).toBe(baseline);
  });

  it("layout() with new weights immediately reflects in rects", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    el.treemap.layout([2, 1]);
    const [a1, b1] = el.treemap.rects;
    expect((a1!.w * a1!.h) / (b1!.w * b1!.h)).toBeCloseTo(2, 1);

    el.treemap.layout([1, 2]);
    const [a2, b2] = el.treemap.rects;
    expect((b2!.w * b2!.h) / (a2!.w * a2!.h)).toBeCloseTo(2, 1);
  });

  it("forwards the padding option to the underlying layout function", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    lastObserver().fire([{ target: el, rect: { width: 600, height: 300 } }]);
    await el.updateComplete;

    el.treemap.layout([1], { padding: 10 });
    const r = el.treemap.rects[0]!;
    expect(r.x).toBeCloseTo(10, 1);
    expect(r.y).toBeCloseTo(10, 1);
    expect(r.w).toBeCloseTo(580, 1);
    expect(r.h).toBeCloseTo(280, 1);
  });

  it("re-applies the most recent options on resize-triggered re-layout", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    el.treemap.layout([1], { padding: 10 });

    lastObserver().fire([{ target: el, rect: { width: 800, height: 400 } }]);
    await el.updateComplete;

    const r = el.treemap.rects[0]!;
    expect(r.x).toBeCloseTo(10, 1);
    expect(r.y).toBeCloseTo(10, 1);
    expect(r.w).toBeCloseTo(780, 1);
    expect(r.h).toBeCloseTo(380, 1);
  });

  it("layout() returns the freshly computed rects (same reference as `rects`)", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    lastObserver().fire([{ target: el, rect: { width: 400, height: 200 } }]);
    await el.updateComplete;

    const rects = el.treemap.layout([1, 1, 1]);
    expect(rects).toHaveLength(3);
    expect(rects).toBe(el.treemap.rects);
  });

  it("empty weights produce empty rects (no plus tile, no children)", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    lastObserver().fire([{ target: el, rect: { width: 400, height: 200 } }]);
    await el.updateComplete;

    el.treemap.layout([]);
    expect(el.treemap.rects).toEqual([]);
  });

  it("ignores resize entries for targets other than the host", async () => {
    const el = await mountLitElement<TreemapHost>("treemap-host");
    el.treemap.layout([1, 1]);

    const other = document.createElement("div");
    document.body.appendChild(other);
    const baseline = el.updates;
    try {
      lastObserver().fire([{ target: other, rect: { width: 600, height: 300 } }]);
      await el.updateComplete;
      expect(el.treemap.rects).toEqual([]);
      expect(el.updates).toBe(baseline);
    } finally {
      other.remove();
    }
  });
});
