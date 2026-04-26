import { describe, expect, it } from "vitest";

import { TextNode } from "../../../domain/nodes/TextNode.js";
import { findNodeById, findParentOf, walkPath } from "../../../domain/treeQueries.js";
import { Description } from "../../../domain/values/Description.js";
import { NodeIdentity } from "../../../domain/values/NodeIdentity.js";
import { Title } from "../../../domain/values/Title.js";
import { Weight } from "../../../domain/values/Weight.js";

const identity = NodeIdentity.of(Title.of("X"), Description.of(""));
const w = Weight.of(1);

function tn(idStr: string): TextNode {
  return new TextNode(idStr, identity, w);
}

// Tree shape:
//   r
//   ├── m1
//   │   └── l1
//   └── m2
//       ├── l2
//       └── l3
function buildTree(): TextNode {
  const root = tn("r");
  const m1 = tn("m1");
  const l1 = tn("l1");
  m1.attach(l1);
  root.attach(m1);

  const m2 = tn("m2");
  const l2 = tn("l2");
  const l3 = tn("l3");
  m2.attach(l2);
  m2.attach(l3);
  root.attach(m2);
  return root;
}

describe("findNodeById", () => {
  it("returns root when id matches root", () => {
    const root = buildTree();
    expect(findNodeById(root, "r")?.id).toBe("r");
  });

  it("returns a deeply-nested node by id", () => {
    const root = buildTree();
    expect(findNodeById(root, "l3")?.id).toBe("l3");
  });

  it("returns null when no node has the given id", () => {
    const root = buildTree();
    expect(findNodeById(root, "missing")).toBeNull();
  });
});

describe("findParentOf", () => {
  it("returns null for the root id (the root has no parent in this view)", () => {
    const root = buildTree();
    expect(findParentOf(root, "r")).toBeNull();
  });

  it("returns the root for a direct child of the root", () => {
    const root = buildTree();
    expect(findParentOf(root, "m1")?.id).toBe("r");
  });

  it("returns the immediate parent for a deeply-nested node", () => {
    const root = buildTree();
    expect(findParentOf(root, "l3")?.id).toBe("m2");
  });

  it("returns null when the id does not exist in the tree", () => {
    const root = buildTree();
    expect(findParentOf(root, "missing")).toBeNull();
  });
});

describe("walkPath", () => {
  it("returns [root] when the id matches the root", () => {
    const root = buildTree();
    const path = walkPath(root, "r");
    expect(path?.map((n) => n.id)).toEqual(["r"]);
  });

  it("returns the full path from root to a deep leaf, inclusive", () => {
    const root = buildTree();
    const path = walkPath(root, "l3");
    expect(path?.map((n) => n.id)).toEqual(["r", "m2", "l3"]);
  });

  it("returns null when the id is not in the tree", () => {
    const root = buildTree();
    expect(walkPath(root, "missing")).toBeNull();
  });

  it("path's first element is the root and last element is the target", () => {
    const root = buildTree();
    const path = walkPath(root, "l1");
    expect(path).not.toBeNull();
    if (path !== null) {
      expect(path[0]).toBe(root);
      expect(path[path.length - 1]?.id).toBe("l1");
    }
  });

  it("returns a fresh array each call (does not leak internal state)", () => {
    const root = buildTree();
    expect(walkPath(root, "l1")).not.toBe(walkPath(root, "l1"));
  });
});
