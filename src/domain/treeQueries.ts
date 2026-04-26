import type { TreeNode } from "./nodes/TreeNode.js";

export function findNodeById(
  root: TreeNode<unknown>,
  id: string,
): TreeNode<unknown> | null {
  if (root.id === id) {
    return root;
  }
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

export function findParentOf(
  root: TreeNode<unknown>,
  id: string,
): TreeNode<unknown> | null {
  for (const child of root.children) {
    if (child.id === id) {
      return root;
    }
    const deeper = findParentOf(child, id);
    if (deeper !== null) {
      return deeper;
    }
  }
  return null;
}

export function walkPath(
  root: TreeNode<unknown>,
  id: string,
): readonly TreeNode<unknown>[] | null {
  if (root.id === id) {
    return [root];
  }
  for (const child of root.children) {
    const subpath = walkPath(child, id);
    if (subpath !== null) {
      return [root, ...subpath];
    }
  }
  return null;
}
