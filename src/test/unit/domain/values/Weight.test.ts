import { describe, expect, it } from "vitest";

import { InvalidWeightError, Weight } from "../../../../domain/values/Weight.js";

describe("Weight", () => {
  it("accepts the minimum (1)", () => {
    expect(Weight.of(1).value).toBe(1);
  });

  it("accepts the maximum (10)", () => {
    expect(Weight.of(10).value).toBe(10);
  });

  it("accepts a mid-range value", () => {
    expect(Weight.of(5).value).toBe(5);
  });

  it("rejects zero", () => {
    expect(() => Weight.of(0)).toThrow(InvalidWeightError);
  });

  it("rejects negative integers", () => {
    expect(() => Weight.of(-1)).toThrow(InvalidWeightError);
  });

  it("rejects values above 10", () => {
    expect(() => Weight.of(11)).toThrow(InvalidWeightError);
  });

  it("rejects non-integer values", () => {
    expect(() => Weight.of(5.5)).toThrow(InvalidWeightError);
  });

  it("rejects NaN", () => {
    expect(() => Weight.of(Number.NaN)).toThrow(InvalidWeightError);
  });

  it("rejects positive infinity", () => {
    expect(() => Weight.of(Number.POSITIVE_INFINITY)).toThrow(InvalidWeightError);
  });

  it("rejects negative infinity", () => {
    expect(() => Weight.of(Number.NEGATIVE_INFINITY)).toThrow(InvalidWeightError);
  });

  it("compares by value (equal)", () => {
    expect(Weight.of(5).equals(Weight.of(5))).toBe(true);
  });

  it("compares by value (different)", () => {
    expect(Weight.of(3).equals(Weight.of(7))).toBe(false);
  });

  it("toString returns the numeric value", () => {
    expect(String(Weight.of(7))).toBe("7");
  });
});
