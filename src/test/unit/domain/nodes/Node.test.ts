import { beforeEach, describe, expect, it } from "vitest";

import { Node } from "../../../../domain/nodes/Node.js";
import {
  AlreadyAttachedError,
  NotAChildError,
} from "../../../../domain/nodes/TreeNode.js";
import { Weight } from "../../../../domain/values/Weight.js";

class TestNode extends Node {
  constructor(id: string, title: string, weight: Weight) {
    super(id, title, weight);
  }
}

const W = (n: number): Weight => Weight.of(n);

describe("Node (§17.72 — v4 part 8: abstract Node base, non-generic)", () => {
  let parent: TestNode;
  let child: TestNode;

  beforeEach(() => {
    parent = new TestNode("p", "Parent", W(1));
    child = new TestNode("c", "Child", W(2));
  });

  describe("construction + accessors", () => {
    it("stores id (readonly), title, weight via the constructor", () => {
      const w = W(1);
      const n = new TestNode("x", "X", w);
      expect(n.id).toBe("x");
      expect(n.title).toBe("X");
      expect(n.weight).toBe(w);
    });

    it("starts with a null parent and an empty children list", () => {
      expect(parent.parent).toBeNull();
      expect(parent.children).toHaveLength(0);
    });

    it("exposes children as a frozen defensive copy (mutation is rejected)", () => {
      parent.attach(child);
      const snapshot = parent.children;
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(() => (snapshot as Node[]).push(parent)).toThrow();
    });
  });

  describe("setTitle / setWeight mutability", () => {
    it("setTitle replaces the stored title", () => {
      parent.setTitle("Renamed");
      expect(parent.title).toBe("Renamed");
    });

    it("setWeight replaces the stored weight (reference swap)", () => {
      const w2 = W(5);
      parent.setWeight(w2);
      expect(parent.weight).toBe(w2);
    });
  });

  describe("attach()", () => {
    it("links child to parent (child.parent = parent, child appears in parent.children)", () => {
      parent.attach(child);
      expect(child.parent).toBe(parent);
      expect(parent.children).toEqual([child]);
    });

    it("throws AlreadyAttachedError if the child already has a parent", () => {
      parent.attach(child);
      const other = new TestNode("o", "Other", W(1));
      expect(() => other.attach(child)).toThrow(AlreadyAttachedError);
    });
  });

  describe("detach()", () => {
    it("unlinks child (child.parent = null, removed from parent.children)", () => {
      parent.attach(child);
      parent.detach(child);
      expect(child.parent).toBeNull();
      expect(parent.children).toHaveLength(0);
    });

    it("throws NotAChildError if the argument is not actually a child", () => {
      const stranger = new TestNode("s", "Stranger", W(1));
      expect(() => parent.detach(stranger)).toThrow(NotAChildError);
    });
  });
});
