import type { Node } from "./Node.js";

export function findNodeById(root: Node, id: string): Node | null {
  if (root.id === id) {
    return root;
  }
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

export function findParentOf(root: Node, id: string): Node | null {
  for (const child of root.children) {
    if (child.id === id) {
      return root;
    }
    const deeper = findParentOf(child, id);
    if (deeper) {
      return deeper;
    }
  }
  return null;
}
