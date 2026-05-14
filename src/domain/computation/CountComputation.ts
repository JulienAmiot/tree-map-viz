import type { Node } from "../nodes/Node.js";

import { Computation } from "./Computation.js";

/**
 * `CountComputation` — number of enabled `ValueNode<unknown>` children
 * regardless of value type (SPEC §17.95 / v5 round 7). The only
 * T-agnostic strategy: numeric strategies require `getValue()` to
 * produce a finite number, COUNT keeps every value-producing child that
 * passes the base eligibility filter (so a TextNode child IS counted —
 * §17.94 D2 design intent).
 *
 * §17.94 risk register decision #2 — COUNT returns `0` on the empty set
 * rather than raising {@link EmptyChildrenError}. Counting is well-defined
 * on the empty set; raising would be inconsistent with COUNT's
 * "any T" relaxation, and the operator's likely intent for an empty COUNT
 * parent is "show 0", not "show error".
 */
export class CountComputation extends Computation<number> {
  private constructor() {
    super();
  }

  static readonly INSTANCE: CountComputation = new CountComputation();

  apply(children: readonly Node[]): number {
    return this.enabledValueNodes(children).length;
  }
}
