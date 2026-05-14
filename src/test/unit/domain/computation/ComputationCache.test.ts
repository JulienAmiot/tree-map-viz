import { describe, expect, it } from "vitest";

import { ComputationCache } from "../../../../domain/computation/ComputationCache.js";
import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { ComputationRegistry } from "../../../../domain/computation/ComputationRegistry.js";
import { AverageComputation, SumComputation } from "../../../../domain/computation/strategies.js";

describe("ComputationCache<T> — cached (kind, strategy) pair (§17.98)", () => {
  it("resolves the initial kind via the registry on construction", () => {
    const cache = new ComputationCache<number>(ComputationKind.SUM);
    expect(cache.kind).toBe(ComputationKind.SUM);
    expect(cache.strategy).toBe(SumComputation.INSTANCE);
  });

  it("set(kind) updates both kind AND strategy in one mutation (§17.94 risk row 6)", () => {
    const cache = new ComputationCache<number>(ComputationKind.SUM);
    cache.set(ComputationKind.AVERAGE);
    expect(cache.kind).toBe(ComputationKind.AVERAGE);
    expect(cache.strategy).toBe(AverageComputation.INSTANCE);
  });

  it("strategy reference matches ComputationRegistry.resolve for every kind", () => {
    for (const kind of ComputationKind.ALL) {
      const cache = new ComputationCache<number>(kind);
      expect(cache.strategy).toBe(ComputationRegistry.resolve(kind));
    }
  });
});
