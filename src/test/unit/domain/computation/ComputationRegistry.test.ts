import { describe, expect, it } from "vitest";

import { AverageComputation } from "../../../../domain/computation/AverageComputation.js";
import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { ComputationRegistry } from "../../../../domain/computation/ComputationRegistry.js";
import { CountComputation } from "../../../../domain/computation/CountComputation.js";
import { MaxComputation } from "../../../../domain/computation/MaxComputation.js";
import { MinComputation } from "../../../../domain/computation/MinComputation.js";
import { SumComputation } from "../../../../domain/computation/SumComputation.js";
import { WeightedAverageComputation } from "../../../../domain/computation/WeightedAverageComputation.js";

describe("ComputationRegistry (§17.95 — v5 round 7)", () => {
  it("resolves each ComputationKind to the matching strategy singleton", () => {
    expect(ComputationRegistry.resolve(ComputationKind.SUM)).toBe(SumComputation.INSTANCE);
    expect(ComputationRegistry.resolve(ComputationKind.AVERAGE)).toBe(AverageComputation.INSTANCE);
    expect(ComputationRegistry.resolve(ComputationKind.MIN)).toBe(MinComputation.INSTANCE);
    expect(ComputationRegistry.resolve(ComputationKind.MAX)).toBe(MaxComputation.INSTANCE);
    expect(ComputationRegistry.resolve(ComputationKind.WEIGHTED_AVERAGE)).toBe(
      WeightedAverageComputation.INSTANCE,
    );
    expect(ComputationRegistry.resolve(ComputationKind.COUNT)).toBe(CountComputation.INSTANCE);
  });

  it("covers every ComputationKind.ALL inhabitant — closes the open-closed contract", () => {
    for (const kind of ComputationKind.ALL) {
      expect(() => ComputationRegistry.resolve(kind)).not.toThrow();
    }
  });

  it("resolves are referentially stable (singletons, not fresh instances)", () => {
    expect(ComputationRegistry.resolve(ComputationKind.SUM)).toBe(
      ComputationRegistry.resolve(ComputationKind.SUM),
    );
  });
});
