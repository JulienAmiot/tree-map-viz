import { describe, expect, it } from "vitest";

import {
  Comparator,
  LexicographicComparator,
  NumericComparator,
} from "../../../../domain/values/Comparator.js";

describe("Comparator (§17.68 — v4 part 6: Comparator<T> interface + Numeric / Lexicographic singletons)", () => {
  describe("NumericComparator (singleton, Comparator<number>)", () => {
    it("exposes a single INSTANCE accessor", () => {
      // §17.68 — class-with-private-ctor + static INSTANCE pattern, mirroring
      // the round-5 §10 decision Direction (§17.67) cross-referenced. Two
      // accesses of `INSTANCE` MUST return the same reference.
      expect(NumericComparator.INSTANCE).toBe(NumericComparator.INSTANCE);
    });

    it("INSTANCE is structurally a Comparator<number>", () => {
      const cmp: Comparator<number> = NumericComparator.INSTANCE;
      expect(typeof cmp.compare).toBe("function");
    });

    it("returns a strictly negative number when a < b", () => {
      expect(NumericComparator.INSTANCE.compare(0, 1)).toBeLessThan(0);
      expect(NumericComparator.INSTANCE.compare(-5, 5)).toBeLessThan(0);
      expect(NumericComparator.INSTANCE.compare(1.5, 1.6)).toBeLessThan(0);
    });

    it("returns a strictly positive number when a > b", () => {
      expect(NumericComparator.INSTANCE.compare(1, 0)).toBeGreaterThan(0);
      expect(NumericComparator.INSTANCE.compare(5, -5)).toBeGreaterThan(0);
      expect(NumericComparator.INSTANCE.compare(1.6, 1.5)).toBeGreaterThan(0);
    });

    it("returns zero when a === b", () => {
      expect(NumericComparator.INSTANCE.compare(0, 0)).toBe(0);
      expect(NumericComparator.INSTANCE.compare(42, 42)).toBe(0);
      expect(NumericComparator.INSTANCE.compare(-3.14, -3.14)).toBe(0);
    });

    it("rejects NaN inputs (out-of-spec — comparator contract is finite signed number)", () => {
      // §17.68 — Direction.fromCompareSign already rejects non-finite verdicts;
      // pushing the same boundary down into the comparator itself means a buggy
      // caller can't sneak a NaN past the type system and surface it later as a
      // wrong direction. Mirrors `Timestamp.of`'s NaN-Date rejection.
      expect(() => NumericComparator.INSTANCE.compare(Number.NaN, 0)).toThrow(
        RangeError,
      );
      expect(() => NumericComparator.INSTANCE.compare(0, Number.NaN)).toThrow(
        RangeError,
      );
    });

    it("rejects ±Infinity inputs", () => {
      expect(() =>
        NumericComparator.INSTANCE.compare(Number.POSITIVE_INFINITY, 0),
      ).toThrow(RangeError);
      expect(() =>
        NumericComparator.INSTANCE.compare(0, Number.NEGATIVE_INFINITY),
      ).toThrow(RangeError);
    });

    it("treats -0 as 0 (returns 0 for compare(-0, 0))", () => {
      expect(NumericComparator.INSTANCE.compare(-0, 0)).toBe(0);
      expect(NumericComparator.INSTANCE.compare(0, -0)).toBe(0);
    });

    it("is suitable as an Array#sort comparator", () => {
      const xs = [3, 1, 4, 1, 5, 9, 2, 6];
      xs.sort((a, b) => NumericComparator.INSTANCE.compare(a, b));
      expect(xs).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    });
  });

  describe("LexicographicComparator (singleton, Comparator<string>)", () => {
    it("exposes a single INSTANCE accessor", () => {
      expect(LexicographicComparator.INSTANCE).toBe(
        LexicographicComparator.INSTANCE,
      );
    });

    it("INSTANCE is structurally a Comparator<string>", () => {
      const cmp: Comparator<string> = LexicographicComparator.INSTANCE;
      expect(typeof cmp.compare).toBe("function");
    });

    it("returns a strictly negative number when a < b in UTF-16 order", () => {
      expect(LexicographicComparator.INSTANCE.compare("a", "b")).toBeLessThan(
        0,
      );
      expect(
        LexicographicComparator.INSTANCE.compare("apple", "banana"),
      ).toBeLessThan(0);
      // Empty string sorts before any non-empty string.
      expect(LexicographicComparator.INSTANCE.compare("", "a")).toBeLessThan(0);
    });

    it("returns a strictly positive number when a > b in UTF-16 order", () => {
      expect(LexicographicComparator.INSTANCE.compare("b", "a")).toBeGreaterThan(
        0,
      );
      expect(
        LexicographicComparator.INSTANCE.compare("banana", "apple"),
      ).toBeGreaterThan(0);
    });

    it("returns zero when a === b", () => {
      expect(LexicographicComparator.INSTANCE.compare("", "")).toBe(0);
      expect(LexicographicComparator.INSTANCE.compare("hello", "hello")).toBe(
        0,
      );
    });

    it("orders by UTF-16 code-unit (locale-independent — capitals before lowercase)", () => {
      // §17.68 — deliberately UTF-16 byte-order, NOT locale-aware. `localeCompare`
      // varies by locale ("café" vs "cafe" sort differently in en-US vs fr-FR);
      // a deterministic kiosk codebase wants reproducible ordering, so capitals
      // (U+0041..U+005A) sort before lowercase (U+0061..U+007A) by codepoint.
      expect(LexicographicComparator.INSTANCE.compare("Z", "a")).toBeLessThan(
        0,
      );
    });

    it("is suitable as an Array#sort comparator", () => {
      const xs = ["banana", "apple", "cherry", "apple"];
      xs.sort((a, b) => LexicographicComparator.INSTANCE.compare(a, b));
      expect(xs).toEqual(["apple", "apple", "banana", "cherry"]);
    });
  });
});
