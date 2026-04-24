import type { Node } from "../domain/Node.js";
import { findNodeById, findParentOf } from "../domain/treeQueries.js";
import type { FocusedTreeView, TreeNavigationPort } from "./ports/TreeNavigationPort.js";

/**
 * Application service: orchestrates focus changes using domain queries (single responsibility).
 */
export class TreeNavigationService implements TreeNavigationPort {
  private root: Node;
  private focusedId: string;

  constructor(root: Node, initialFocusedId?: string) {
    this.root = root;
    this.focusedId = initialFocusedId ?? root.id;
  }

  getRoot(): Node {
    return this.root;
  }

  getFocusedId(): string {
    return this.focusedId;
  }

  getFocusedView(): FocusedTreeView | null {
    const center = findNodeById(this.root, this.focusedId);
    if (!center) {
      return null;
    }
    return {
      center,
      children: [...center.children],
    };
  }

  focusChild(childId: string): { ok: true } | { ok: false; reason: string } {
    const center = findNodeById(this.root, this.focusedId);
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
    if (this.focusedId === this.root.id) {
      return { ok: false, reason: "Already at root." };
    }
    const parent = findParentOf(this.root, this.focusedId);
    if (!parent) {
      return { ok: false, reason: "Parent not found." };
    }
    this.focusedId = parent.id;
    return { ok: true };
  }
}
