import { describe, expect, it } from "vitest";

import { InvalidWeightError, Weight } from "../../../../domain/values/Weight.js";

describe("Weight", () => {
  it("accepts the minimum (0.5) (\u00a717.31)", () => {
    // SPEC §17.31 — MIN_WEIGHT bumped from 1 to 0.5 so the slider's
    // pre-existing `step="0.5"` lower edge is now a valid domain
    // value (was a UX trap pre-§17.31: dragging to 0/0.5 produced a
    // confirm-time `Weight.of` throw).
    expect(Weight.of(0.5).value).toBe(0.5);
  });

  it("accepts the maximum (10)", () => {
    expect(Weight.of(10).value).toBe(10);
  });

  it("accepts a mid-range value", () => {
    expect(Weight.of(5).value).toBe(5);
  });

  it("accepts a non-integer value (\u00a717.31)", () => {
    // SPEC §17.31 — fractional weights now valid. The treemap
    // squarify algorithm consumes weights as ratios so it doesn't
    // care whether they're integral; the prior `Number.isInteger`
    // gate was a vestige of an earlier pre-slider design.
    expect(Weight.of(2.5).value).toBe(2.5);
    expect(Weight.of(7.25).value).toBe(7.25);
  });

  it("rejects zero (\u00a717.31)", () => {
    // §17.31 — zero is below MIN_WEIGHT (0.5). Zero would collapse
    // the tile to zero area which the layout cannot render.
    expect(() => Weight.of(0)).toThrow(InvalidWeightError);
  });

  it("rejects values below MIN_WEIGHT (\u00a717.31)", () => {
    // §17.31 — the new floor is 0.5, not 1. Anything strictly less
    // than 0.5 is rejected.
    expect(() => Weight.of(0.4)).toThrow(InvalidWeightError);
    expect(() => Weight.of(0.499)).toThrow(InvalidWeightError);
  });

  it("rejects negative numbers", () => {
    expect(() => Weight.of(-1)).toThrow(InvalidWeightError);
    expect(() => Weight.of(-0.5)).toThrow(InvalidWeightError);
  });

  it("rejects values above 10", () => {
    expect(() => Weight.of(11)).toThrow(InvalidWeightError);
    expect(() => Weight.of(10.01)).toThrow(InvalidWeightError);
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
