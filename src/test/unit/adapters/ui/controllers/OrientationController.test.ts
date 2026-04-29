import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  OrientationController,
  type Orientation,
} from "../../../../../adapters/ui/controllers/OrientationController.js";
import { FakeResizeObserver } from "../../../../fixtures/fakeResizeObserver.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

/**
 * Tiny test-only Lit element that hosts an OrientationController against a
 * FakeResizeObserver. Each test mounts a fresh instance via
 * `mountLitElement` and exercises resize events through the fake.
 *
 * `requestUpdate` is overridden to count flips so the spec
 * "calls requestUpdate only on actual orientation change" can be asserted
 * without spying on the Lit prototype.
 */
@customElement("orientation-host")
class OrientationHost extends LitElement {
  ctrl = new OrientationController(this, FakeResizeObserver);
  updates = 0;
  override requestUpdate(name?: PropertyKey, oldValue?: unknown): void {
    this.updates += 1;
    super.requestUpdate(name, oldValue);
  }
  render() {
    return html`<span data-testid="orientation">${this.ctrl.orientation}</span>`;
  }
}

function lastObserver(): FakeResizeObserver {
  const o = FakeResizeObserver.instances.at(-1);
  if (!o) throw new Error("no FakeResizeObserver instance was created");
  return o;
}

beforeEach(() => FakeResizeObserver.reset());
afterEach(cleanupLitFixtures);

describe("OrientationController", () => {
  it("starts in 'landscape' before any resize observation fires (kiosk default)", async () => {
    const el = await mountLitElement<OrientationHost>("orientation-host");
    expect(el.ctrl.orientation).toBe<Orientation>("landscape");
  });

  it("flips to 'portrait' when content rect height > width", async () => {
    const el = await mountLitElement<OrientationHost>("orientation-host");
    lastObserver().fire([{ target: el, rect: { width: 200, height: 600 } }]);
    await el.updateComplete;
    expect(el.ctrl.orientation).toBe<Orientation>("portrait");
  });

  it("flips back to 'landscape' when content rect width > height", async () => {
    const el = await mountLitElement<OrientationHost>("orientation-host");
    lastObserver().fire([{ target: el, rect: { width: 200, height: 600 } }]);
    await el.updateComplete;
    lastObserver().fire([{ target: el, rect: { width: 800, height: 450 } }]);
    await el.updateComplete;
    expect(el.ctrl.orientation).toBe<Orientation>("landscape");
  });

  it("resolves a square (w === h) tie to 'landscape' (kiosk at-rest pose)", async () => {
    const el = await mountLitElement<OrientationHost>("orientation-host");
    lastObserver().fire([{ target: el, rect: { width: 500, height: 500 } }]);
    await el.updateComplete;
    expect(el.ctrl.orientation).toBe<Orientation>("landscape");
  });

  it("subscribes to ResizeObserver on hostConnected (observes the host element)", async () => {
    const el = await mountLitElement<OrientationHost>("orientation-host");
    const observer = lastObserver();
    expect(observer.observed.has(el)).toBe(true);
    expect(observer.observeCalls).toBe(1);
  });

  it("disconnects the ResizeObserver on hostDisconnected", async () => {
    const el = await mountLitElement<OrientationHost>("orientation-host");
    const observer = lastObserver();
    el.remove();
    expect(observer.disconnectCalls).toBe(1);
    expect(observer.observed.size).toBe(0);
  });

  it("calls host.requestUpdate only when orientation actually flips", async () => {
    const el = await mountLitElement<OrientationHost>("orientation-host");
    await el.updateComplete;
    const baseline = el.updates;

    // Same-orientation resize: must NOT bump updates.
    lastObserver().fire([{ target: el, rect: { width: 800, height: 450 } }]);
    await el.updateComplete;
    expect(el.updates).toBe(baseline);

    // Flip: MUST bump updates.
    lastObserver().fire([{ target: el, rect: { width: 300, height: 800 } }]);
    await el.updateComplete;
    expect(el.updates).toBeGreaterThan(baseline);
  });

  it("ignores entries whose target is not the host element", async () => {
    const el = await mountLitElement<OrientationHost>("orientation-host");
    const other = document.createElement("div");
    document.body.appendChild(other);
    try {
      lastObserver().fire([{ target: other, rect: { width: 200, height: 800 } }]);
      await el.updateComplete;
      expect(el.ctrl.orientation).toBe<Orientation>("landscape");
    } finally {
      other.remove();
    }
  });

  it("re-subscribes when the host is reattached after a detach", async () => {
    const el = await mountLitElement<OrientationHost>("orientation-host");
    const firstObserver = lastObserver();
    el.remove();
    expect(firstObserver.disconnectCalls).toBe(1);

    document.body.appendChild(el);
    await el.updateComplete;

    const secondObserver = lastObserver();
    expect(secondObserver).not.toBe(firstObserver);
    expect(secondObserver.observed.has(el)).toBe(true);
    el.remove();
  });
});
