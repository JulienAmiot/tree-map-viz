import type { Node } from "../nodes/Node.js";
import { ValueNode } from "../nodes/ValueNode.js";

/**
 * `Computation<T>` — abstract aggregation strategy (SPEC §17.95 / v5 round 7).
 * Concrete strategies filter children to their eligibility criterion then fold
 * to one T-valued aggregate. Two protected helpers:
 *  - `enabledValueNodes` composes (i) `instanceof ValueNode` + (ii) duck-typed
 *    `!isDisabled`. The duck-type is pre-wired for §17.99: when
 *    `ValueNode<T>.disabled: boolean` lands, the predicate just starts firing
 *    on the real field with zero changes here.
 *  - `tryReadNumber` defensively reads `getValue()`: swallows domain throws
 *    (e.g. `EmptyHistoryError`), rejects NaN / ±Infinity, returns `undefined`.
 */
export abstract class Computation<T> {
  abstract apply(children: readonly Node[]): T;

  protected enabledValueNodes(
    children: readonly Node[],
  ): readonly ValueNode<unknown>[] {
    return children.filter(
      (c): c is ValueNode<unknown> =>
        c instanceof ValueNode && !isDisabled(c),
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

function isDisabled(child: Node): boolean {
  return (child as Partial<{ disabled: boolean }>).disabled === true;
}
