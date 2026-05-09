import { describe, expect, it } from "vitest";

import { InvalidTimestampError, Timestamp } from "../../../../domain/values/Timestamp.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";

// SPEC §17.61 — `TimestampedValue.of` now takes a `Timestamp`, not a
// `Date`. Validation of bad dates therefore lives at `Timestamp.of`;
// the legacy `InvalidTimestampedValueError` is gone (no
// `TimestampedValue`-level invariant left once the moment is a
// non-`NaN` Timestamp).
// SPEC §17.62 — the `asOf` getter now returns a `Timestamp` (not a raw
// `Date`); the defensive-copy invariant is delegated to `Timestamp`
// (a `Timestamp` is immutable; its `.moment` accessor returns a fresh
// `Date` per call — covered in `Timestamp.test.ts`). The mutation
// guard test below is reframed to assert layered identity rather than
// `setFullYear`-style mutation, which is no longer a reachable shape
// at this layer.
describe("TimestampedValue", () => {
  const date2024 = Timestamp.of(new Date("2024-01-15T00:00:00Z"));
  const date2025 = Timestamp.of(new Date("2025-06-30T00:00:00Z"));
  const date2026 = Timestamp.of(new Date("2026-04-26T00:00:00Z"));

  it("accepts a value and a valid Timestamp", () => {
    const tv = TimestampedValue.of(42, date2025);
    expect(tv.value).toBe(42);
    expect(tv.asOf.equals(date2025)).toBe(true);
  });

  it("delegates moment validation to Timestamp.of (invalid date string)", () => {
    expect(() => Timestamp.of(new Date("not-a-date"))).toThrow(InvalidTimestampError);
  });

  it("delegates moment validation to Timestamp.of (NaN date)", () => {
    expect(() => Timestamp.of(new Date(Number.NaN))).toThrow(InvalidTimestampError);
  });

  it("exposes asOf as a Timestamp equal to the constructed moment (immutability via Timestamp invariants)", () => {
    const tv = TimestampedValue.of(42, date2025);
    expect(tv.asOf).toBeInstanceOf(Timestamp);
    expect(tv.asOf.equals(date2025)).toBe(true);
    // Mutating the .moment Date returned by the Timestamp getter
    // does not affect subsequent reads (Timestamp is immutable; .moment
    // returns a fresh Date copy each call).
    tv.asOf.moment.setFullYear(1999);
    expect(tv.asOf.equals(date2025)).toBe(true);
  });

  it("isAfter returns true when this.asOf is later", () => {
    const a = TimestampedValue.of(1, date2026);
    const b = TimestampedValue.of(1, date2024);
    expect(a.isAfter(b)).toBe(true);
  });

  it("isAfter returns false when this.asOf is earlier", () => {
    const a = TimestampedValue.of(1, date2024);
    const b = TimestampedValue.of(1, date2026);
    expect(a.isAfter(b)).toBe(false);
  });

  it("isAfter returns false when dates are equal", () => {
    const a = TimestampedValue.of(1, date2025);
    const b = TimestampedValue.of(2, date2025);
    expect(a.isAfter(b)).toBe(false);
  });

  it("compareByDate returns negative when a is earlier", () => {
    const a = TimestampedValue.of(1, date2024);
    const b = TimestampedValue.of(1, date2026);
    expect(TimestampedValue.compareByDate(a, b)).toBeLessThan(0);
  });

  it("compareByDate returns positive when a is later", () => {
    const a = TimestampedValue.of(1, date2026);
    const b = TimestampedValue.of(1, date2024);
    expect(TimestampedValue.compareByDate(a, b)).toBeGreaterThan(0);
  });

  it("compareByDate returns zero when dates are equal", () => {
    const a = TimestampedValue.of(1, date2025);
    const b = TimestampedValue.of(2, date2025);
    expect(TimestampedValue.compareByDate(a, b)).toBe(0);
  });

  it("compareByDate sorts an array chronologically", () => {
    const c = TimestampedValue.of("c", date2026);
    const a = TimestampedValue.of("a", date2024);
    const b = TimestampedValue.of("b", date2025);
    const sorted = [c, a, b].slice().sort(TimestampedValue.compareByDate);
    expect(sorted.map((tv) => tv.value)).toEqual(["a", "b", "c"]);
  });
});
