/**
 * Vitest unit tests for `runDrillTransition` (SPEC §12.2 — Phase 9).
 *
 * Pinned contracts:
 *  - reduce-motion path: commit fires synchronously, the class is never
 *    added.
 *  - default path: class is added immediately, commit fires after
 *    `DRILL_SETTLE_MS`, class is removed afterwards.
 *  - test-no-anim sentinel (testBridge.dismissAnimations) takes the same
 *    path as system-level reduced-motion.
 *  - Custom `className` + `settleMs` overrides land where expected.
 *  - The schedule seam is consulted (no `setTimeout` reach-through).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DRILL_CLASS,
  DRILL_SETTLE_MS,
  runDrillTransition,
} from "../../../../../adapters/ui/animations/drillTransitions.js";
import { TEST_NO_ANIM_CLASS } from "../../../../../adapters/testBridge.js";

function makeHost(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.classList.remove(TEST_NO_ANIM_CLASS);
});

describe("runDrillTransition", () => {
  describe("reduced-motion paths (skip animation, commit immediately)", () => {
    it("calls commit synchronously when shouldReduceMotion returns true", () => {
      const host = makeHost();
      const commit = vi.fn();
      runDrillTransition({
        host,
        commit,
        shouldReduceMotion: () => true,
        schedule: () => {
          throw new Error("schedule must not be called on reduce-motion");
        },
      });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(host.classList.contains(DRILL_CLASS)).toBe(false);
    });

    it("respects the testBridge sentinel (`test-no-anim` on <html>)", () => {
      document.documentElement.classList.add(TEST_NO_ANIM_CLASS);
      const host = makeHost();
      const commit = vi.fn();
      const schedule = vi.fn();
      runDrillTransition({ host, commit, schedule });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(host.classList.contains(DRILL_CLASS)).toBe(false);
      expect(schedule).not.toHaveBeenCalled();
    });

    it("the helper's sentinel literal stays in lock-step with the testBridge constant", () => {
      // The helper inlines the `test-no-anim` literal instead of static-
      // importing `TEST_NO_ANIM_CLASS` from `testBridge.ts` (which would
      // pull the bridge into the production main chunk and defeat the
      // dynamic-import gate). This test pins the two values together so a
      // future rename of the bridge constant fails fast here, not silently
      // at runtime in headless Chromium.
      document.documentElement.classList.add(TEST_NO_ANIM_CLASS);
      const host = makeHost();
      const commit = vi.fn();
      runDrillTransition({ host, commit });
      // If the helper's literal got out of sync with the bridge, commit
      // would NOT have fired synchronously (the helper would have queued a
      // timer instead).
      expect(commit).toHaveBeenCalledTimes(1);
      expect(TEST_NO_ANIM_CLASS).toBe("test-no-anim");
    });
  });

  describe("animation path (no preference)", () => {
    let timers: { run(): void };

    beforeEach(() => {
      vi.useFakeTimers();
      timers = {
        run: () => {
          vi.runAllTimers();
        },
      };
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("adds the drill class synchronously and commits after DRILL_SETTLE_MS", () => {
      const host = makeHost();
      const commit = vi.fn();
      runDrillTransition({
        host,
        commit,
        shouldReduceMotion: () => false,
      });
      // Class is on while in flight, commit not yet called.
      expect(host.classList.contains(DRILL_CLASS)).toBe(true);
      expect(commit).not.toHaveBeenCalled();
      // Advance to the settle moment exactly.
      vi.advanceTimersByTime(DRILL_SETTLE_MS - 1);
      expect(commit).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(host.classList.contains(DRILL_CLASS)).toBe(false);
    });

    it("removes the class even when commit throws (cleanup is mandatory)", () => {
      const host = makeHost();
      const failing = vi.fn(() => {
        throw new Error("commit blew up");
      });
      runDrillTransition({
        host,
        commit: failing,
        shouldReduceMotion: () => false,
      });
      expect(host.classList.contains(DRILL_CLASS)).toBe(true);
      // The thrown error propagates out of the timer callback; we still
      // expect the class to be removed in the `finally` branch.
      expect(() => timers.run()).toThrow("commit blew up");
      expect(host.classList.contains(DRILL_CLASS)).toBe(false);
      expect(failing).toHaveBeenCalledTimes(1);
    });

    it("uses the custom className and settleMs overrides", () => {
      const host = makeHost();
      const commit = vi.fn();
      const schedule = vi.fn<(cb: () => void, ms: number) => void>();
      runDrillTransition({
        host,
        commit,
        className: "encap--leave",
        settleMs: 999,
        shouldReduceMotion: () => false,
        schedule,
      });
      expect(host.classList.contains("encap--leave")).toBe(true);
      expect(host.classList.contains(DRILL_CLASS)).toBe(false);
      expect(schedule).toHaveBeenCalledTimes(1);
      expect(schedule.mock.calls[0]?.[1]).toBe(999);
      // Drive the schedule manually.
      const cb = schedule.mock.calls[0]?.[0] as () => void;
      cb();
      expect(commit).toHaveBeenCalledTimes(1);
      expect(host.classList.contains("encap--leave")).toBe(false);
    });

    it("the schedule seam fully replaces setTimeout (no real timer is queued)", () => {
      const host = makeHost();
      const commit = vi.fn();
      const schedule = vi.fn<(cb: () => void, ms: number) => void>();
      const setTimeoutSpy = vi.spyOn(window, "setTimeout");
      runDrillTransition({
        host,
        commit,
        shouldReduceMotion: () => false,
        schedule,
      });
      expect(schedule).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      setTimeoutSpy.mockRestore();
    });
  });
});
