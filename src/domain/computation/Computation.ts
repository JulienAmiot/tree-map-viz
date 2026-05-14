import type { Node } from "../nodes/Node.js";
import { ValueNode } from "../nodes/ValueNode.js";

/**
 * `Computation<T>` — abstract aggregation strategy (SPEC §17.95 / v5
 * round 7; mirrors `<<abstract>> class Computation~T~` with
 * `+apply(readonly Node[] children)* T` in the v5 class diagram).
 *
 * Each concrete strategy filters a parent's children to its eligibility
 * criterion, then folds the filtered set to a single T-valued aggregate.
 * The base provides two shared helpers:
 *
 *  - {@link enabledValueNodes} — composes filters (a) "child is a
 *    `ValueNode<unknown>` instance" and (b) "child is not disabled". The
 *    `disabled` predicate is **duck-typed** for now: §17.99 (the BSCv4
 *    wrapper strand) will add `disabled: boolean` to `ValueNode<T>` and
 *    the existing predicate just starts firing on the real field with
 *    zero code changes here.
 *  - {@link tryReadNumber} — defensive `getValue()` read used by the
 *    numeric strategies; swallows `EmptyHistoryError` (and any other
 *    domain throw) and rejects non-finite numbers, returning `undefined`
 *    so the strategy can simply `for ... of` over the kept values.
 *
 * Per-strategy type filter is applied AFTER (a) + (b): numeric strategies
 * call `tryReadNumber` and skip `undefined`; COUNT keeps every child that
 * passes (a) + (b) regardless of value type (the only T-agnostic strategy
 * per §17.94 D2).
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

/**
 * Duck-typed `disabled` predicate. §17.99 narrows this once
 * `ValueNode<T>.disabled` lands; until then no v4 node has the property,
 * so every value-producing child is considered enabled.
 */
function isDisabled(child: Node): boolean {
  return (child as Partial<{ disabled: boolean }>).disabled === true;
}
