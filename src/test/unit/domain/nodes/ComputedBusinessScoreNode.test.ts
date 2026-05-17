import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { ComputationOverrideError } from "../../../../domain/computation/ComputationOverrideError.js";
import { AverageComputation, SumComputation } from "../../../../domain/computation/strategies.js";
import { ComputedBusinessScoreNode } from "../../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { LenientRange } from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string) => Timestamp.of(new Date(iso));
const clock: Clock = { now: () => T("2026-05-14T10:00:00Z") };
const range = () => LenientRange.of(0, 100, NumericComparator.INSTANCE);
const goal = () => Objective.of(80, T("2026-12-31T00:00:00Z"));

class StubChild extends ValueNode<number> {
  constructor(id: string, weight: number, private readonly v: number) {
    super(id, id, Weight.of(weight), "");
  }
  getValue(): number { return this.v; }
}

const build = (
  kind: ComputationKind,
  extra: Partial<{ unit: string }> = {},
  ...values: number[]
): ComputedBusinessScoreNode<number> => {
  const node = new ComputedBusinessScoreNode<number>(
    "cbsn",
    "Sales (auto)",
    Weight.of(1),
    "desc",
    clock,
    range(),
    { objective: goal(), initialKind: kind, ...extra },
  );
  values.forEach((v, i) => node.attach(new StubChild(`ch${i}`, 1, v)));
  return node;
};

describe("ComputedBusinessScoreNode<T> — construction + BSC inheritance + Computed<T> interface (§17.98)", () => {
  it("constructs with an initial ComputationKind and exposes the resolved strategy + inherited BSC slots", () => {
    const node = build(ComputationKind.SUM, { unit: "%" });
    expect(node.computationKind).toBe(ComputationKind.SUM);
    expect(node.computation).toBe(SumComputation.INSTANCE);
    expect(node.range.contains(50)).toBe(true);
    expect(node.objective.value).toBe(80);
    expect(node.unit).toBe("%");
  });

  it("inherits `disabled` from ValueNode<T> (§17.99a/§17.99b — operator opts auto-derived BSCs out of a parent's mean via setDisabled, not a constructor option)", () => {
    const node = build(ComputationKind.SUM);
    expect(node.disabled).toBe(false);
    node.setDisabled(true);
    expect(node.disabled).toBe(true);
  });
});

describe("ComputedBusinessScoreNode<T> — getValue() dispatch via the registry (§17.98)", () => {
  it("returns the strategy's fold over enabled children (identical shape to §17.97)", () => {
    expect(build(ComputationKind.SUM, {}, 10, 20, 30).getValue()).toBe(60);
    expect(build(ComputationKind.AVERAGE, {}, 10, 20, 30).getValue()).toBe(20);
    expect(build(ComputationKind.MIN, {}, 10, 20, 30).getValue()).toBe(10);
    expect(build(ComputationKind.MAX, {}, 10, 20, 30).getValue()).toBe(30);
    expect(build(ComputationKind.COUNT, {}, 10, 20, 30).getValue()).toBe(3);
  });

  it("propagates EmptyChildrenError on empty / all-skipped children for numeric kinds", () => {
    expect(() => build(ComputationKind.SUM).getValue()).toThrow();
    expect(() => build(ComputationKind.AVERAGE).getValue()).toThrow();
  });

  it("COUNT returns 0 on the empty set (§17.94 risk #2 — does NOT raise)", () => {
    expect(build(ComputationKind.COUNT).getValue()).toBe(0);
  });

  it("getValue() may legitimately return a value outside the lenient range (LenientRange is opt-in)", () => {
    expect(build(ComputationKind.SUM, {}, 60, 70, 80).getValue()).toBe(210);
    expect(range().contains(210)).toBe(false);
  });
});

describe("ComputedBusinessScoreNode<T> — setComputationKind invalidates the cached strategy (§17.98)", () => {
  it("flips both `computationKind` AND `computation` to the new kind in one mutation", () => {
    const node = build(ComputationKind.SUM, {}, 10, 20, 30);
    expect(node.getValue()).toBe(60);
    node.setComputationKind(ComputationKind.AVERAGE);
    expect(node.computationKind).toBe(ComputationKind.AVERAGE);
    expect(node.computation).toBe(AverageComputation.INSTANCE);
    expect(node.getValue()).toBe(20);
  });
});

describe("ComputedBusinessScoreNode<T> — audit-only history (§17.98; §17.94 D5)", () => {
  it("setValue throws ComputationOverrideError (history is audit-only; range gate bypassed harmlessly)", () => {
    const node = build(ComputationKind.SUM, {}, 10);
    expect(() => node.setValue(50)).toThrow(ComputationOverrideError);
  });

  it("addValue throws ComputationOverrideError (no value reaches the range.requireValue gate)", () => {
    const node = build(ComputationKind.SUM, {}, 10);
    expect(() => node.addValue(T("2026-04-01T00:00:00Z"), 999)).toThrow(ComputationOverrideError);
  });

  it("entries() stays empty + frozen (audit trail readable, never operator-populated)", () => {
    const node = build(ComputationKind.SUM, {}, 10);
    expect(node.entries()).toEqual([]);
    expect(Object.isFrozen(node.entries())).toBe(true);
  });
});
