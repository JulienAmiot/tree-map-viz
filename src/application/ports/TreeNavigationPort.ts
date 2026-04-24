import type { Node } from "../../domain/Node.js";

/** Read model for the focused “zoom” view: center node and its direct children. */
export type FocusedTreeView = {
  center: Node;
  children: Node[];
};

/** Port: tree navigation without UI or storage details (hexagonal boundary). */
export interface TreeNavigationPort {
  getRoot(): Node;
  getFocusedId(): string;
  getFocusedView(): FocusedTreeView | null;
  /** Move focus to a direct child of the current focus. */
  focusChild(childId: string): { ok: true } | { ok: false; reason: string };
  /** Move focus to parent of current focus, if any. */
  focusParent(): { ok: true } | { ok: false; reason: string };
}
