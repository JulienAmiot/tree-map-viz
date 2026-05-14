import { BusinessScoreNode } from "../nodes/BusinessScoreNode.js";
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
  // §17.93 — when v3's `computed=true` flag is set on a v4 BSC
  // (threaded through the §17.81 adapter), short-circuit straight
  // to the children-aggregation branch even if the BSC has its
  // own history. v3 honoured the flag by ignoring own history;
  // v4's structural rule (§17.89) ignored the flag and used own
  // history. The cutover at §17.93 surfaced 5 e2e failures from
  // the `computed=true` placeholder pattern; this gate restores
  // v3 behaviour without abandoning the structural default.
  // StrictRangeNode has no `computed` slot (no v3 namesake) and
  // always falls through to the structural rule.
  const isFlaggedComputed = node instanceof BusinessScoreNode && node.computed;

  if (!isFlaggedComputed && node.children.length === 0) {
    return leafResult(node);
  }
  if (isFlaggedComputed && node.children.length === 0) {
    return { kind: "childrenCount", n: 0 };
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
    if (!(child instanceof RangedValueNode)) continue;
    // §17.99b — replaced the BSN-specific `!child.eligibleForParentComputation`
    // band-aid read with the v5 round-7 D4 `ValueNode<T>.disabled` field
    // (landed at §17.99a). Broader semantics + lives one layer up the
    // hierarchy so StrictRangeNode children honour it too without the
    // §17.93-era instanceof asymmetry. v3 sources flagged
    // `eligibleForParentComputation: false` cross the §17.81 bridge as
    // `disabled: true`, preserving the `mixedComputed` fixture's
    // EmptyLeaf semantics surfaced at the §17.93 cutover.
    if (child.disabled) continue;
    out.push(child as RangedValueNode<unknown>);
  }
  return out;
}

/**
 * Resolve a child's contribution to its parent's weighted mean.
 *
 * **§17.93 — reverts the §17.89 "v4 improvement" claim**. v3's
 * `BusinessScoreCardNode.contribution()` returned the child's
 * OWN most-recent history value (one-level aggregation —
 * grandchildren ignored), regardless of whether the child was
 * itself a `computed=true` aggregator. The §17.89 docblock
 * advertised v4 as a "slight improvement" that recurses through
 * the child's own aggregation; the cutover at §17.93 surfaced
 * that this changes numbers on the typical mixedComputed kiosk
 * shape (Root=mean(ChildA.history=100, ChildB.history=60)=80 in
 * v3 vs Root=mean(ChildA.aggregate=80, ChildB.history=60)=70 in
 * the v4-improved version). Restored to v3's one-level rule:
 * prefer the child's own history when present; only recurse when
 * the child has no history (graceful fallback for the v3 crash
 * case where `currentValue()` would throw `EmptyHistoryError`).
 */
function effectiveNumericValue(child: RangedValueNode<unknown>): number {
  const entries = child.entries();
  if (entries.length > 0) {
    return Number(entries[entries.length - 1].value);
  }
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
