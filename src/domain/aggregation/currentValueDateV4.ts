import { HistorizableValueNode } from "../nodes/HistorizableValueNode.js";
import type { Node } from "../nodes/Node.js";
import { RangedValueNode } from "../nodes/RangedValueNode.js";

/**
 * `currentValueDateIsoV4(node)` — the ISO-8601 date the UI should
 * display next to a v4 node's "current value" (SPEC §17.89 — Phase
 * B.1 sibling of `computedValueV4`; v4 successor to v3's
 * `currentValueDateIso` from `domain/aggregation/currentValueDate.ts`).
 *
 * **V4 design call mirrors `computedValueV4` (structural rule, not
 * flag-based)**:
 *
 *   - **Leaf node with history** (`HistorizableValueNode` with
 *     non-empty `entries()` and no children): the latest entry's
 *     `asOf.moment.toISOString()` — answers "when was this
 *     measurement taken?".
 *   - **Parent BSC** (`RangedValueNode` with children): the **most
 *     recent** ISO date amongst its direct children's
 *     `currentValueDateIsoV4` results. Recurses naturally — a
 *     deep aggregator's date answers "the most recent observation
 *     anywhere underneath this aggregate" without an explicit
 *     traversal helper. TextNodeV4 children participate (their
 *     latest history entry contributes a candidate date) even
 *     though they don't contribute to the numeric aggregate.
 *   - **Empty leaf or all-empty subtree**: returns `null`.
 *
 * Distinguishing leaf-vs-parent by `node.children.length === 0`
 * (rather than a flag) matches the §17.89 `computedValueV4` rule
 * — a TextNodeV4 with no children always uses its history; a
 * BSC with children always recurses; a BSC with no children uses
 * its own history. Same structural rule, two helpers.
 *
 * Returns `null` when no date can be derived.
 */
export function currentValueDateIsoV4(node: Node): string | null {
  if (node.children.length === 0) {
    return ownLatestIso(node);
  }
  if (node instanceof RangedValueNode) {
    return mostRecentChildDateIsoV4(node);
  }
  return ownLatestIso(node);
}

function ownLatestIso(node: Node): string | null {
  if (!(node instanceof HistorizableValueNode)) {
    return null;
  }
  const entries = node.entries();
  const latest = entries.at(-1);
  return latest?.asOf.moment.toISOString() ?? null;
}

/**
 * Recursively walks the children, finding the most recent
 * `currentValueDateIsoV4` among them. Used by `currentValueDateIsoV4`
 * for parent BSCs; exported separately so the view layer can also
 * use it when rendering "this aggregate is current as of …" without
 * re-deriving the leaf-vs-parent dispatch.
 */
export function mostRecentChildDateIsoV4(node: Node): string | null {
  let maxMs = Number.NEGATIVE_INFINITY;
  for (const child of node.children) {
    const childIso = currentValueDateIsoV4(child);
    if (childIso === null) continue;
    const ms = Date.parse(childIso);
    if (Number.isNaN(ms)) continue;
    if (ms > maxMs) {
      maxMs = ms;
    }
  }
  if (maxMs === Number.NEGATIVE_INFINITY) {
    return null;
  }
  return new Date(maxMs).toISOString();
}
