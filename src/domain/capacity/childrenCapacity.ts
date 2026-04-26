import type { TreeNode } from "../nodes/TreeNode.js";

export const MAX_CHILDREN = 12;

export function canAddChild(node: TreeNode<unknown>): boolean {
  return node.children.length < MAX_CHILDREN;
}

export function shouldRenderPlusTile(node: TreeNode<unknown>): boolean {
  return node.children.length < MAX_CHILDREN;
}
