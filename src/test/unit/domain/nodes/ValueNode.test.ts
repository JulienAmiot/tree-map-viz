import { describe, expect, it } from "vitest";

import { Node } from "../../../../domain/nodes/Node.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { Weight } from "../../../../domain/values/Weight.js";

class TestValueNode<T> extends ValueNode<T> {
  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    private readonly value: T,
  ) {
    super(id, title, weight, description);
  }

  getValue(): T {
    return this.value;
  }
}

class TextLikeValueNode extends ValueNode<string> {
  constructor(id: string, title: string, weight: Weight, value: string) {
    // §17.15-style: TextNode keeps description empty; the rendered
    // description IS the value via a polymorphic override.
    super(id, title, weight, "");
    this.value = value;
  }

  private value: string;
  getValue(): string {
    return this.value;
  }
  override getDescription(): string {
    return this.getValue();
  }
}

describe("ValueNode (§17.72 — v4 part 8: abstract ValueNode<T>)", () => {
  it("extends Node (inherits id / title / weight / parent / children)", () => {
    const n = new TestValueNode("v", "V", Weight.of(1), "desc", 42);
    expect(n).toBeInstanceOf(Node);
    expect(n.id).toBe("v");
    expect(n.title).toBe("V");
  });

  it("stores description via the constructor; getDescription returns it", () => {
    const n = new TestValueNode("v", "V", Weight.of(1), "the why", 0);
    expect(n.getDescription()).toBe("the why");
  });

  it("setDescription replaces the stored description", () => {
    const n = new TestValueNode("v", "V", Weight.of(1), "old", 0);
    n.setDescription("new");
    expect(n.getDescription()).toBe("new");
  });

  it("getValue() dispatches polymorphically to the subclass impl", () => {
    const numeric = new TestValueNode("a", "A", Weight.of(1), "", 7);
    const stringy = new TestValueNode("b", "B", Weight.of(1), "", "hello");
    expect(numeric.getValue()).toBe(7);
    expect(stringy.getValue()).toBe("hello");
  });

  it("getDescription() can be overridden to return getValue() (TextNode-style)", () => {
    // §17.15 — for TextNode the rendered description IS the value; v4
    // accommodates this with a polymorphic getDescription override
    // rather than a flag, exactly like the v4 diagram intends.
    const n = new TextLikeValueNode("t", "T", Weight.of(1), "the body");
    expect(n.getValue()).toBe("the body");
    expect(n.getDescription()).toBe("the body");
  });

  describe("disabled flag (§17.99a — v5 round-7 D4 successor to v3 eligibleForParentComputation)", () => {
    it("defaults to false on every freshly-constructed value node (existing kiosks stay enabled by construction)", () => {
      expect(new TestValueNode("v", "V", Weight.of(1), "", 0).disabled).toBe(false);
      expect(new TextLikeValueNode("t", "T", Weight.of(1), "body").disabled).toBe(false);
    });

    it("setDisabled(true) parks the node; setDisabled(false) reverses it (idempotent setter for §17.101 EditNodeServiceV4)", () => {
      const n = new TestValueNode("v", "V", Weight.of(1), "", 0);
      n.setDisabled(true);
      expect(n.disabled).toBe(true);
      n.setDisabled(false);
      expect(n.disabled).toBe(false);
    });
  });
});
