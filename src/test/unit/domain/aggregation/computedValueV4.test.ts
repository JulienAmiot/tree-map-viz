import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { computedValueV4 } from "../../../../domain/aggregation/computedValueV4.js";
import { BusinessScoreNode } from "../../../../domain/nodes/BusinessScoreNode.js";
import { StrictRangeNode } from "../../../../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../../../../domain/nodes/TextNodeV4.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import { ObjectiveV4 } from "../../../../domain/values/ObjectiveV4.js";
import { LenientRange, StrictRange } from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const clock: Clock = { now: () => T("2026-05-11T10:00:00Z") };
const w = (n: number): Weight => Weight.of(n);
const lenient = (): LenientRange<number> =>
  LenientRange.of(
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    NumericComparator.INSTANCE,
  );
const strict = (min: number, max: number): StrictRange<number> =>
  StrictRange.of(min, max, NumericComparator.INSTANCE);
const obj = (): ObjectiveV4<number> => ObjectiveV4.of(100, T("2026-12-31T00:00:00Z"));

const buildBSC = (
  id: string,
  weight = 1,
  history: [string, number][] = [],
): BusinessScoreNode<number> => {
  const node = new BusinessScoreNode<number>(id, id, w(weight), "", clock, lenient(), obj());
  for (const [iso, v] of history) node.addValue(T(iso), v);
  return node;
};

const buildStrictBSC = (
  id: string,
  weight = 1,
  range: [number, number] = [0, 100],
  history: [string, number][] = [],
): StrictRangeNode<number> => {
  const node = new StrictRangeNode<number>(id, id, w(weight), "", clock, strict(range[0], range[1]));
  for (const [iso, v] of history) node.addValue(T(iso), v);
  return node;
};

const buildText = (id: string, weight = 1, history: [string, string][] = []): TextNodeV4 => {
  const node = new TextNodeV4(id, id, w(weight), clock);
  for (const [iso, v] of history) node.addValue(T(iso), v);
  return node;
};

