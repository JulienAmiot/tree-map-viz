import { describe, expect, it } from "vitest";

import { InvalidUnitError, Unit } from "../../../../domain/values/Unit.js";

describe("Unit", () => {
  it("accepts a non-empty label and exposes its value", () => {
    expect(Unit.of("EUR").value).toBe("EUR");
  });

  it("trims surrounding whitespace", () => {
    expect(Unit.of("  EUR  ").value).toBe("EUR");
  });

  it("rejects an empty string", () => {
    expect(() => Unit.of("")).toThrow(InvalidUnitError);
  });

  it("rejects an all-whitespace string", () => {
    expect(() => Unit.of("   \t\n  ")).toThrow(InvalidUnitError);
  });

  it("Unit.percent() returns a Unit with value '%'", () => {
    expect(Unit.percent().value).toBe("%");
  });

  it("Unit.percent() equals Unit.of('%')", () => {
    expect(Unit.percent().equals(Unit.of("%"))).toBe(true);
  });

  it("compares by value (equal)", () => {
    expect(Unit.of("EUR").equals(Unit.of("EUR"))).toBe(true);
  });

  it("compares by value (different)", () => {
    expect(Unit.of("EUR").equals(Unit.of("USD"))).toBe(false);
  });

  it("compares case-sensitively", () => {
    expect(Unit.of("eur").equals(Unit.of("EUR"))).toBe(false);
  });

  it("toString returns the value", () => {
    expect(String(Unit.of("EUR"))).toBe("EUR");
  });

  it("two Unit.percent() instances are equal", () => {
    expect(Unit.percent().equals(Unit.percent())).toBe(true);
  });
});
