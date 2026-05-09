/**
 * `currentValueDateIso(node)` — the ISO-8601 date that the UI should
 * display next to a node's "current value". Per SPEC §17.18:
 *
 *   - **Recorded** node (TextNode, or BSC with `computed=false`): the
 *     latest `TimestampedValue` in its history (so the date answers
 *     "when was this measurement taken?").
 *   - **Computed** BSC (`computed=true`): the **most recent** date
 *     among its direct children's current-value dates. Recurses
 *     naturally — a computed grandchild contributes its own
 *     most-recent-children date, so the answer for a computed
 *     ancestor is "the most recent observation anywhere underneath
 *     this aggregate".
 *
 * Returns `null` when no date can be derived (empty history, no
 * children, or all-empty children).
 *
 * The function lives in `domain/aggregation/` because it's a pure
 * domain query (mirrors `computedValue.ts` — same shape: walks the
 * `BusinessScoreCardNode.computed` flag + the node's children). It is
 * the single source of truth for "what date applies to this node's
 * displayed value"; the view-model mapper consumes it for both kinds.
 */

import { BusinessScoreCardNode } from "../nodes/BusinessScoreCardNode.js";
import { TextNode } from "../nodes/TextNode.js";
import type { TreeNode } from "../nodes/TreeNode.js";

export function currentValueDateIso(node: TreeNode<unknown>): string | null {
  if (node instanceof TextNode) {
    const latest = node.card.history().at(-1);
    return latest?.asOf.moment.toISOString() ?? null;
  }
  if (node instanceof BusinessScoreCardNode) {
    if (!node.computed) {
      const latest = node.card.history().at(-1);
      return latest?.asOf.moment.toISOString() ?? null;
    }
    return mostRecentChildDateIso(node);
  }
  return null;
}

/**
 * Recursively walks the children, finding the most recent
 * `currentValueDateIso` among them. Used directly by `currentValueDateIso`
 * for computed BSCs; exported separately so the view layer can also use
 * it when rendering "this aggregate is current as of …".
 */
export function mostRecentChildDateIso(node: TreeNode<unknown>): string | null {
  let maxMs = Number.NEGATIVE_INFINITY;
  for (const child of node.children) {
    const childIso = currentValueDateIso(child);
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
