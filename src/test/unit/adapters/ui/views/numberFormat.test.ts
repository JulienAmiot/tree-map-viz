/**
 * SPEC §17.116 — coverage for the uniform tile-value formatter
 * (`formatValue` + the `VALUE_MAX_DECIMALS` boundary). Max 2
 * decimals; trailing zeros stripped; non-finite inputs fall back
 * to the em-dash sentinel.
 */

import { describe, expect, it } from "vitest";

import { formatValue, VALUE_MAX_DECIMALS } from "../../../../../adapters/ui/views/numberFormat.js";

describe("formatValue (\u00a717.116)", () => {
  it("VALUE_MAX_DECIMALS pins the rounding boundary at 2", () => {
    expect(VALUE_MAX_DECIMALS).toBe(2);
  });

  it("renders integers as integers (no .0 trailing zero)", () => {
    expect(formatValue(0)).toBe("0");
    expect(formatValue(1)).toBe("1");
    expect(formatValue(42)).toBe("42");
    expect(formatValue(1234)).toBe("1234");
  });

  it("strips trailing zeros on values that round to integers (42.0 \u2192 \"42\")", () => {
    expect(formatValue(42.0)).toBe("42");
    expect(formatValue(42.00)).toBe("42");
  });

  it("keeps one or two decimals when needed (42.5, 42.55)", () => {
    expect(formatValue(42.5)).toBe("42.5");
    expect(formatValue(42.55)).toBe("42.55");
  });

  it("rounds to two decimals on inputs with more precision (42.556 \u2192 42.56)", () => {
    expect(formatValue(42.556)).toBe("42.56");
    expect(formatValue(42.554)).toBe("42.55");
    expect(formatValue(0.005)).toBe("0.01");
  });

  it("rounds tiny inputs to 0 (0.001 \u2192 \"0\")", () => {
    expect(formatValue(0.001)).toBe("0");
    expect(formatValue(-0.001)).toBe("0");
  });

  it("normalises signed zero (-0 \u2192 \"0\")", () => {
    expect(formatValue(-0)).toBe("0");
  });

  it("handles negative numbers symmetrically", () => {
    expect(formatValue(-42.5)).toBe("-42.5");
    expect(formatValue(-42.556)).toBe("-42.56");
  });

  it("returns the em-dash sentinel for non-finite inputs (defensive)", () => {
    expect(formatValue(Number.NaN)).toBe("\u2014");
    expect(formatValue(Number.POSITIVE_INFINITY)).toBe("\u2014");
    expect(formatValue(Number.NEGATIVE_INFINITY)).toBe("\u2014");
  });
});
