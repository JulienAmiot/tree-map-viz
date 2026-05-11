import { Tree } from "../domain/Tree.js";

import type {
  FocusedTreeViewV4,
  TreeNavigationPortV4,
} from "./ports/TreeNavigationPortV4.js";

/**
 * V4 application service: orchestrates focus changes using v4
 * `Tree` queries (SPEC §17.92 — Phase B.4 of the §17.80
 * v3-retirement migration; v4 successor to v3's
 * `TreeNavigationService`).
 *
 * **Two structural deltas vs v3**:
 *
 *   - **Constructor takes a v4 `Tree`** (the §17.79 container)
 *     instead of a raw v3 root. The Tree holds the canonical v4
 *     traversal surface (`findById` / `nodes()`); v3 had to lean
 *     on free functions in `treeQueries.ts` because no Tree class
 *     existed.
 *   - **Parent walk via `Node.parent` getter** (the §17.72 base
 *     class field) instead of v3's `findParentOf(root, id)` free
 *     function which scanned recursively. v4 nodes carry their
 *     parent reference explicitly via the `_parent` slot
 *     maintained by `attach` / `detach`, so parent lookup is O(1)
 *     vs v3's O(N) recursive scan. Identical observable behaviour;
 *     pure performance improvement.
 *
 * **Same API surface** — every method has the same signature and
 * the same `{ ok: true } | { ok: false; reason: string }` result
 * shape as v3, so the §17.93 main.ts cutover is a one-line
 * constructor swap.
 *
 * **`replaceTree` semantics preserved verbatim** per SPEC §17.31:
 * re-seat the navigation service over a different tree (used by
 * the composition root when the current board changes). Focus
 * snaps to the supplied id (or the new root when omitted) because
 * the prior `focusedId` almost certainly does not exist in the
 * new tree.
 */
export class TreeNavigationServiceV4 implements TreeNavigationPortV4 {
  private tree: Tree;
  private focusedId: string;

  constructor(tree: Tree, initialFocusedId?: string) {
    this.tree = tree;
    this.focusedId = initialFocusedId ?? tree.root.id;
  }

  getRoot(): Tree {
    return this.tree;
  }

  getFocusedId(): string {
    return this.focusedId;
  }

  getFocusedView(): FocusedTreeViewV4 | null {
    const center = this.tree.findById(this.focusedId);
    if (!center) {
      return null;
    }
    return {
      center,
      childrenNodes: [...center.children],
    };
  }

  focusChild(childId: string): { ok: true } | { ok: false; reason: string } {
    const center = this.tree.findById(this.focusedId);
    if (!center) {
      return { ok: false, reason: "Current focus not found in tree." };
    }
    const isDirectChild = center.children.some((c) => c.id === childId);
    if (!isDirectChild) {
      return { ok: false, reason: "Node is not a direct child of the focused node." };
    }
    this.focusedId = childId;
    return { ok: true };
  }

  focusParent(): { ok: true } | { ok: false; reason: string } {
    if (this.focusedId === this.tree.root.id) {
      return { ok: false, reason: "Already at root." };
    }
    const focused = this.tree.findById(this.focusedId);
    if (!focused) {
      return { ok: false, reason: "Current focus not found in tree." };
    }
    const parent = focused.parent;
    if (!parent) {
      return { ok: false, reason: "Parent not found." };
    }
    this.focusedId = parent.id;
    return { ok: true };
  }

  focusByUuid(uuid: string): { ok: true } | { ok: false; reason: string } {
    const target = this.tree.findById(uuid);
    if (!target) {
      return { ok: false, reason: "Node not found." };
    }
    this.focusedId = target.id;
    return { ok: true };
  }

  replaceTree(tree: Tree, focusedId?: string): void {
    this.tree = tree;
    this.focusedId = focusedId ?? tree.root.id;
  }
}
