import { describe, expect, it } from "vitest";

import {
  InvalidTimestampError,
  Timestamp,
} from "../../../../domain/values/Timestamp.js";

describe("Timestamp (\u00a717.58)", () => {
  const epoch = new Date("2026-05-01T00:00:00.000Z");
  const sameEpoch = new Date("2026-05-01T00:00:00.000Z");
  const later = new Date("2026-06-01T00:00:00.000Z");
  const earlier = new Date("2026-04-01T00:00:00.000Z");

  describe("factory + validation", () => {
    it("accepts a valid Date and returns a Timestamp", () => {
      const ts = Timestamp.of(epoch);
      expect(ts).toBeInstanceOf(Timestamp);
      expect(ts.moment.getTime()).toBe(epoch.getTime());
    });

    it("rejects an invalid Date (`new Date(\"not-a-date\")`)", () => {
      expect(() => Timestamp.of(new Date("not-a-date"))).toThrow(InvalidTimestampError);
    });

    it("rejects an explicit NaN-backed Date", () => {
      expect(() => Timestamp.of(new Date(Number.NaN))).toThrow(InvalidTimestampError);
    });

    it("rejection error carries the diagnostic prefix", () => {
      try {
        Timestamp.of(new Date("nope"));
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidTimestampError);
        expect((e as Error).message).toMatch(/Invalid Timestamp:/);
      }
    });
  });

  describe("`moment` accessor — defensive copy", () => {
    it("returns a Date with the same instant", () => {
      const ts = Timestamp.of(epoch);
      expect(ts.moment.toISOString()).toBe(epoch.toISOString());
    });

    it("returns a fresh Date on every read (mutation does NOT corrupt the VO)", () => {
      const ts = Timestamp.of(epoch);
      const copy = ts.moment;
      copy.setUTCHours(23);
      // Re-reading must yield the original instant.
      expect(ts.moment.getTime()).toBe(epoch.getTime());
    });
  });

  describe("equality + ordering", () => {
    it("`equals` is true on the same wrapped instant (separate Date inputs)", () => {
      expect(Timestamp.of(epoch).equals(Timestamp.of(sameEpoch))).toBe(true);
    });

    it("`equals` is false on different instants", () => {
      expect(Timestamp.of(epoch).equals(Timestamp.of(later))).toBe(false);
    });

    it("`isAfter` / `isBefore` reflect strict ordering", () => {
      const a = Timestamp.of(earlier);
      const b = Timestamp.of(epoch);
      const c = Timestamp.of(later);
      expect(c.isAfter(b)).toBe(true);
      expect(b.isAfter(c)).toBe(false);
      expect(a.isBefore(b)).toBe(true);
      expect(b.isBefore(a)).toBe(false);
      // Same instant: neither strictly after nor before.
      expect(b.isAfter(Timestamp.of(sameEpoch))).toBe(false);
      expect(b.isBefore(Timestamp.of(sameEpoch))).toBe(false);
    });

    it("`Timestamp.compare` returns negative / zero / positive consistent with ordering", () => {
      const a = Timestamp.of(earlier);
      const b = Timestamp.of(epoch);
      const c = Timestamp.of(later);
      expect(Timestamp.compare(a, c)).toBeLessThan(0);
      expect(Timestamp.compare(c, a)).toBeGreaterThan(0);
      expect(Timestamp.compare(b, Timestamp.of(sameEpoch))).toBe(0);
    });

    it("an unsorted Timestamp[] sorts ascending via `Timestamp.compare`", () => {
      const a = Timestamp.of(later);
      const b = Timestamp.of(earlier);
      const c = Timestamp.of(epoch);
      const sorted = [a, b, c].sort(Timestamp.compare);
      expect(sorted.map((t) => t.moment.getTime())).toEqual([
        earlier.getTime(),
        epoch.getTime(),
        later.getTime(),
      ]);
    });
  });
});
