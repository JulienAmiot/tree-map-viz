/**
 * Vitest unit tests for `runDrillTransition` (SPEC §12.2 — Phase 9,
 * rewritten in §17.32).
 *
 * Pinned contracts:
 *  - reduce-motion path: commit fires synchronously, NO inline styles
 *    (transform / opacity / colour / transition) are written to the
 *    tapped tile or to any of the fade-out elements. The test-no-anim
 *    sentinel from `testBridge.dismissAnimations()` takes the same
 *    path as system-level `prefers-reduced-motion: reduce`.
 *  - default path: the tile receives a `translate() scale()` transform
 *    derived from the FLIP rect deltas, a colour transition into
 *    `var(--board-fresh)`, and the `tile--drilling` class. All
 *    fade-out elements drop to `opacity: 0`. Commit fires after
 *    `DRILL_SETTLE_MS`; the class is cleaned up afterwards.
 *  - degenerate-rect path: when the tapped tile has zero size (e.g.
 *    jsdom defaults, or a torn-down layout), the helper falls through
 *    to the synchronous commit instead of writing a NaN / Infinity
 *    transform.
 *  - schedule seam: production path consults the injected scheduler
 *    rather than reaching `setTimeout` directly, which keeps fake
 *    timers tight in higher-level tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DRILL_CLASS,
  DRILL_SETTLE_MS,
  runDrillTransition,
} from "../../../../../adapters/ui/animations/drillTransitions.js";
import { TEST_NO_ANIM_CLASS } from "../../../../../adapters/testBridge.js";

/**
 * Build a {tile, target} pair with controllable bounding rects so the
 * FLIP-geometry math can be asserted deterministically. jsdom returns
 * 0/0 from `getBoundingClientRect()` by default; we shadow the method
 * on each element with a Vitest spy returning a fixed `DOMRect`.
 */
function makeRectStub(rect: { x: number; y: number; w: number; h: number }) {
  const r = {
    x: rect.x,
    y: rect.y,
    width: rect.w,
    height: rect.h,
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.w,
    bottom: rect.y + rect.h,
    toJSON() {
      return JSON.stringify(this);
    },
  } as DOMRect;
  return r;
}

function makeTile(rect: { x: number; y: number; w: number; h: number }): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  el.getBoundingClientRect = (): DOMRect => makeRectStub(rect);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.classList.remove(TEST_NO_ANIM_CLASS);
});

