import type { Node } from "../nodes/Node.js";
import { ValueNode } from "../nodes/ValueNode.js";

/**
 * `Computation<T>` — abstract aggregation strategy (SPEC §17.95 / v5 round 7).
 * Concrete strategies filter children via `enabledValueNodes` (composes
 * `instanceof ValueNode` + the real `ValueNode<T>.disabled` field landed at
 * §17.99a — was a duck-typed predicate pre-§17.99a, kept the same call shape
 * so this filter site needs no change beyond the helper's body) then fold.
 * Numeric strategies use `tryReadNumber` to read `getValue()` defensively
 * (swallows domain throws, rejects NaN / ±Infinity).
 */
export abstract class Computation<T> {
  abstract apply(children: readonly Node[]): T;

  protected enabledValueNodes(
    children: readonly Node[],
  ): readonly ValueNode<unknown>[] {
    return children.filter(
      (c): c is ValueNode<unknown> => c instanceof ValueNode && !c.disabled,
    );
  }

  protected tryReadNumber(child: ValueNode<unknown>): number | undefined {
    try {
      const v = child.getValue();
      return typeof v === "number" && Number.isFinite(v) ? v : undefined;
    } catch {
      return undefined;
    }
  }
}
