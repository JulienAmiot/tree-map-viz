import type { Node } from "../nodes/Node.js";
import { RangedValueNode } from "../nodes/RangedValueNode.js";
import type { Timestamp } from "../values/Timestamp.js";

/**
 * V4 result shape mirrors v3's `ComputedValueResult` 1:1 so the v4
 * view-model mapper (§17.91) can produce the same VM types as v3
 * (§17.80 D5 — same VM contract, different domain side). Only the
 * `recordedValue` payload changes shape: v3 carried a
 * `TimestampedValue<T>` (because v3 BSCs returned that from
 * `currentValue()`); v4's `getValue()` returns `T` and the timestamp
 * is fetched separately via `entries().at(-1).asOf` — same data, two
 * fields instead of one wrapped object. Mapper-side adjustment is
 * trivial (`.value` → direct, `.asOf.moment` → `asOf.moment`).
 */
export type ComputedValueResultV4<T = unknown> =
  | { kind: "recordedValue"; value: T; asOf: Timestamp }
  | { kind: "computedValue"; value: number }
  | { kind: "childrenCount"; n: number };

/**
 * V4-aware aggregation of a `RangedValueNode<T>`'s effective value
 * (SPEC §17.89 — Phase B.1 of the §17.80 v3-retirement migration,
 * promoted ahead of `viewModelMapperV4` since the mapper consumes
 * this helper).
 *
 * **V4 design call: structural rule, not flag-based.** v3 read two
 * boolean flags off `BusinessScoreCardNode` to decide aggregation
 * mode — `computed` (this BSC's value is the children's aggregate)
 * and `eligibleForParentComputation` (this BSC contributes to its
 * parent's aggregate). v4 dropped both per the §17.81 adapter
 * docblock ("the v3 `eligibleForParentComputation` / `computed`
 * flags drop — v4 doesn't model contributions on the Node directly").
 * §17.89 fills the gap with a structural rule equivalent to v3's
 * default behaviour on the typical kiosk data shape:
 *
 *   - **Leaf BSC** (no children): use own history. Returns
 *     `recordedValue` with the most-recent `getValue()` + its
 *     `asOf` Timestamp. If history is empty, returns
 *     `childrenCount` with `n = 0`.
 *   - **Parent BSC** (has children): aggregate from eligible
 *     children. A child is **eligible** iff (a) it is a
 *     `RangedValueNode` (TextNodeV4 children never contribute —
 *     text doesn't aggregate), AND (b) recursive
 *     `computedValueV4(child)` produces a finite number (either
 *     `recordedValue` with numeric `value`, or nested
 *     `computedValue`). Weight uses `child.weight.value`.
 *   - **Parent with no eligible children**: returns
 *     `childrenCount` with `n = total children` (mirrors v3's
 *     same fallback for parent BSCs whose children all lack
 *     contributions).
 *
 * **Recursion depth**: v3's `computedValue` was one-level —
 * children's `contribution()` returned each child's OWN recorded
 * value, ignoring grandchildren. v4 recurses through
 * `computedValueV4(child)`, so a grandchild aggregator's computed
 * mean propagates upward. This is a **slight v4 improvement** over
 * v3 (handles the empty-history-with-children edge case
 * gracefully) — for the typical kiosk data shape (aggregators only
 * at subtree roots, leaves carry the recorded values) the produced
 * numbers are identical to v3.
 *
 * **Numeric coercion**: T is generic but the kiosk's BSCs are
 * always `T = number`; the function's return type pins `value: T`
 * for `recordedValue` and `value: number` for `computedValue`. The
 * recursion coerces via `Number(...)` and skips non-finite
 * children to keep weighted-mean math safe.
 */
export function computedValueV4<T>(
  node: RangedValueNode<T>,
): ComputedValueResultV4<T> {
  if (node.children.length === 0) {
    return leafResult(node);
  }

  const eligible = collectEligibleChildren(node.children);
  if (eligible.length === 0) {
    return { kind: "childrenCount", n: node.children.length };
  }

  let weightedSum = 0;
  let weightSum = 0;
  for (const child of eligible) {
    const childNumber = effectiveNumericValue(child);
    if (Number.isFinite(childNumber)) {
      weightedSum += childNumber * child.weight.value;
      weightSum += child.weight.value;
    }
  }

  if (weightSum === 0) {
    return { kind: "childrenCount", n: node.children.length };
  }
  return { kind: "computedValue", value: weightedSum / weightSum };
}

function leafResult<T>(node: RangedValueNode<T>): ComputedValueResultV4<T> {
  const entries = node.entries();
  if (entries.length === 0) {
    return { kind: "childrenCount", n: 0 };
  }
  const latest = entries[entries.length - 1];
  return { kind: "recordedValue", value: latest.value, asOf: latest.asOf };
}

function collectEligibleChildren(
  children: readonly Node[],
): RangedValueNode<unknown>[] {
  const out: RangedValueNode<unknown>[] = [];
  for (const child of children) {
    if (child instanceof RangedValueNode) {
      out.push(child as RangedValueNode<unknown>);
    }
  }
  return out;
}

/**
 * Resolve a child's contribution to its parent's weighted mean.
 * Recurses through `computedValueV4` so a child aggregator's mean
 * propagates upward (the v3-vs-v4 semantic improvement noted in
 * the main JSDoc). Returns `NaN` if the child has no usable value
 * (empty leaf, all-empty subtree, non-numeric value type) — the
 * caller filters via `Number.isFinite`.
 */
function effectiveNumericValue(child: RangedValueNode<unknown>): number {
  const result = computedValueV4(child);
  switch (result.kind) {
    case "recordedValue":
      return Number(result.value);
    case "computedValue":
      return result.value;
    case "childrenCount":
      return NaN;
  }
}
