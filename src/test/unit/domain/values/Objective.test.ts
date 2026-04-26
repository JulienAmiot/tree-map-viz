import { describe, expect, it } from "vitest";

import { InvalidObjectiveError, Objective } from "../../../../domain/values/Objective.js";

describe("Objective", () => {
  const targetDate = new Date("2026-12-31T00:00:00Z");
  const sameTargetDate = new Date("2026-12-31T00:00:00Z");
  const otherTargetDate = new Date("2027-12-31T00:00:00Z");

  it("accepts initialValue, targetValue, and a valid targetDate", () => {
    const obj = Objective.of(0, 100, targetDate);
    expect(obj.initialValue).toBe(0);
    expect(obj.targetValue).toBe(100);
    expect(obj.targetDate.getTime()).toBe(targetDate.getTime());
  });

  it("rejects an invalid targetDate", () => {
    expect(() => Objective.of(0, 100, new Date("not-a-date"))).toThrow(InvalidObjectiveError);
  });

  it("rejects a targetDate built from NaN", () => {
    expect(() => Objective.of(0, 100, new Date(Number.NaN))).toThrow(InvalidObjectiveError);
  });

  it("defends against caller mutating the input targetDate", () => {
    const input = new Date(targetDate.getTime());
    const obj = Objective.of(0, 100, input);
    input.setFullYear(1999);
    expect(obj.targetDate.getTime()).toBe(targetDate.getTime());
  });

  it("defends against caller mutating the exposed targetDate", () => {
    const obj = Objective.of(0, 100, targetDate);
    obj.targetDate.setFullYear(1999);
    expect(obj.targetDate.getTime()).toBe(targetDate.getTime());
  });

  it("two objectives with identical components are equal", () => {
    const a = Objective.of(0, 100, targetDate);
    const b = Objective.of(0, 100, sameTargetDate);
    expect(a.equals(b)).toBe(true);
  });

  it("two objectives with different initialValue are not equal", () => {
    const a = Objective.of(0, 100, targetDate);
    const b = Objective.of(1, 100, targetDate);
    expect(a.equals(b)).toBe(false);
  });

  it("two objectives with different targetValue are not equal", () => {
    const a = Objective.of(0, 100, targetDate);
    const b = Objective.of(0, 200, targetDate);
    expect(a.equals(b)).toBe(false);
  });

  it("two objectives with different targetDate are not equal", () => {
    const a = Objective.of(0, 100, targetDate);
    const b = Objective.of(0, 100, otherTargetDate);
    expect(a.equals(b)).toBe(false);
  });

  it("equality is reflexive on a single instance", () => {
    const obj = Objective.of(0, 100, targetDate);
    expect(obj.equals(obj)).toBe(true);
  });

  it("works with non-numeric T (e.g. string)", () => {
    const a = Objective.of<string>("low", "high", targetDate);
    expect(a.initialValue).toBe("low");
    expect(a.targetValue).toBe("high");
  });
});
