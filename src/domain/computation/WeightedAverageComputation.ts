import type { Node } from "../nodes/Node.js";

import { Computation } from "./Computation.js";
import { EmptyChildrenError } from "./EmptyChildrenError.js";

/**
 * `WeightedAverageComputation` — Σ(v·w) / Σ(w) over the enabled numeric
 * children, weighted by each child's `Node.weight.value` (SPEC §17.95 /
 * v5 round 7; §17.94 open-question #3 default — uses the existing
 * `Node.weight` field, no new per-strategy weight extractor introduced).
 *
 * This earns `Node.weight` its first behavioural use — pre-§17.95 it
 * only fed the squarified-treemap tile sizing (UI concern). The
 * weighted-average strategy gives the same field a domain-level meaning
 * in aggregation: a tile that's twice as visually prominent also pulls
 * the parent's score twice as hard.
 *
 * Raises {@link EmptyChildrenError} on two distinct paths:
 *  - No child survives the eligibility + numeric filters.
 *  - Eligible children exist but Σ(w) === 0 (impossible under v4's
 *    `Weight.of` validator which floors at 0.5, but the strategy
 *    defends in depth — §17.94 risk register row 4).
 */
export class WeightedAverageComputation extends Computation<number> {
  private constructor() {
    super();
  }

  static readonly INSTANCE: WeightedAverageComputation =
    new WeightedAverageComputation();

  apply(children: readonly Node[]): number {
    let sumWeightedValue = 0;
    let sumWeight = 0;
    let count = 0;
    for (const c of this.enabledValueNodes(children)) {
      const v = this.tryReadNumber(c);
      if (v === undefined) continue;
      const w = c.weight.value;
      sumWeightedValue += v * w;
      sumWeight += w;
      count += 1;
    }
    if (count === 0 || sumWeight === 0) {
      throw new EmptyChildrenError("WEIGHTED_AVERAGE");
    }
    return sumWeightedValue / sumWeight;
  }
}
