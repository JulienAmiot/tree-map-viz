import { describe, expect, it } from "vitest";

import { Computation } from "../../../../domain/computation/Computation.js";
import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { ComputationRegistry } from "../../../../domain/computation/ComputationRegistry.js";
import { EmptyChildrenError } from "../../../../domain/computation/EmptyChildrenError.js";
import {
  AverageComputation,
  CountComputation,
  MaxComputation,
  MinComputation,
  SumComputation,
  WeightedAverageComputation,
} from "../../../../domain/computation/strategies.js";
import { Node } from "../../../../domain/nodes/Node.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { Weight } from "../../../../domain/values/Weight.js";

class StubValueNode<T> extends ValueNode<T> {
  constructor(weight: number, private readonly factory: () => T) { super("id", "id", Weight.of(weight), ""); }
  getValue(): T { return this.factory(); }
}
class StubNonValueNode extends Node {
  constructor() { super("nv", "nv", Weight.of(1)); }
}
const num = (w: number, v: number) => new StubValueNode(w, () => v);
const txt = (w: number, v: string) => new StubValueNode<string>(w, () => v);
const disable = <T extends Node>(n: T): T => Object.assign(n, { disabled: true });

describe("ComputationKind + EmptyChildrenError (§17.95)", () => {
  it("has 6 stable-named singletons + frozen ALL", () => {
    expect(ComputationKind.ALL.map((k) => k.name)).toEqual([
      "SUM", "AVERAGE", "MIN", "MAX", "WEIGHTED_AVERAGE", "COUNT",
    ]);
    expect(Object.isFrozen(ComputationKind.ALL)).toBe(true);
  });
  it("EmptyChildrenError extends Error with stable name + templated message", () => {
    const e = new EmptyChildrenError("SUM");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("EmptyChildrenError");
    expect(e.message).toBe("SUM computation has no eligible children");
  });
});

describe("Numeric strategies (§17.95)", () => {
  it("SUM / AVERAGE / MIN / MAX fold over enabled numeric children", () => {
    const ch = [num(1, 10), num(1, 20), num(1, 30)];
    expect(SumComputation.INSTANCE.apply(ch)).toBe(60);
    expect(AverageComputation.INSTANCE.apply(ch)).toBe(20);
    expect(MinComputation.INSTANCE.apply([num(1, -5), num(1, 0), num(1, 5)])).toBe(-5);
    expect(MaxComputation.INSTANCE.apply([num(1, -3), num(1, -7)])).toBe(-3);
  });
  it("WEIGHTED_AVERAGE folds Σ(v·w)/Σ(w); degenerates to AVERAGE on equal weights", () => {
    expect(WeightedAverageComputation.INSTANCE.apply([num(1, 10), num(3, 30)])).toBe(25);
    const eq = [num(2, 10), num(2, 20), num(2, 30)];
    expect(WeightedAverageComputation.INSTANCE.apply(eq)).toBe(
      AverageComputation.INSTANCE.apply(eq),
    );
  });
  it("every numeric strategy raises EmptyChildrenError on empty / all-skipped", () => {
    for (const s of [SumComputation, AverageComputation, MinComputation, MaxComputation, WeightedAverageComputation]) {
      expect(() => s.INSTANCE.apply([])).toThrow(EmptyChildrenError);
      expect(() => s.INSTANCE.apply([txt(1, "x")])).toThrow(EmptyChildrenError);
    }
  });
});

describe("Eligibility composition (§17.95)", () => {
  it("skips disabled / non-ValueNode / TextNode / non-finite / throwing children", () => {
    const result = SumComputation.INSTANCE.apply([
      num(1, 10),
      disable(num(1, 99)),
      new StubNonValueNode(),
      txt(1, "skip"),
      new StubValueNode<number>(1, () => Number.NaN),
      new StubValueNode<number>(1, () => { throw new Error("EmptyHistory"); }),
      num(1, 30),
    ]);
    expect(result).toBe(40);
  });
});

describe("CountComputation (§17.95 — T-agnostic, §17.94 risk #2)", () => {
  it("counts every enabled value-producing child incl. TextNodes; returns 0 on empty / all-disabled", () => {
    expect(CountComputation.INSTANCE.apply([num(1, 10), txt(1, "x"), num(1, 30)])).toBe(3);
    expect(CountComputation.INSTANCE.apply([num(1, 10), disable(num(1, 20))])).toBe(1);
    expect(CountComputation.INSTANCE.apply([])).toBe(0);
    expect(CountComputation.INSTANCE.apply([disable(num(1, 1))])).toBe(0);
  });
});

describe("ComputationRegistry + Computation base (§17.95)", () => {
  it("resolves each ComputationKind.ALL inhabitant to its singleton", () => {
    const expected = new Map<ComputationKind, Computation<number>>([
      [ComputationKind.SUM, SumComputation.INSTANCE],
      [ComputationKind.AVERAGE, AverageComputation.INSTANCE],
      [ComputationKind.MIN, MinComputation.INSTANCE],
      [ComputationKind.MAX, MaxComputation.INSTANCE],
      [ComputationKind.WEIGHTED_AVERAGE, WeightedAverageComputation.INSTANCE],
      [ComputationKind.COUNT, CountComputation.INSTANCE],
    ]);
    for (const k of ComputationKind.ALL) {
      expect(ComputationRegistry.resolve(k)).toBe(expected.get(k));
    }
  });
  it("accepts a polymorphic Computation<T> subclass returning T", () => {
    class C42 extends Computation<number> {
      apply(_: readonly Node[]): number { return 42; }
    }
    expect(new C42().apply([])).toBe(42);
  });
});
