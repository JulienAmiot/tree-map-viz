import type { Clock } from "../capabilities/Clock.js";
import type { TreeNode } from "../nodes/TreeNode.js";
import { Tree } from "../Tree.js";
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
  return new Tree(v4NodeFromV3(root3, clock, opts));
}
