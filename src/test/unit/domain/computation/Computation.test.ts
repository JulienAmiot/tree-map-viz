import { describe, expect, it } from "vitest";

import { AverageComputation } from "../../../../domain/computation/AverageComputation.js";
import { Computation } from "../../../../domain/computation/Computation.js";
import { CountComputation } from "../../../../domain/computation/CountComputation.js";
import { EmptyChildrenError } from "../../../../domain/computation/EmptyChildrenError.js";
import { MaxComputation } from "../../../../domain/computation/MaxComputation.js";
import { MinComputation } from "../../../../domain/computation/MinComputation.js";
import { SumComputation } from "../../../../domain/computation/SumComputation.js";
import { WeightedAverageComputation } from "../../../../domain/computation/WeightedAverageComputation.js";
import { Node } from "../../../../domain/nodes/Node.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { Weight } from "../../../../domain/values/Weight.js";

/**
 * Lightweight in-suite stub — exercises the strategies against deterministic
 * `getValue()` returns without dragging the historizable + range machinery
 * into every test. The strategies only see the `ValueNode<T>` surface
 * (`getValue()` + the inherited `weight` from `Node`); a stub is enough.
 */
class StubValueNode<T> extends ValueNode<T> {
  constructor(
    id: string,
    weight: number,
    private readonly factory: () => T,
  ) {
    super(id, id, Weight.of(weight), "");
  }

  getValue(): T {
    return this.factory();
  }
}

const numeric = (id: string, weight: number, value: number): StubValueNode<number> =>
  new StubValueNode(id, weight, () => value);
const text = (id: string, weight: number, value: string): StubValueNode<string> =>
  new StubValueNode(id, weight, () => value);
const throwing = (id: string, weight: number, err: Error): StubValueNode<number> =>
  new StubValueNode(id, weight, () => {
    throw err;
  });
const nonFinite = (id: string, weight: number, value: number): StubValueNode<number> =>
  new StubValueNode(id, weight, () => value);

/** Mutates the stub to carry the duck-typed `disabled` flag — §17.99 will
 * promote this to a real field on `ValueNode<T>`; the predicate inside
 * `Computation.enabledValueNodes` is already pre-wired to read it. */
function disable<T extends Node>(node: T): T {
  Object.assign(node, { disabled: true });
  return node;
}

/** A non-ValueNode child — base eligibility filter must skip it. */
class StubNonValueNode extends Node {
  constructor(id: string, weight: number) {
    super(id, id, Weight.of(weight));
  }
}

describe("SumComputation (§17.95)", () => {
  it("sums every enabled numeric child", () => {
    expect(SumComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      numeric("b", 1, 20),
      numeric("c", 1, 30),
    ])).toBe(60);
  });

  it("skips disabled children (duck-typed flag — §17.99 will narrow)", () => {
    expect(SumComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      disable(numeric("b", 1, 99)),
      numeric("c", 1, 30),
    ])).toBe(40);
  });

  it("skips TextNode children (non-numeric getValue)", () => {
    expect(SumComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      text("t", 1, "ignored"),
      numeric("c", 1, 30),
    ])).toBe(40);
  });

  it("skips non-ValueNode children (base eligibility filter)", () => {
    expect(SumComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      new StubNonValueNode("nv", 1),
      numeric("c", 1, 30),
    ])).toBe(40);
  });

  it("skips children whose getValue() throws (e.g. EmptyHistoryError)", () => {
    expect(SumComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      throwing("err", 1, new Error("EmptyHistory")),
      numeric("c", 1, 30),
    ])).toBe(40);
  });

  it("skips children whose getValue() is non-finite (NaN / Infinity)", () => {
    expect(SumComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      nonFinite("nan", 1, Number.NaN),
      nonFinite("inf", 1, Number.POSITIVE_INFINITY),
      numeric("c", 1, 30),
    ])).toBe(40);
  });

  it("raises EmptyChildrenError on empty children", () => {
    expect(() => SumComputation.INSTANCE.apply([])).toThrow(EmptyChildrenError);
  });

  it("raises EmptyChildrenError when no child passes the numeric filter", () => {
    expect(() => SumComputation.INSTANCE.apply([
      text("a", 1, "one"),
      text("b", 1, "two"),
    ])).toThrow(EmptyChildrenError);
  });

  it("is a singleton (reference equality)", () => {
    expect(SumComputation.INSTANCE).toBe(SumComputation.INSTANCE);
  });
});

