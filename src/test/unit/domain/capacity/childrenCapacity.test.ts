import { describe, expect, it } from "vitest";

import {
  canAddChild,
  MAX_CHILDREN,
  shouldRenderPlusTile,
} from "../../../../domain/capacity/childrenCapacity.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import type { TreeNode } from "../../../../domain/nodes/TreeNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Title } from "../../../../domain/values/Title.js";
import { Weight } from "../../../../domain/values/Weight.js";

const identity = NodeIdentity.of(Title.of("X"), Description.of(""));
const w = Weight.of(1);

function makeTextNode(id: string): TextNode {
  return new TextNode(id, identity, w);
}

function withChildren(n: number): TextNode {
  const parent = makeTextNode("parent");
  for (let i = 0; i < n; i++) {
    parent.attach(makeTextNode(`c${i}`));
  }
  return parent;
}

describe("childrenCapacity", () => {
  describe("MAX_CHILDREN", () => {
    it("is locked at 12 (per SPEC \u00a74)", () => {
      expect(MAX_CHILDREN).toBe(12);
    });
  });

  describe("canAddChild()", () => {
    it("returns true when the node has zero children", () => {
      expect(canAddChild(withChildren(0))).toBe(true);
    });

    it("returns true at 1 child", () => {
      expect(canAddChild(withChildren(1))).toBe(true);
    });

    it("returns true at 11 children (one slot left)", () => {
      expect(canAddChild(withChildren(11))).toBe(true);
    });

    it("returns false at 12 children (cap reached)", () => {
      expect(canAddChild(withChildren(12))).toBe(false);
    });

    it("returns false above 12 children (defensive)", () => {
      const parent = withChildren(12);
      const overfilled = withChildren(0);
      for (let i = 0; i < 13; i++) {
        overfilled.attach(makeTextNode(`x${i}`));
      }
      expect(canAddChild(overfilled)).toBe(false);
      expect(canAddChild(parent)).toBe(false);
    });
  });

  describe("shouldRenderPlusTile()", () => {
    it("returns true at 0 children (renders only the + tile)", () => {
      expect(shouldRenderPlusTile(withChildren(0))).toBe(true);
    });

    it("returns true at 1..11 children (children + the + tile)", () => {
      for (let n = 1; n <= 11; n++) {
        expect(shouldRenderPlusTile(withChildren(n))).toBe(true);
      }
    });

    it("returns false at 12 children (cap suppresses the + tile)", () => {
      expect(shouldRenderPlusTile(withChildren(12))).toBe(false);
    });

    it("matches canAddChild at every count from 0 to 13", () => {
      for (let n = 0; n <= 13; n++) {
        const parent: TreeNode<unknown> = withChildren(n);
        expect(shouldRenderPlusTile(parent)).toBe(canAddChild(parent));
      }
    });
  });
});
