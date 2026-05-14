import type { Computation } from "./Computation.js";
import { ComputationKind } from "./ComputationKind.js";
import {
  AverageComputation,
  CountComputation,
  MaxComputation,
  MinComputation,
  SumComputation,
  WeightedAverageComputation,
} from "./strategies.js";

/**
 * Static-only kind → strategy resolver (SPEC §17.95 / v5 round 7). Open-closed:
 * new strategy = new enum value + new subclass + one MAP entry.
 */
export class ComputationRegistry {
  private constructor() {}

  private static readonly MAP: ReadonlyMap<ComputationKind, Computation<number>> =
    new Map<ComputationKind, Computation<number>>([
      [ComputationKind.SUM, SumComputation.INSTANCE],
      [ComputationKind.AVERAGE, AverageComputation.INSTANCE],
      [ComputationKind.MIN, MinComputation.INSTANCE],
      [ComputationKind.MAX, MaxComputation.INSTANCE],
      [ComputationKind.WEIGHTED_AVERAGE, WeightedAverageComputation.INSTANCE],
      [ComputationKind.COUNT, CountComputation.INSTANCE],
    ]);

  static resolve(kind: ComputationKind): Computation<number> {
    const s = ComputationRegistry.MAP.get(kind);
    if (s === undefined) throw new Error(`ComputationRegistry: no strategy for ${kind.name}`);
    return s;
  }
}
