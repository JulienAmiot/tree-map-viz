import { describe, expect, it } from "vitest";

import {
  AlreadyAttachedError,
  NotAChildError,
  TreeNode,
} from "../../../../domain/nodes/TreeNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../domain/values/Title.js";
import { Weight } from "../../../../domain/values/Weight.js";

const date = new Date("2026-01-01T00:00:00Z");
const idA = NodeIdentity.of(Title.of("A"), Description.of(""));
const idB = NodeIdentity.of(Title.of("B"), Description.of(""));
const idC = NodeIdentity.of(Title.of("C"), Description.of(""));
const w = Weight.of(1);

class StubNode<T> extends TreeNode<T> {
  constructor(
    id: string,
    identity: NodeIdentity,
    weight: Weight,
    private readonly value: TimestampedValue<T>,
  ) {
    super(id, identity, weight);
  }
  currentValue(): TimestampedValue<T> {
    return this.value;
  }
}

const stubValue = TimestampedValue.of(42, date);

function makeStub(id: string, identity: NodeIdentity = idA, weight: Weight = w): StubNode<number> {
  return new StubNode(id, identity, weight, stubValue);
}

describe("TreeNode", () => {
  describe("construction", () => {
    it("exposes id, identity, and weight", () => {
      const n = makeStub("x", idA, Weight.of(5));
      expect(n.id).toBe("x");
      expect(n.identity.equals(idA)).toBe(true);
      expect(n.weight.equals(Weight.of(5))).toBe(true);
    });

    it("starts with no parent", () => {
      const n = makeStub("x");
      expect(n.parent).toBeNull();
    });

    it("starts with no children", () => {
      const n = makeStub("x");
      expect(n.children).toEqual([]);
    });
  });

  describe("attach()", () => {
    it("adds the child to children and sets the child's parent", () => {
      const parent = makeStub("p");
      const child = makeStub("c");
      parent.attach(child);
      expect(parent.children.map((c) => c.id)).toEqual(["c"]);
      expect(child.parent).toBe(parent);
    });

    it("appends children in attach order", () => {
      const parent = makeStub("p");
      const a = makeStub("a", idA);
      const b = makeStub("b", idB);
      const c = makeStub("c", idC);
      parent.attach(a);
      parent.attach(b);
      parent.attach(c);
      expect(parent.children.map((n) => n.id)).toEqual(["a", "b", "c"]);
    });

    it("throws AlreadyAttachedError when the child already has a different parent", () => {
      const p1 = makeStub("p1");
      const p2 = makeStub("p2");
      const child = makeStub("c");
      p1.attach(child);
      expect(() => p2.attach(child)).toThrow(AlreadyAttachedError);
    });

    it("throws AlreadyAttachedError when re-attaching to the same parent", () => {
      const parent = makeStub("p");
      const child = makeStub("c");
      parent.attach(child);
      expect(() => parent.attach(child)).toThrow(AlreadyAttachedError);
    });

    it("does not mutate the parent's children when an attach throws", () => {
      const p1 = makeStub("p1");
      const p2 = makeStub("p2");
      const child = makeStub("c");
      p1.attach(child);
      try {
        p2.attach(child);
      } catch {
        // expected
      }
      expect(p2.children).toEqual([]);
      expect(child.parent).toBe(p1);
    });
  });

  describe("detach()", () => {
    it("removes the child and clears its parent", () => {
      const parent = makeStub("p");
      const child = makeStub("c");
      parent.attach(child);
      parent.detach(child);
      expect(parent.children).toEqual([]);
      expect(child.parent).toBeNull();
    });

    it("only removes the targeted child from a multi-child parent", () => {
      const parent = makeStub("p");
      const a = makeStub("a", idA);
      const b = makeStub("b", idB);
      parent.attach(a);
      parent.attach(b);
      parent.detach(a);
      expect(parent.children.map((n) => n.id)).toEqual(["b"]);
      expect(a.parent).toBeNull();
      expect(b.parent).toBe(parent);
    });

    it("throws NotAChildError when detaching a node that is not its child", () => {
      const p = makeStub("p");
      const stranger = makeStub("s");
      expect(() => p.detach(stranger)).toThrow(NotAChildError);
    });

    it("throws NotAChildError when detaching after the child was already detached", () => {
      const parent = makeStub("p");
      const child = makeStub("c");
      parent.attach(child);
      parent.detach(child);
      expect(() => parent.detach(child)).toThrow(NotAChildError);
    });

    it("allows the detached child to be re-attached to a new parent", () => {
      const p1 = makeStub("p1");
      const p2 = makeStub("p2");
      const child = makeStub("c");
      p1.attach(child);
      p1.detach(child);
      p2.attach(child);
      expect(child.parent).toBe(p2);
      expect(p2.children.map((n) => n.id)).toEqual(["c"]);
    });
  });

  describe("children read-only view", () => {
    it("returns a defensive snapshot the caller cannot mutate", () => {
      const parent = makeStub("p");
      const a = makeStub("a", idA);
      parent.attach(a);
      const snapshot = parent.children;
      expect(() => (snapshot as TreeNode<unknown>[]).push(makeStub("z"))).toThrow();
      expect(parent.children).toHaveLength(1);
    });

    it("returns a fresh array on each access", () => {
      const parent = makeStub("p");
      parent.attach(makeStub("a"));
      expect(parent.children).not.toBe(parent.children);
    });
  });

  describe("currentValue() abstract dispatch", () => {
    it("delegates to the concrete subclass implementation", () => {
      const tv = TimestampedValue.of(99, date);
      class FixedNode extends TreeNode<number> {
        currentValue(): TimestampedValue<number> {
          return tv;
        }
      }
      const n = new FixedNode("x", idA, w);
      expect(n.currentValue()).toBe(tv);
    });
  });

  // SPEC §17.28 — explicit mutation surface for in-place edits.
  describe("setIdentity / setWeight (\u00a717.28)", () => {
    it("setIdentity swaps the identity reference, preserving id + children", () => {
      const parent = makeStub("p", idA, w);
      const child = makeStub("c", idB);
      parent.attach(child);

      parent.setIdentity(idC);

      expect(parent.identity.equals(idC)).toBe(true);
      expect(parent.id).toBe("p");
      expect(parent.children.map((c) => c.id)).toEqual(["c"]);
      expect(child.parent).toBe(parent);
    });

    it("setWeight swaps the weight reference without touching identity or children", () => {
      const n = makeStub("x", idA, Weight.of(2));
      n.setWeight(Weight.of(7));
      expect(n.weight.value).toBe(7);
      expect(n.identity.equals(idA)).toBe(true);
    });

    it("the new identity reference is the exact instance supplied (structural sharing)", () => {
      const n = makeStub("x", idA);
      const next = NodeIdentity.of(Title.of("Z"), Description.of(""));
      n.setIdentity(next);
      expect(n.identity).toBe(next);
    });
  });
});
