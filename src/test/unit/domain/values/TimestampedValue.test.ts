import { describe, expect, it } from "vitest";

import {
  InvalidTimestampedValueError,
  TimestampedValue,
} from "../../../../domain/values/TimestampedValue.js";

describe("TimestampedValue", () => {
  const date2024 = new Date("2024-01-15T00:00:00Z");
  const date2025 = new Date("2025-06-30T00:00:00Z");
  const date2026 = new Date("2026-04-26T00:00:00Z");

  it("accepts a value and a valid Date", () => {
    const tv = TimestampedValue.of(42, date2025);
    expect(tv.value).toBe(42);
    expect(tv.asOf.getTime()).toBe(date2025.getTime());
  });

  it("rejects an invalid Date", () => {
    expect(() => TimestampedValue.of(42, new Date("not-a-date"))).toThrow(
      InvalidTimestampedValueError,
    );
  });

  it("rejects a Date built from NaN", () => {
    expect(() => TimestampedValue.of(42, new Date(Number.NaN))).toThrow(
      InvalidTimestampedValueError,
    );
  });

  it("defends against caller mutating the input Date", () => {
    const input = new Date(date2025.getTime());
    const tv = TimestampedValue.of(42, input);
    input.setFullYear(1999);
    expect(tv.asOf.getTime()).toBe(date2025.getTime());
  });

  it("defends against caller mutating the exposed Date", () => {
    const tv = TimestampedValue.of(42, date2025);
    const exposed = tv.asOf;
    exposed.setFullYear(1999);
    expect(tv.asOf.getTime()).toBe(date2025.getTime());
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
