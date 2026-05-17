import type { Node } from "../nodes/Node.js";

/**
 * V4 children-capacity helpers (SPEC §17.90 — Phase B.2 of the
 * §17.80 v3-retirement migration; v4 successor to v3's
 * `domain/capacity/childrenCapacity.ts`).
 *
 * Direct 1:1 port — the capacity rule (max children per parent) is
 * a pure tree-shape concern that v3 and v4 share verbatim. Only the
 * input type changes: v3 `TreeNode<unknown>` → v4 `Node` (the v4
 * abstract base from §17.72; both expose `children: readonly Node[]`
 * via the same `Node "0..1" o-- "0..*" Node : children` composition
 * edge from the v4 class diagram). Constant `MAX_CHILDREN = 12`
 * preserved verbatim — it's a UX limit (no more than 12 tiles fit
 * legibly on the kiosk's grid layout per §4) independent of the
 * v3↔v4 rewrite.
 *
 * Two helpers, both single-expression:
 *
 *   - `canAddChild(node)` — used by application services
 *     (`AddChildService` at Phase C, §17.94+) to gate the
 *     "operator pressed +" path; throws would surface to the UI
 *     too late, so the boolean answer lets the modal disable its
 *     submit button proactively.
 *   - `shouldRenderPlusTile(node)` — used by viewModelMapperV4
 *     (§17.91) to decide whether to append the synthetic "plus"
 *     slot to a focused parent's children list. Today identical
 *     to `canAddChild` (the kiosk shows the plus tile iff the
 *     operator can actually add a child); the two functions are
 *     kept distinct anticipating §17.6+ feature work where the
 *     plus-tile may surface in additional UX states (e.g. visible
 *     but disabled, with an explanatory tooltip).
 */
export const MAX_CHILDREN = 12;

export function canAddChild(node: Node): boolean {
  return node.children.length < MAX_CHILDREN;
}

export function shouldRenderPlusTile(node: Node): boolean {
  return node.children.length < MAX_CHILDREN;
}