describe("runDrillTransition (FLIP morph — §17.32)", () => {
  describe("reduced-motion paths (skip animation, commit immediately)", () => {
    it("calls commit synchronously when shouldReduceMotion returns true and writes no inline styles", () => {
      const tile = makeTile({ x: 100, y: 200, w: 50, h: 60 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const sib = makeTile({ x: 200, y: 250, w: 80, h: 60 });
      const commit = vi.fn();
      runDrillTransition({
        tile,
        target,
        fadeOut: [sib],
        commit,
        shouldReduceMotion: () => true,
        schedule: () => {
          throw new Error("schedule must not be called on reduce-motion");
        },
      });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(tile.style.transform).toBe("");
      expect(tile.style.width).toBe("");
      expect(tile.style.height).toBe("");
      expect(tile.style.transition).toBe("");
      expect(tile.style.getPropertyValue("--drill-title-color")).toBe("");
      // §17.36 — the panel-surface writes (background-color / border-
      // color / border-radius) MUST be skipped on reduced-motion too:
      // the operator opted out of motion, so the morph does not stage
      // any transition target on the tile either.
      expect(tile.style.backgroundColor).toBe("");
      expect(tile.style.borderColor).toBe("");
      expect(tile.style.borderRadius).toBe("");
      expect(tile.classList.contains(DRILL_CLASS)).toBe(false);
      expect(sib.style.opacity).toBe("");
      expect(sib.style.transition).toBe("");
    });

    it("respects the testBridge sentinel (`test-no-anim` on <html>)", () => {
      document.documentElement.classList.add(TEST_NO_ANIM_CLASS);
      const tile = makeTile({ x: 100, y: 200, w: 50, h: 60 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const commit = vi.fn();
      const schedule = vi.fn();
      runDrillTransition({ tile, target, fadeOut: [], commit, schedule });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(tile.classList.contains(DRILL_CLASS)).toBe(false);
      expect(schedule).not.toHaveBeenCalled();
    });

    it("the helper's sentinel literal stays in lock-step with the testBridge constant", () => {
      // The helper inlines the `test-no-anim` literal instead of static-
      // importing `TEST_NO_ANIM_CLASS` from `testBridge.ts` (which would
      // pull the bridge into the production main chunk and defeat the
      // dynamic-import gate). This test pins the two values together so
      // a future rename of the bridge constant fails fast here, not
      // silently at runtime in headless Chromium.
      document.documentElement.classList.add(TEST_NO_ANIM_CLASS);
      const tile = makeTile({ x: 0, y: 0, w: 50, h: 50 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const commit = vi.fn();
      runDrillTransition({ tile, target, fadeOut: [], commit });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(TEST_NO_ANIM_CLASS).toBe("test-no-anim");
    });
  });

  describe("animation path (no preference)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("writes a pure translate transform derived from the FLIP position delta (no scale — scale would deform the tile content per \u00a717.32)", () => {
      const tile = makeTile({ x: 100, y: 400, w: 200, h: 150 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const commit = vi.fn();
      runDrillTransition({
        tile,
        target,
        fadeOut: [],
        commit,
        shouldReduceMotion: () => false,
      });
      // dx = 0 - 100 = -100, dy = 0 - 400 = -400
      expect(tile.style.transform).toMatch(/translate\(-100px, -400px\)/);
      // Crucial: NO scale() — the morph grows the box via width/height
      // transitions instead so the inner content (title / value /
      // timestamp / unit) reflows naturally without distortion.
      expect(tile.style.transform).not.toMatch(/scale/);
      expect(tile.style.transformOrigin).toBe("top left");
      expect(tile.style.zIndex).toBe("10");
      expect(tile.classList.contains(DRILL_CLASS)).toBe(true);
    });

    it("transitions the tile's width and height to the target rect's dimensions (\u00a717.32 — undistorted morph)", () => {
      const tile = makeTile({ x: 100, y: 400, w: 200, h: 150 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      runDrillTransition({
        tile,
        target,
        fadeOut: [],
        commit: vi.fn(),
        shouldReduceMotion: () => false,
      });
      // Final width/height match the target rect (parent strip).
      expect(tile.style.width).toBe("800px");
      expect(tile.style.height).toBe("200px");
      // Both width and height must be in the transition list so the
      // browser actually animates them; without this the grow would
      // be instantaneous on the same frame as the transform.
      expect(tile.style.transition).toContain("width");
      expect(tile.style.transition).toContain("height");
      expect(tile.style.transition).toContain("transform");
      expect(tile.style.transition).toContain(`${DRILL_SETTLE_MS}ms`);
    });

    it("transitions the tile's panel surface (background-color, border-color, border-radius) to the parent strip's panel vars (\u00a717.36)", () => {
      // §17.36 — the parent strip and child tiles share a panel
      // aesthetic (border-color + border-radius identical) but
      // different bg tints (--panel-strip-bg ≈ 12 % vs
      // --panel-tile-bg ≈ 7 %). The morph must extend its transition
      // list with `background-color`, `border-color`, and
      // `border-radius` AND write the strip's destination values onto
      // the tile so the registered transitions resolve start/end
      // values and the surface visually drifts.
      const tile = makeTile({ x: 100, y: 400, w: 200, h: 150 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      runDrillTransition({
        tile,
        target,
        fadeOut: [],
        commit: vi.fn(),
        shouldReduceMotion: () => false,
      });
      // Transition list contains all three panel properties so the
      // browser actually animates them; without this the writes
      // below would land instantaneously on the same frame.
      expect(tile.style.transition).toContain("background-color");
      expect(tile.style.transition).toContain("border-color");
      expect(tile.style.transition).toContain("border-radius");
      // Destination values are written via CSS custom properties so
      // a single source of truth (the screen's :host vars) drives
      // both the resting panel styling and the morph target. The
      // helper does not inline the literal mix percentages — they
      // live in TreeGraphScreen.ts.
      expect(tile.style.backgroundColor).toContain("--panel-strip-bg");
      expect(tile.style.borderColor).toContain("--panel-border-color");
      expect(tile.style.borderRadius).toContain("--panel-border-radius");
      // willChange covers the new properties too so the compositor
      // can hoist them onto its own layer alongside transform / size.
      expect(tile.style.willChange).toContain("background-color");
      expect(tile.style.willChange).toContain("border-color");
      expect(tile.style.willChange).toContain("border-radius");
    });

    it("recolours ONLY the title via the --drill-title-color custom property (\u00a717.32 — value/timestamp keep own colours)", () => {
      // The previous build wrote `tile.style.color = var(--board-fresh)`,
      // which cascaded to every text node in the tile (value, timestamp,
      // unit). The operator's requirement is that ONLY the title
      // recolours; the helper now uses a custom property the .title
      // rule reads in tileLayoutStyles, so siblings of .title keep
      // currentColor.
      const tile = makeTile({ x: 0, y: 0, w: 100, h: 100 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      runDrillTransition({
        tile,
        target,
        fadeOut: [],
        commit: vi.fn(),
        shouldReduceMotion: () => false,
      });
      expect(tile.style.getPropertyValue("--drill-title-color")).toBe(
        "var(--board-fresh)",
      );
      // Crucial: the tile's own `color` is NOT set — that would
      // have cascaded to every descendant.
      expect(tile.style.color).toBe("");
    });

    it("fades every fadeOut element to opacity 0 and registers their opacity transition", () => {
      const tile = makeTile({ x: 0, y: 0, w: 100, h: 100 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const sibA = makeTile({ x: 200, y: 0, w: 100, h: 100 });
      const sibB = makeTile({ x: 0, y: 200, w: 100, h: 100 });
      const oldStrip = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      runDrillTransition({
        tile,
        target,
        fadeOut: [sibA, sibB, oldStrip],
        commit: vi.fn(),
        shouldReduceMotion: () => false,
      });
      for (const el of [sibA, sibB, oldStrip]) {
        expect(el.style.opacity).toBe("0");
        expect(el.style.transition).toContain("opacity");
        expect(el.style.transition).toContain(`${DRILL_SETTLE_MS}ms`);
      }
    });

    it("commits after DRILL_SETTLE_MS and clears the drill class afterwards", () => {
      const tile = makeTile({ x: 0, y: 0, w: 100, h: 100 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const commit = vi.fn();
      runDrillTransition({
        tile,
        target,
        fadeOut: [],
        commit,
        shouldReduceMotion: () => false,
      });
      expect(commit).not.toHaveBeenCalled();
      vi.advanceTimersByTime(DRILL_SETTLE_MS - 1);
      expect(commit).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(tile.classList.contains(DRILL_CLASS)).toBe(false);
    });

    it("clears the drill class even when commit throws (cleanup is mandatory)", () => {
      const tile = makeTile({ x: 0, y: 0, w: 100, h: 100 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const failing = vi.fn(() => {
        throw new Error("commit blew up");
      });
      runDrillTransition({
        tile,
        target,
        fadeOut: [],
        commit: failing,
        shouldReduceMotion: () => false,
      });
      expect(tile.classList.contains(DRILL_CLASS)).toBe(true);
      expect(() => vi.runAllTimers()).toThrow("commit blew up");
      expect(tile.classList.contains(DRILL_CLASS)).toBe(false);
      expect(failing).toHaveBeenCalledTimes(1);
    });

    it("uses the custom settleMs override on both the schedule callback and the inline transitions", () => {
      const tile = makeTile({ x: 0, y: 0, w: 100, h: 100 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const sib = makeTile({ x: 200, y: 0, w: 100, h: 100 });
      const schedule = vi.fn<(cb: () => void, ms: number) => void>();
      runDrillTransition({
        tile,
        target,
        fadeOut: [sib],
        commit: vi.fn(),
        settleMs: 999,
        shouldReduceMotion: () => false,
        schedule,
      });
      expect(schedule).toHaveBeenCalledTimes(1);
      expect(schedule.mock.calls[0]?.[1]).toBe(999);
      expect(tile.style.transition).toContain("999ms");
      expect(sib.style.transition).toContain("999ms");
    });

    it("the schedule seam fully replaces setTimeout (no real timer is queued)", () => {
      const tile = makeTile({ x: 0, y: 0, w: 100, h: 100 });
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const schedule = vi.fn<(cb: () => void, ms: number) => void>();
      const setTimeoutSpy = vi.spyOn(window, "setTimeout");
      runDrillTransition({
        tile,
        target,
        fadeOut: [],
        commit: vi.fn(),
        shouldReduceMotion: () => false,
        schedule,
      });
      expect(schedule).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      setTimeoutSpy.mockRestore();
    });
  });

  describe("degenerate rect (zero-size tile) path", () => {
    it("falls through to the synchronous commit when the tapped tile has zero width or height", () => {
      // jsdom returns 0/0 by default. This path matters because the FLIP
      // math would yield NaN/Infinity scale factors and silently hide
      // the tile; defaulting to commit-now keeps the navigation
      // responsive.
      const tile = document.createElement("div");
      document.body.appendChild(tile);
      const target = makeTile({ x: 0, y: 0, w: 800, h: 200 });
      const commit = vi.fn();
      runDrillTransition({
        tile,
        target,
        fadeOut: [],
        commit,
        shouldReduceMotion: () => false,
        schedule: () => {
          throw new Error("schedule must not run on degenerate-rect path");
        },
      });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(tile.style.transform).toBe("");
      expect(tile.classList.contains(DRILL_CLASS)).toBe(false);
    });
  });
});
