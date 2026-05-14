import type { Clock } from "../capabilities/Clock.js";
import { BusinessScoreCardNode } from "../nodes/BusinessScoreCardNode.js";
import { BusinessScoreNode } from "../nodes/BusinessScoreNode.js";
import type { Node } from "../nodes/Node.js";
import { StrictRangeNode } from "../nodes/StrictRangeNode.js";
import { TextNode } from "../nodes/TextNode.js";
import { TextNodeV4 } from "../nodes/TextNodeV4.js";
import type { TreeNode } from "../nodes/TreeNode.js";
import { NumericComparator } from "../values/Comparator.js";
import { ObjectiveV4 } from "../values/ObjectiveV4.js";
import { LenientRange, StrictRange } from "../values/Range.js";

/**
 * Per-id strictness override. Default behaviour: v3 BSC →
 * `BusinessScoreNode<number>` lenient unbounded (preserves v3's
 * no-range-enforcement semantics; see §17.80 Risk row 1). Set
 * `strictRange: true` to force `StrictRangeNode<number>` with the
 * given `min` / `max` (defaults to `±Infinity` if omitted).
 */
export interface NodeOverride {
  strictRange: boolean;
  min?: number;
  max?: number;
}

export interface V3ToV4Options {
  overrides?: ReadonlyMap<string, NodeOverride>;
}

export class UnknownV3NodeKindError extends Error {
  constructor(node3: TreeNode<unknown>) {
    super(
      `Cannot adapt v3 node "${node3.id}" of kind "${node3.constructor.name}" to v4 — unknown TreeNode subclass`,
    );
    this.name = "UnknownV3NodeKindError";
  }
}

/**
 * Recursive adapter from v3 `TreeNode<unknown>` to v4 `Node` (SPEC
 * §17.81 — Phase A.1 of the §17.80 migration plan; the throwaway
 * "middle-out" shim from D3 / Option B). Conversions:
 *
 *   - v3 TextNode → v4 TextNodeV4. Title from `identity.title.value`;
 *     description dropped (TextNodeV4 hardcodes `""` per §17.15).
 *     History copied verbatim via `addValue(asOf, value)`.
 *   - v3 BusinessScoreCardNode<number> → v4 BusinessScoreNode<number>
 *     (default lenient unbounded) or StrictRangeNode<number> (via
 *     override). v3 Objective<T> 3-tuple → v4 ObjectiveV4<T> 2-tuple
 *     (initialValue dropped; targetValue → value; targetDate → at).
 *     Description preserved via `identity.description.value`. The
 *     v3 `eligibleForParentComputation` / `computed` flags drop —
 *     v4 doesn't model contributions on the Node directly.
 *
 * Children walked recursively; order preserved through `attach`.
 *
 * Numeric assumption: production BSCs are always `T = number`. The
 * adapter casts and relies on runtime; non-numeric BSCs would fail
 * at `NumericComparator.compare` time, which is preferable to
 * bloating the adapter for an unused generic.
 */
export function v4NodeFromV3(
  node3: TreeNode<unknown>,
  clock: Clock,
  opts: V3ToV4Options = {},
): Node {
  const v4Root = adaptOneNode(node3, clock, opts);
  for (const child3 of node3.children) {
    v4Root.attach(v4NodeFromV3(child3, clock, opts));
  }
  return v4Root;
}

function adaptOneNode(
  node3: TreeNode<unknown>,
  clock: Clock,
  opts: V3ToV4Options,
): Node {
  if (node3 instanceof TextNode) {
    return adaptTextNode(node3, clock);
  }
  if (node3 instanceof BusinessScoreCardNode) {
    return adaptBusinessScoreCardNode(
      node3 as BusinessScoreCardNode<number>,
      clock,
      opts,
    );
  }
  throw new UnknownV3NodeKindError(node3);
}

function adaptTextNode(node3: TextNode, clock: Clock): TextNodeV4 {
  const v4Node = new TextNodeV4(
    node3.id,
    node3.identity.title.value,
    node3.weight,
    clock,
  );
  for (const entry of node3.history()) {
    v4Node.addValue(entry.asOf, entry.value);
  }
  return v4Node;
}

function adaptBusinessScoreCardNode(
  node3: BusinessScoreCardNode<number>,
  clock: Clock,
  opts: V3ToV4Options,
): BusinessScoreNode<number> | StrictRangeNode<number> {
  const { id, weight } = node3;
  const title = node3.identity.title.value;
  const description = node3.identity.description.value;
  const override = opts.overrides?.get(id);
  let v4Node: BusinessScoreNode<number> | StrictRangeNode<number>;

  if (override?.strictRange === true) {
    const min = override.min ?? Number.NEGATIVE_INFINITY;
    const max = override.max ?? Number.POSITIVE_INFINITY;
    const range = StrictRange.of(min, max, NumericComparator.INSTANCE);
    v4Node = new StrictRangeNode<number>(id, title, weight, description, clock, range);
  } else {
    const range = LenientRange.of(
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      NumericComparator.INSTANCE,
    );
    const v3Obj = node3.objective();
    const objective = ObjectiveV4.of(v3Obj.targetValue, v3Obj.targetDate);
    // §17.91 — thread v3's display unit onto the v4 BSC's optional
    // `unit` slot (partial resolution of §17.80 D1; full resolution
    // moves to BSCv4 wrapper at Phase C).
    const unit = node3.card.unit.value;
    // §17.93 — also thread v3's `computed` flag (partial reversal of
    // the §17.89 structural-rule design call; surfaced by 5 e2e
    // failures during the read-cutover when v4 lost v3's
    // "placeholder + computed=true" pattern).
    const computed = node3.computed;
    // §17.93 — also thread v3's `eligibleForParentComputation` flag
    // (sister of `computed`; the `mixedComputed` fixture's EmptyLeaf
    // depends on it being honoured to be excluded from Root's mean).
    const eligibleForParentComputation = node3.eligibleForParentComputation;
    v4Node = new BusinessScoreNode<number>(id, title, weight, description, clock, range, {
      objective,
      unit,
      computed,
      eligibleForParentComputation,
    });
  }
  for (const entry of node3.history()) {
    v4Node.addValue(entry.asOf, entry.value);
  }
  return v4Node;
}
