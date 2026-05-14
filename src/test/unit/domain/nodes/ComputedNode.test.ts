import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { ComputationOverrideError } from "../../../../domain/computation/ComputationOverrideError.js";
import { ComputationRegistry } from "../../../../domain/computation/ComputationRegistry.js";
import { AverageComputation, SumComputation } from "../../../../domain/computation/strategies.js";
import { ComputedNode } from "../../../../domain/nodes/ComputedNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string) => Timestamp.of(new Date(iso));
const clock: Clock = { now: () => T("2026-05-14T10:00:00Z") };

class StubChild extends ValueNode<number> {
  constructor(id: string, weight: number, private readonly v: number) {
    super(id, id, Weight.of(weight), "");
  }
  getValue(): number { return this.v; }
}

const build = (kind: ComputationKind, ...values: number[]): ComputedNode<number> => {
  const node = new ComputedNode<number>("c", "c", Weight.of(1), "desc", clock, kind);
  values.forEach((v, i) => node.attach(new StubChild(`ch${i}`, 1, v)));
  return node;
};

describe("ComputedNode<T> — construction + Computed<T> interface (§17.97)", () => {
  it("constructs with an initial ComputationKind and exposes the resolved strategy", () => {
    const node = build(ComputationKind.SUM);
    expect(node.computationKind).toBe(ComputationKind.SUM);
    expect(node.computation).toBe(SumComputation.INSTANCE);
  });

  it("inherits id / title / weight / description / clock from HistorizableValueNode", () => {
    const node = new ComputedNode<number>("c", "Title", Weight.of(3), "Desc", clock, ComputationKind.AVERAGE);
    expect(node.id).toBe("c");
    expect(node.title).toBe("Title");
    expect(node.weight.value).toBe(3);
    expect(node.getDescription()).toBe("Desc");
  });
});

describe("ComputedNode<T> — getValue() dispatch via the registry (§17.97)", () => {
  it("returns the strategy's fold over enabled children", () => {
    expect(build(ComputationKind.SUM, 10, 20, 30).getValue()).toBe(60);
    expect(build(ComputationKind.AVERAGE, 10, 20, 30).getValue()).toBe(20);
    expect(build(ComputationKind.MIN, 10, 20, 30).getValue()).toBe(10);
    expect(build(ComputationKind.MAX, 10, 20, 30).getValue()).toBe(30);
    expect(build(ComputationKind.COUNT, 10, 20, 30).getValue()).toBe(3);
  });

  it("propagates EmptyChildrenError from the strategy on empty / all-skipped children (numeric kinds)", () => {
    expect(() => build(ComputationKind.SUM).getValue()).toThrow();
    expect(() => build(ComputationKind.AVERAGE).getValue()).toThrow();
  });

  it("COUNT returns 0 on the empty set (§17.94 risk #2 — does NOT raise)", () => {
    expect(build(ComputationKind.COUNT).getValue()).toBe(0);
  });
});

describe("ComputedNode<T> — setComputationKind invalidates the cached strategy (§17.97; §17.94 risk row 6)", () => {
  it("flips both `computationKind` AND `computation` to the new kind in one mutation", () => {
    const node = build(ComputationKind.SUM, 10, 20, 30);
    expect(node.getValue()).toBe(60);
    node.setComputationKind(ComputationKind.AVERAGE);
    expect(node.computationKind).toBe(ComputationKind.AVERAGE);
    expect(node.computation).toBe(AverageComputation.INSTANCE);
    expect(node.getValue()).toBe(20);
  });

  it("cached strategy survives unrelated state changes (idempotency)", () => {
    const node = build(ComputationKind.SUM);
    const cached = node.computation;
    node.attach(new StubChild("late", 1, 42));
    expect(node.computation).toBe(cached);
    expect(node.computation).toBe(ComputationRegistry.resolve(ComputationKind.SUM));
  });
});

describe("ComputedNode<T> — audit-only history (§17.97; §17.94 D5)", () => {
  it("setValue throws ComputationOverrideError (history is audit-only)", () => {
    const node = build(ComputationKind.SUM, 10);
    expect(() => node.setValue(99)).toThrow(ComputationOverrideError);
  });

  it("addValue throws ComputationOverrideError (history is audit-only)", () => {
    const node = build(ComputationKind.SUM, 10);
    expect(() => node.addValue(T("2026-04-01T00:00:00Z"), 99)).toThrow(ComputationOverrideError);
  });

  it("ComputationOverrideError carries the node id in its message", () => {
    const node = new ComputedNode<number>("metric-42", "x", Weight.of(1), "", clock, ComputationKind.SUM);
    try { node.setValue(1); } catch (e) {
      expect((e as Error).message).toContain(`"metric-42"`);
    }
  });

  it("entries() stays readable (empty until a future strand wires the stamping mechanism)", () => {
    const node = build(ComputationKind.SUM, 10);
    expect(node.entries()).toEqual([]);
    expect(Object.isFrozen(node.entries())).toBe(true);
  });
});
