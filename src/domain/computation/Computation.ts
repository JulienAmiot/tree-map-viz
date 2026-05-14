import type { Node } from "../nodes/Node.js";
import { ValueNode } from "../nodes/ValueNode.js";

/**
 * `Computation<T>` — abstract aggregation strategy (SPEC §17.95 / v5 round 7).
 * Concrete strategies filter children via `enabledValueNodes` (composes
 * `instanceof ValueNode` + duck-typed `!isDisabled` — the duck-type is
 * pre-wired for §17.99, no changes here when `ValueNode.disabled` lands) then
 * fold. Numeric strategies use `tryReadNumber` to read `getValue()` defensively
 * (swallows domain throws, rejects NaN / ±Infinity).
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
