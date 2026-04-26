import type { TreeNode } from "../../domain/nodes/TreeNode.js";

/** Read model for the focused "zoom" view: center node and its direct children. */
export type FocusedTreeView = {
  center: TreeNode<unknown>;
  childrenNodes: readonly TreeNode<unknown>[];
};

/** Port: tree navigation without UI or storage details (hexagonal boundary). */
export interface TreeNavigationPort {
  getRoot(): TreeNode<unknown>;
  getFocusedId(): string;
  getFocusedView(): FocusedTreeView | null;
  /** Move focus to a direct child of the current focus. */
  focusChild(childId: string): { ok: true } | { ok: false; reason: string };
  /** Move focus to parent of current focus, if any. */
  focusParent(): { ok: true } | { ok: false; reason: string };
  /**
   * Move focus to any node addressable by uuid in the loaded tree.
   * Used by deep-link routing (`#/b/<boardId>/n/<focusNodeUuid>`) and breadcrumb taps.
   */
  focusByUuid(uuid: string): { ok: true } | { ok: false; reason: string };
}
