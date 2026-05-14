import { AverageComputation } from "./AverageComputation.js";
import type { Computation } from "./Computation.js";
import { ComputationKind } from "./ComputationKind.js";
import { CountComputation } from "./CountComputation.js";
import { MaxComputation } from "./MaxComputation.js";
import { MinComputation } from "./MinComputation.js";
import { SumComputation } from "./SumComputation.js";
import { WeightedAverageComputation } from "./WeightedAverageComputation.js";

/**
 * `ComputationRegistry` — single static singleton resolving a
 * {@link ComputationKind} to its `Computation<number>` strategy singleton
 * (SPEC §17.95 / v5 round 7; mirrors
 * `<<singleton>> class ComputationRegistry { +resolve(ComputationKind kind)$ Computation~T~ }`
 * in the v5 class diagram).
 *
 * Open-closed for new strategies: adding one is **(a)** a new
 * `ComputationKind` constant, **(b)** a new `Computation<T>` subclass
 * with its `INSTANCE`, and **(c)** one new entry in {@link MAP} below.
 * No existing code path changes.
 *
 * Type-erasure note: §17.95 ships all 6 strategies as `Computation<number>`
 * (every concrete strategy returns a number — SUM / AVERAGE / MIN / MAX
 * / WEIGHTED_AVERAGE on numeric children + COUNT counts and returns the
 * cardinality as a number). The mermaid's `Computation~T~` parametricity
 * is forward-looking; a future strategy returning a non-number T would
 * either widen this registry's value type to `Computation<unknown>` (and
 * type-erase at the call site) or introduce a sibling registry. Deferred
 * until that strategy lands.
 *
 * Static-only — `new ComputationRegistry()` is forbidden via the private
 * constructor.
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
    const strategy = ComputationRegistry.MAP.get(kind);
    if (strategy === undefined) {
      throw new Error(
        `ComputationRegistry: no strategy registered for kind ${kind.name}`,
      );
    }
    return strategy;
  }
}
