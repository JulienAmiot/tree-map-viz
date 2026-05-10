import { describe, expect, it } from "vitest";

import type { Ranged } from "../../../../domain/capabilities/Ranged.js";
import {
  LexicographicComparator,
  NumericComparator,
} from "../../../../domain/values/Comparator.js";
import { Direction } from "../../../../domain/values/Direction.js";
import {
  LenientRange,
  OutOfRangeError,
  Range,
  StrictRange,
} from "../../../../domain/values/Range.js";

describe("Range (§17.71 — v4 part 7: Ranged<T> + Range<T> hierarchy)", () => {
  describe("OutOfRangeError", () => {
    it("is an Error subclass with a tagged name and prefixed message", () => {
      const err = new OutOfRangeError("v=5 not in [10, 20]");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(OutOfRangeError);
      expect(err.name).toBe("OutOfRangeError");
      expect(err.message).toBe("Out of range: v=5 not in [10, 20]");
    });
  });

  describe("Range<T> abstract base (via StrictRange + LenientRange)", () => {
    it("StrictRange.of and LenientRange.of construct subclasses of Range", () => {
      const strict = StrictRange.of(0, 100, NumericComparator.INSTANCE);
      const lenient = LenientRange.of(0, 100, NumericComparator.INSTANCE);
      expect(strict).toBeInstanceOf(Range);
      expect(strict).toBeInstanceOf(StrictRange);
      expect(lenient).toBeInstanceOf(Range);
      expect(lenient).toBeInstanceOf(LenientRange);
    });

    it("both subclasses structurally satisfy Ranged<T>", () => {
      const r: Ranged<number> = StrictRange.of(0, 1, NumericComparator.INSTANCE);
      expect(r.minimalValue).toBe(0);
      expect(r.maximalValue).toBe(1);
      expect(typeof r.compare).toBe("function");
      expect(typeof r.direction).toBe("function");
      expect(typeof r.contains).toBe("function");
      expect(typeof r.requireValue).toBe("function");
    });

    it("compare delegates to the composed comparator", () => {
      const r = StrictRange.of(0, 100, NumericComparator.INSTANCE);
      expect(r.compare(3, 5)).toBeLessThan(0);
      expect(r.compare(7, 7)).toBe(0);
      expect(r.compare(9, 1)).toBeGreaterThan(0);
    });
  });

  describe("direction()", () => {
    it("ASCENDING when min < max in the comparator's order", () => {
      const r = StrictRange.of(10, 20, NumericComparator.INSTANCE);
      expect(r.direction()).toBe(Direction.ASCENDING);
    });

    it("DESCENDING when min > max (flipped range — lower-is-better KPI)", () => {
      const r = StrictRange.of(20, 10, NumericComparator.INSTANCE);
      expect(r.direction()).toBe(Direction.DESCENDING);
    });

    it("FLAT when min === max (degenerate range)", () => {
      const r = StrictRange.of(15, 15, NumericComparator.INSTANCE);
      expect(r.direction()).toBe(Direction.FLAT);
    });
  });

  describe("contains() — closed interval, direction-agnostic", () => {
    it("ASCENDING [10, 20]: includes interior + both endpoints, excludes outside", () => {
      const r = StrictRange.of(10, 20, NumericComparator.INSTANCE);
      expect(r.contains(15)).toBe(true);
      expect(r.contains(10)).toBe(true);
      expect(r.contains(20)).toBe(true);
      expect(r.contains(9)).toBe(false);
      expect(r.contains(21)).toBe(false);
    });

    it("DESCENDING [20, 10]: includes the same closed interval as the flipped form", () => {
      // §17.71 — the sign-product trick treats `[20, 10]` and `[10, 20]` as
      // the same closed interval; only `direction()` distinguishes them.
      const r = StrictRange.of(20, 10, NumericComparator.INSTANCE);
      expect(r.contains(15)).toBe(true);
      expect(r.contains(10)).toBe(true);
      expect(r.contains(20)).toBe(true);
      expect(r.contains(9)).toBe(false);
      expect(r.contains(21)).toBe(false);
    });

    it("FLAT [15, 15]: contains only the singleton", () => {
      const r = StrictRange.of(15, 15, NumericComparator.INSTANCE);
      expect(r.contains(15)).toBe(true);
      expect(r.contains(14)).toBe(false);
      expect(r.contains(16)).toBe(false);
    });

    it("works with LexicographicComparator over strings", () => {
      const r = StrictRange.of("a", "f", LexicographicComparator.INSTANCE);
      expect(r.contains("c")).toBe(true);
      expect(r.contains("a")).toBe(true);
      expect(r.contains("f")).toBe(true);
      expect(r.contains("g")).toBe(false);
      expect(r.contains("Z")).toBe(false);
    });
  });

  describe("StrictRange.requireValue() — throws on out-of-range", () => {
    it("returns silently for in-range values (interior + endpoints)", () => {
      const r = StrictRange.of(0, 10, NumericComparator.INSTANCE);
      expect(() => r.requireValue(5)).not.toThrow();
      expect(() => r.requireValue(0)).not.toThrow();
      expect(() => r.requireValue(10)).not.toThrow();
    });

    it("throws OutOfRangeError with a diagnostic message when v is outside", () => {
      const r = StrictRange.of(0, 10, NumericComparator.INSTANCE);
      expect(() => r.requireValue(-1)).toThrow(OutOfRangeError);
      expect(() => r.requireValue(11)).toThrow(OutOfRangeError);
      try {
        r.requireValue(42);
      } catch (e) {
        expect((e as Error).message).toContain("42");
        expect((e as Error).message).toContain("[0, 10]");
      }
    });
  });

  describe("LenientRange.requireValue() — no-op even on out-of-range", () => {
    it("never throws, regardless of containment", () => {
      const r = LenientRange.of(0, 10, NumericComparator.INSTANCE);
      expect(() => r.requireValue(5)).not.toThrow();
      expect(() => r.requireValue(-1000)).not.toThrow();
      expect(() => r.requireValue(1000)).not.toThrow();
      // contains() still answers truthfully — only requireValue is advisory.
      expect(r.contains(5)).toBe(true);
      expect(r.contains(-1000)).toBe(false);
    });
  });
});