describe("computedValueV4 (§17.89 — Phase B.1: v4-aware aggregation, structural rule)", () => {
  describe("leaf BSC (no children)", () => {
    it("returns recordedValue with the most-recent entry's value + asOf when history is non-empty", () => {
      const bsc = buildBSC("a", 1, [
        ["2026-01-01T00:00:00Z", 10],
        ["2026-03-01T00:00:00Z", 30],
        ["2026-02-01T00:00:00Z", 20],
      ]);
      const r = computedValueV4(bsc);
      expect(r.kind).toBe("recordedValue");
      if (r.kind !== "recordedValue") return;
      expect(r.value).toBe(30);
      expect(r.asOf.moment.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    });

    it("returns childrenCount n=0 when history is empty (no number to grade)", () => {
      const bsc = buildBSC("empty");
      const r = computedValueV4(bsc);
      expect(r).toEqual({ kind: "childrenCount", n: 0 });
    });

    it("works equally for StrictRangeNode leaves", () => {
      const node = buildStrictBSC("s", 1, [0, 100], [["2026-04-01T00:00:00Z", 75]]);
      const r = computedValueV4(node);
      expect(r.kind).toBe("recordedValue");
      if (r.kind !== "recordedValue") return;
      expect(r.value).toBe(75);
    });
  });

  describe("parent BSC with children (structural aggregation)", () => {
    it("weighted-mean of two leaf children with explicit weights", () => {
      const parent = buildBSC("p");
      parent.attach(buildBSC("a", 1, [["2026-01-01T00:00:00Z", 10]]));
      parent.attach(buildBSC("b", 3, [["2026-01-01T00:00:00Z", 30]]));
      const r = computedValueV4(parent);
      expect(r.kind).toBe("computedValue");
      if (r.kind !== "computedValue") return;
      expect(r.value).toBe(25);
    });

    it("recurses through aggregator child (v4 improvement vs v3 one-level)", () => {
      const root = buildBSC("root");
      const aggChild = buildBSC("agg", 1);
      aggChild.attach(buildBSC("g1", 1, [["2026-01-01T00:00:00Z", 50]]));
      aggChild.attach(buildBSC("g2", 1, [["2026-01-01T00:00:00Z", 100]]));
      root.attach(aggChild);
      root.attach(buildBSC("leaf", 1, [["2026-01-01T00:00:00Z", 0]]));
      const r = computedValueV4(root);
      expect(r.kind).toBe("computedValue");
      if (r.kind !== "computedValue") return;
      expect(r.value).toBe(37.5);
    });

    it("ignores TextNodeV4 children (text doesn't aggregate)", () => {
      const parent = buildBSC("p");
      parent.attach(buildText("note", 1, [["2026-01-01T00:00:00Z", "hello"]]));
      parent.attach(buildBSC("num", 1, [["2026-01-01T00:00:00Z", 42]]));
      const r = computedValueV4(parent);
      expect(r.kind).toBe("computedValue");
      if (r.kind !== "computedValue") return;
      expect(r.value).toBe(42);
    });

    it("returns childrenCount n=total when all children are non-RangedValueNode (TextNodeV4 only)", () => {
      const parent = buildBSC("p");
      parent.attach(buildText("a"));
      parent.attach(buildText("b"));
      const r = computedValueV4(parent);
      expect(r).toEqual({ kind: "childrenCount", n: 2 });
    });

    it("returns childrenCount n=total when every eligible child has empty history (no usable numbers)", () => {
      const parent = buildBSC("p");
      parent.attach(buildBSC("e1"));
      parent.attach(buildBSC("e2"));
      const r = computedValueV4(parent);
      expect(r).toEqual({ kind: "childrenCount", n: 2 });
    });

    it("partial-eligibility: weighted mean uses only children with finite numbers; weights of empty children excluded", () => {
      const parent = buildBSC("p");
      parent.attach(buildBSC("a", 5, [["2026-01-01T00:00:00Z", 100]]));
      parent.attach(buildBSC("b-empty", 9));
      const r = computedValueV4(parent);
      expect(r.kind).toBe("computedValue");
      if (r.kind !== "computedValue") return;
      expect(r.value).toBe(100);
    });

    it("§17.93 — honours v3 eligibleForParentComputation=false: ineligible BSC children are excluded from the mean", () => {
      const parent = buildBSC("p");
      const ineligibleA = new BusinessScoreNode<number>(
        "a", "a", w(1), "", clock, lenient(), obj(), "%", false, false,
      );
      ineligibleA.addValue(T("2026-01-01T00:00:00Z"), 10);
      const ineligibleB = new BusinessScoreNode<number>(
        "b", "b", w(1), "", clock, lenient(), obj(), "%", false, false,
      );
      ineligibleB.addValue(T("2026-01-01T00:00:00Z"), 20);
      parent.attach(ineligibleA);
      parent.attach(ineligibleB);
      const r = computedValueV4(parent);
      expect(r).toEqual({ kind: "childrenCount", n: 2 });
    });

    it("§17.93 — honours v3 computed=true: a flagged-computed leaf with own history returns childrenCount n=0 (not recordedValue)", () => {
      const flaggedComputed = new BusinessScoreNode<number>(
        "f", "f", w(1), "", clock, lenient(), obj(), "%", true, false,
      );
      flaggedComputed.addValue(T("2026-01-01T00:00:00Z"), 99);
      const r = computedValueV4(flaggedComputed);
      expect(r).toEqual({ kind: "childrenCount", n: 0 });
    });

    it("§17.93 — honours v3 computed=true on parent: ignores own history, aggregates from eligible children", () => {
      const flaggedComputed = new BusinessScoreNode<number>(
        "f", "f", w(1), "", clock, lenient(), obj(), "%", true, false,
      );
      flaggedComputed.addValue(T("2026-01-01T00:00:00Z"), 99);
      flaggedComputed.attach(buildBSC("c1", 1, [["2026-02-01T00:00:00Z", 100]]));
      flaggedComputed.attach(buildBSC("c2", 1, [["2026-02-01T00:00:00Z", 60]]));
      const r = computedValueV4(flaggedComputed);
      expect(r.kind).toBe("computedValue");
      if (r.kind !== "computedValue") return;
      expect(r.value).toBe(80);
    });

    it("StrictRangeNode children participate in aggregation alongside BusinessScoreNode children", () => {
      const parent = buildBSC("p");
      parent.attach(buildBSC("a", 1, [["2026-01-01T00:00:00Z", 20]]));
      parent.attach(buildStrictBSC("b", 1, [0, 100], [["2026-01-01T00:00:00Z", 80]]));
      const r = computedValueV4(parent);
      expect(r.kind).toBe("computedValue");
      if (r.kind !== "computedValue") return;
      expect(r.value).toBe(50);
    });
  });
});