describe("AverageComputation (§17.95)", () => {
  it("returns the arithmetic mean of enabled numeric children", () => {
    expect(AverageComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      numeric("b", 1, 20),
      numeric("c", 1, 30),
    ])).toBe(20);
  });

  it("ignores weight (a child's weight does not bias the average)", () => {
    expect(AverageComputation.INSTANCE.apply([
      numeric("a", 5, 10),
      numeric("b", 1, 30),
    ])).toBe(20);
  });

  it("raises EmptyChildrenError when no eligible child remains", () => {
    expect(() => AverageComputation.INSTANCE.apply([
      disable(numeric("a", 1, 10)),
      text("t", 1, "skip"),
    ])).toThrow(EmptyChildrenError);
  });
});

describe("MinComputation (§17.95)", () => {
  it("returns the smallest enabled numeric child", () => {
    expect(MinComputation.INSTANCE.apply([
      numeric("a", 1, 30),
      numeric("b", 1, 10),
      numeric("c", 1, 20),
    ])).toBe(10);
  });

  it("handles negative + zero values", () => {
    expect(MinComputation.INSTANCE.apply([
      numeric("a", 1, -5),
      numeric("b", 1, 0),
      numeric("c", 1, 5),
    ])).toBe(-5);
  });

  it("raises EmptyChildrenError on empty input", () => {
    expect(() => MinComputation.INSTANCE.apply([])).toThrow(EmptyChildrenError);
  });
});

describe("MaxComputation (§17.95)", () => {
  it("returns the largest enabled numeric child", () => {
    expect(MaxComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      numeric("b", 1, 30),
      numeric("c", 1, 20),
    ])).toBe(30);
  });

  it("handles negative-only values", () => {
    expect(MaxComputation.INSTANCE.apply([
      numeric("a", 1, -3),
      numeric("b", 1, -7),
    ])).toBe(-3);
  });

  it("raises EmptyChildrenError on empty input", () => {
    expect(() => MaxComputation.INSTANCE.apply([])).toThrow(EmptyChildrenError);
  });
});

describe("WeightedAverageComputation (§17.95)", () => {
  it("returns Σ(v·w) / Σ(w) over enabled numeric children", () => {
    // weights: 1 + 3 = 4; weighted sum: 10·1 + 30·3 = 100; mean: 25
    expect(WeightedAverageComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      numeric("b", 3, 30),
    ])).toBe(25);
  });

  it("degenerates to AverageComputation when all weights are equal", () => {
    const children = [
      numeric("a", 2, 10),
      numeric("b", 2, 20),
      numeric("c", 2, 30),
    ];
    expect(WeightedAverageComputation.INSTANCE.apply(children)).toBe(
      AverageComputation.INSTANCE.apply(children),
    );
  });

  it("raises EmptyChildrenError when no child survives the numeric filter", () => {
    expect(() => WeightedAverageComputation.INSTANCE.apply([
      text("t", 1, "skip"),
    ])).toThrow(EmptyChildrenError);
  });
});

describe("CountComputation (§17.95 — T-agnostic, §17.94 risk #2)", () => {
  it("counts every enabled value-producing child regardless of value type", () => {
    expect(CountComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      text("t", 1, "hello"),
      numeric("b", 1, 30),
    ])).toBe(3);
  });

  it("skips disabled children", () => {
    expect(CountComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      disable(numeric("b", 1, 20)),
      numeric("c", 1, 30),
    ])).toBe(2);
  });

  it("skips non-ValueNode children", () => {
    expect(CountComputation.INSTANCE.apply([
      numeric("a", 1, 10),
      new StubNonValueNode("nv", 1),
    ])).toBe(1);
  });

  it("returns 0 on the empty set (does NOT raise EmptyChildrenError — §17.94 risk #2)", () => {
    expect(CountComputation.INSTANCE.apply([])).toBe(0);
  });

  it("returns 0 when every child is disabled (still no raise)", () => {
    expect(CountComputation.INSTANCE.apply([
      disable(numeric("a", 1, 10)),
      disable(numeric("b", 1, 20)),
    ])).toBe(0);
  });
});

describe("Computation base — eligibility composition (§17.95)", () => {
  it("type signature accepts a polymorphic subclass", () => {
    class CustomComputation extends Computation<number> {
      apply(_children: readonly Node[]): number {
        return 42;
      }
    }
    expect(new CustomComputation().apply([])).toBe(42);
  });
});
