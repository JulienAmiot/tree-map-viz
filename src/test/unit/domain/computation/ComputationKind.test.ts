import { describe, expect, it } from "vitest";

import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";

describe("ComputationKind (§17.95 — v5 round 7)", () => {
  it("exposes the six v5 inhabitants with stable names", () => {
    expect(ComputationKind.SUM.name).toBe("SUM");
    expect(ComputationKind.AVERAGE.name).toBe("AVERAGE");
    expect(ComputationKind.MIN.name).toBe("MIN");
    expect(ComputationKind.MAX.name).toBe("MAX");
    expect(ComputationKind.WEIGHTED_AVERAGE.name).toBe("WEIGHTED_AVERAGE");
    expect(ComputationKind.COUNT.name).toBe("COUNT");
  });

  it("treats each inhabitant as a singleton (reference equality IS value equality)", () => {
    expect(ComputationKind.SUM).toBe(ComputationKind.SUM);
    expect(ComputationKind.SUM).not.toBe(ComputationKind.AVERAGE);
  });

  it("ALL is a frozen list of every inhabitant, in declaration order", () => {
    expect(Object.isFrozen(ComputationKind.ALL)).toBe(true);
    expect(ComputationKind.ALL).toEqual([
      ComputationKind.SUM,
      ComputationKind.AVERAGE,
      ComputationKind.MIN,
      ComputationKind.MAX,
      ComputationKind.WEIGHTED_AVERAGE,
      ComputationKind.COUNT,
    ]);
  });

  it("fromName round-trips every inhabitant", () => {
    for (const k of ComputationKind.ALL) {
      expect(ComputationKind.fromName(k.name)).toBe(k);
    }
  });

  it("fromName returns undefined for unknown / malformed input (caller chooses recovery)", () => {
    expect(ComputationKind.fromName("MEDIAN")).toBeUndefined();
    expect(ComputationKind.fromName("")).toBeUndefined();
    expect(ComputationKind.fromName("sum")).toBeUndefined();
  });
});
