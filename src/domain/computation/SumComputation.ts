import type { Node } from "../nodes/Node.js";

import { Computation } from "./Computation.js";
import { EmptyChildrenError } from "./EmptyChildrenError.js";

/**
 * `SumComputation` — Σ over the enabled numeric-valued children
 * (SPEC §17.95 / v5 round 7). Raises {@link EmptyChildrenError} when no
 * child survives the base eligibility filter + the numeric type filter.
 *
 * Singleton — reference equality (`===`) IS instance equality (same
 * private-ctor + `static readonly INSTANCE` shape as the v4 `Direction`
 * / `Comparator<T>` singletons).
 */
export class SumComputation extends Computation<number> {
  private constructor() {
    super();
  }

  static readonly INSTANCE: SumComputation = new SumComputation();

  apply(children: readonly Node[]): number {
    let total = 0;
    let count = 0;
    for (const c of this.enabledValueNodes(children)) {
      const v = this.tryReadNumber(c);
      if (v === undefined) continue;
      total += v;
      count += 1;
    }
    if (count === 0) throw new EmptyChildrenError("SUM");
    return total;
  }
}
