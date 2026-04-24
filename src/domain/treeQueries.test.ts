import { describe, expect, it } from "vitest";
import { Node } from "./Node.js";
import { findNodeById, findParentOf } from "./treeQueries.js";

function buildSampleTree(): Node {
  const leaf = new Node("l1", "Leaf", "", 1, "u", new Date(), []);
  const mid = new Node("m1", "Mid", "", 2, "u", new Date(), [leaf]);
  return new Node("r", "Root", "", 0, "u", new Date(), [mid]);
}

describe("findNodeById", () => {
  it("returns root when id matches", () => {
    const root = buildSampleTree();
    expect(findNodeById(root, "r")?.id).toBe("r");
  });

  it("returns nested node", () => {
    const root = buildSampleTree();
    expect(findNodeById(root, "l1")?.id).toBe("l1");
  });

  it("returns null for unknown id", () => {
    const root = buildSampleTree();
    expect(findNodeById(root, "nope")).toBeNull();
  });
});

describe("findParentOf", () => {
  it("returns null for root id", () => {
    const root = buildSampleTree();
    expect(findParentOf(root, "r")).toBeNull();
  });

  it("returns root for direct child", () => {
    const root = buildSampleTree();
    expect(findParentOf(root, "m1")?.id).toBe("r");
  });

  it("returns mid for leaf", () => {
    const root = buildSampleTree();
    expect(findParentOf(root, "l1")?.id).toBe("m1");
  });
});
