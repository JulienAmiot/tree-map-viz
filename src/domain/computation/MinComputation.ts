import type { Node } from "../nodes/Node.js";

import { Computation } from "./Computation.js";
import { EmptyChildrenError } from "./EmptyChildrenError.js";

/**
 * `MinComputation` — smallest enabled numeric child value (SPEC §17.95 /
 * v5 round 7). Raises {@link EmptyChildrenError} when no child survives
 * the base eligibility filter + the numeric type filter.
 */
export class MinComputation extends Computation<number> {
  private constructor() {
    super();
  }

  static readonly INSTANCE: MinComputation = new MinComputation();

  apply(children: readonly Node[]): number {
    let best: number | undefined;
    for (const c of this.enabledValueNodes(children)) {
      const v = this.tryReadNumber(c);
      if (v === undefined) continue;
      if (best === undefined || v < best) best = v;
    }
    if (best === undefined) throw new EmptyChildrenError("MIN");
    return best;
  }
}
