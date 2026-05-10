import { describe, expect, it } from "vitest";

import { Direction } from "../../../../domain/values/Direction.js";

describe("Direction (§17.66 — v4 part 5: enumerated direction VO)", () => {
  describe("singletons", () => {
    it("exposes three distinct singleton instances", () => {
      expect(Direction.ASCENDING).not.toBe(Direction.DESCENDING);
      expect(Direction.ASCENDING).not.toBe(Direction.FLAT);
      expect(Direction.DESCENDING).not.toBe(Direction.FLAT);
    });

    it("treats reference equality as value equality (no custom equals)", () => {
      // §17.66 — three inhabitants and a private constructor mean
      // `Direction.ASCENDING === Direction.ASCENDING` is the contract;
      // mirrors the round-5 §10 decision for the upcoming
      // `Comparator<T>` singletons.
      const a = Direction.ASCENDING;
      const b = Direction.ASCENDING;
      expect(a === b).toBe(true);
    });

    it("ASCENDING.name is the literal 'ASCENDING'", () => {
      expect(Direction.ASCENDING.name).toBe("ASCENDING");
    });

    it("DESCENDING.name is the literal 'DESCENDING'", () => {
      expect(Direction.DESCENDING.name).toBe("DESCENDING");
    });

    it("FLAT.name is the literal 'FLAT'", () => {
      expect(Direction.FLAT.name).toBe("FLAT");
    });
  });

  describe("fromCompareSign", () => {
    it("maps a strictly negative verdict to ASCENDING (min < max in comparator order)", () => {
      expect(Direction.fromCompareSign(-1)).toBe(Direction.ASCENDING);
      expect(Direction.fromCompareSign(-100)).toBe(Direction.ASCENDING);
      expect(Direction.fromCompareSign(Number.MIN_SAFE_INTEGER)).toBe(
        Direction.ASCENDING,
      );
    });

    it("maps a strictly positive verdict to DESCENDING (min > max — flipped range)", () => {
      expect(Direction.fromCompareSign(1)).toBe(Direction.DESCENDING);
      expect(Direction.fromCompareSign(100)).toBe(Direction.DESCENDING);
      expect(Direction.fromCompareSign(Number.MAX_SAFE_INTEGER)).toBe(
        Direction.DESCENDING,
      );
    });

    it("maps zero to FLAT (degenerate range — min === max)", () => {
      expect(Direction.fromCompareSign(0)).toBe(Direction.FLAT);
    });

    it("treats negative zero as zero (FLAT)", () => {
      // -0 === 0 in JS, but defending the boundary explicitly so a
      // future refactor that swaps `n < 0` for `Math.sign(n) === -1`
      // (which DOES distinguish -0 from 0) doesn't silently flip the
      // semantics on us.
      expect(Direction.fromCompareSign(-0)).toBe(Direction.FLAT);
    });

    it("rejects NaN (out-of-spec comparator output)", () => {
      // §17.66 — comparators are contractually required to return a
      // finite signed number per the `Comparator<T>` interface.
      // Surfacing NaN here rather than collapsing it silently makes
      // a buggy comparator fail loud.
      expect(() => Direction.fromCompareSign(Number.NaN)).toThrow(RangeError);
    });

    it("rejects positive infinity", () => {
      expect(() => Direction.fromCompareSign(Number.POSITIVE_INFINITY)).toThrow(
        RangeError,
      );
    });

    it("rejects negative infinity", () => {
      expect(() => Direction.fromCompareSign(Number.NEGATIVE_INFINITY)).toThrow(
        RangeError,
      );
    });
  });

  describe("toString", () => {
    it("returns the singleton's name verbatim", () => {
      expect(String(Direction.ASCENDING)).toBe("ASCENDING");
      expect(String(Direction.DESCENDING)).toBe("DESCENDING");
      expect(String(Direction.FLAT)).toBe("FLAT");
    });
  });
});
