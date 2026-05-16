import type { Clock } from "../capabilities/Clock.js";
import { BusinessScoreCardV4 } from "../cards/BusinessScoreCardV4.js";
import { BusinessScoreCardNode } from "../nodes/BusinessScoreCardNode.js";
import { BusinessScoreNode } from "../nodes/BusinessScoreNode.js";
import type { Node } from "../nodes/Node.js";
import type { TreeNode } from "../nodes/TreeNode.js";
import { Tree } from "../Tree.js";
import { Unit } from "../values/Unit.js";

import { v4NodeFromV3, type V3ToV4Options } from "./v4NodeFromV3.js";

/**
 * Wrap a v3 root in a v4 `Tree` (SPEC §17.88 — Phase A.2 of the
 * §17.80 v3-retirement migration plan; closes Phase A by composing
 * §17.81's per-node adapter with the §17.79 `Tree` container).
 *
 * The §17.80 plan slotted Phase A.2 at §17.82, but §17.82-§17.87
 * were claimed by the parallel §17.82 app-versioning + Pages-
 * deployment track (§17.83 Pages workflow, §17.84 about-modal,
 * §17.85 schema snapshot guard, §17.86 runtime version-mismatch,
 * §17.87 release notes); the v3-retirement migration resumes here
 * at the first free slot.
 *
 * Trivial composition by design: the recursive walk + the
 * v3-flag-to-v4-shape translation already live in `v4NodeFromV3`,
 * and `Tree`'s only construction surface is `new Tree(root)`. Phase
 * A.2 is the **last** sub-strand of the read-side adapter foundation
 * — every Phase B consumer (viewModelMapperV4, computedValueV4,
 * TreeNavigationServiceV4, …) will call `v4TreeFromV3Root(root3,
 * clock, opts?)` once at composition time and pass the resulting
 * `Tree` around as the v4 read surface.
 *
 * The `opts.overrides` map flows through unchanged (§17.81's
 * per-id strict-range escape hatch); the `clock` is the same
 * domain `Clock` capability the v4 nodes capture for their history
 * timestamps.
 *
 * Errors from `v4NodeFromV3` (notably `UnknownV3NodeKindError` for
 * an unrecognised v3 `TreeNode` subclass) bubble up unchanged —
 * they identify the offending node by its v3 `id`, which the
 * caller can correlate with the storage payload.
 */
export function v4TreeFromV3Root(
  root3: TreeNode<unknown>,
  clock: Clock,
  opts: V3ToV4Options = {},
): Tree {
  const v4Root = v4NodeFromV3(root3, clock, opts);
  const cards = buildCardsFromV3(root3, v4Root);
  return new Tree(v4Root, cards);
}

/**
 * §17.100.5 — walks the v3 tree alongside the produced v4 tree and
 * builds a `BusinessScoreCardV4` for every v3 BSC with a non-empty
 * `unit`. The pair walks in lockstep (same pre-order shape because
 * `v4NodeFromV3` preserves child order). Empty-unit BSCs are skipped
 * — the §17.91 legacy `BusinessScoreNode.unit` getter ("") covers
 * them and the mapper's fallback resolves to the same empty string.
 * The `BusinessScoreCardV4<unknown>` typing keeps the registry
 * generic-erased at the Tree boundary while individual entries
 * preserve their `T = number` narrowing via the §17.78 covariant
 * `getNode()` return.
 */
function buildCardsFromV3(
  root3: TreeNode<unknown>,
  v4Root: Node,
): Map<string, BusinessScoreCardV4<unknown>> {
  const cards = new Map<string, BusinessScoreCardV4<unknown>>();
  collectCards(root3, v4Root, cards);
  return cards;
}

function collectCards(
  n3: TreeNode<unknown>,
  n4: Node,
  out: Map<string, BusinessScoreCardV4<unknown>>,
): void {
  if (n3 instanceof BusinessScoreCardNode && n4 instanceof BusinessScoreNode) {
    const rawUnit = n3.card.unit.value;
    if (rawUnit.length > 0) {
      out.set(n4.id, new BusinessScoreCardV4(n4, Unit.of(rawUnit)));
    }
  }
  const len = Math.min(n3.children.length, n4.children.length);
  for (let i = 0; i < len; i++) {
    collectCards(n3.children[i], n4.children[i], out);
  }
}
