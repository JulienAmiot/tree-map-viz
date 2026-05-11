import type { Node } from "../../domain/nodes/Node.js";
import type { Tree } from "../../domain/Tree.js";

/**
 * V4 read model for the focused "zoom" view (SPEC §17.92 — Phase
 * B.4 of the §17.80 v3-retirement migration; v4 successor to v3's
 * `FocusedTreeView` from `TreeNavigationPort.ts`).
 *
 * Same shape as v3, only the node type changes: `TreeNode<unknown>`
 * → v4 `Node`. The `viewModelMapperV4` (§17.91) consumes this
 * shape via its `mapFocusedToViewModelV4(center, children)` entry
 * point — same call site, v4-typed nodes.
 */
export type FocusedTreeViewV4 = {
  center: Node;
  childrenNodes: readonly Node[];
};

/**
 * V4 port: tree navigation without UI or storage details (SPEC
 * §17.92; v4 successor to v3's `TreeNavigationPort`). Same API
 * surface — `getRoot`/`getFocusedId`/`getFocusedView`/`focusChild`
 * /`focusParent`/`focusByUuid`/`replaceTree` — only the types
 * change to v4. Composition root binds either v3 or v4 service
 * depending on which side of the §17.93 cutover the build is on.
 *
 * The `getRoot` return type is v4 `Tree` (the §17.79 container)
 * rather than a raw v4 `Node`. The Tree carries the v4-canonical
 * `findById` / `nodes()` traversal helpers; consumers that want
 * those don't have to re-derive them.
 */
export interface TreeNavigationPortV4 {
  getRoot(): Tree;
  getFocusedId(): string;
  getFocusedView(): FocusedTreeViewV4 | null;
  /** Move focus to a direct child of the current focus. */
  focusChild(childId: string): { ok: true } | { ok: false; reason: string };
  /** Move focus to parent of current focus, if any. */
  focusParent(): { ok: true } | { ok: false; reason: string };
  /**
   * Move focus to any node addressable by uuid in the loaded tree.
   * Used by deep-link routing (`#/b/<boardId>/n/<focusNodeUuid>`)
   * and breadcrumb taps.
   */
  focusByUuid(uuid: string): { ok: true } | { ok: false; reason: string };
}
