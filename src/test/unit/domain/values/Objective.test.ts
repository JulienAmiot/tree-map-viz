import { describe, expect, it } from "vitest";

import { Objective } from "../../../../domain/values/Objective.js";
import { InvalidTimestampError, Timestamp } from "../../../../domain/values/Timestamp.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));

describe("Objective (§17.76 — v4 redesign of v3 Objective<T>)", () => {
  describe("factory + accessors", () => {
    it("of(value, at) builds an Objective<T> exposing both fields", () => {
      const at = T("2026-12-31T00:00:00Z");
      const obj = Objective.of(100, at);
      expect(obj.value).toBe(100);
      expect(obj.at.equals(at)).toBe(true);
    });

    it("at getter returns a fresh Timestamp on each call (defensive copy via Timestamp.moment)", () => {
      const at = T("2026-12-31T00:00:00Z");
      const obj = Objective.of(100, at);
      obj.at.moment.setFullYear(1999);
      expect(obj.at.equals(at)).toBe(true);
    });

    it("delegates moment validation to Timestamp.of (caller never builds an Objective with NaN-time)", () => {
      expect(() => Timestamp.of(new Date("not-a-date"))).toThrow(InvalidTimestampError);
    });
  });

  describe("equals()", () => {
    const at = T("2026-12-31T00:00:00Z");
    const sameAt = T("2026-12-31T00:00:00Z");
    const otherAt = T("2027-12-31T00:00:00Z");

    it("two objectives with identical components are equal", () => {
      const a = Objective.of(100, at);
      const b = Objective.of(100, sameAt);
      expect(a.equals(b)).toBe(true);
    });

    it("two objectives with different value are not equal", () => {
      const a = Objective.of(100, at);
      const b = Objective.of(200, at);
      expect(a.equals(b)).toBe(false);
    });

    it("two objectives with different at are not equal", () => {
      const a = Objective.of(100, at);
      const b = Objective.of(100, otherAt);
      expect(a.equals(b)).toBe(false);
    });

    it("equality is reflexive on a single instance", () => {
      const obj = Objective.of(100, at);
      expect(obj.equals(obj)).toBe(true);
    });
  });

  describe("generic over T", () => {
    it("works with non-numeric T (string)", () => {
      const at = T("2026-12-31T00:00:00Z");
      const obj = Objective.of<string>("ship-v4", at);
      expect(obj.value).toBe("ship-v4");
      expect(obj.at.equals(at)).toBe(true);
    });
  });
});
