import type { Node } from "../nodes/Node.js";

import { Computation } from "./Computation.js";
import { EmptyChildrenError } from "./EmptyChildrenError.js";

/**
 * `AverageComputation` — arithmetic mean over the enabled numeric-valued
 * children (SPEC §17.95 / v5 round 7). v3's only implemented aggregation
 * rule, recast here as one of the 6 polymorphic strategies. Raises
 * {@link EmptyChildrenError} when no child survives the base eligibility
 * filter + the numeric type filter.
 */
export class AverageComputation extends Computation<number> {
  private constructor() {
    super();
  }

  static readonly INSTANCE: AverageComputation = new AverageComputation();

  apply(children: readonly Node[]): number {
    let total = 0;
    let count = 0;
    for (const c of this.enabledValueNodes(children)) {
      const v = this.tryReadNumber(c);
      if (v === undefined) continue;
      total += v;
      count += 1;
    }
    if (count === 0) throw new EmptyChildrenError("AVERAGE");
    return total / count;
  }
}
