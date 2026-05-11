import { describe, expect, it } from "vitest";

import {
  mapFocusedToViewModelV4,
  mapNodeToViewModelV4,
  ViewModelMappingErrorV4,
} from "../../../../../adapters/ui/views/viewModelMapperV4.js";
import type { Clock } from "../../../../../domain/capabilities/Clock.js";
import { BusinessScoreNode } from "../../../../../domain/nodes/BusinessScoreNode.js";
import { Node } from "../../../../../domain/nodes/Node.js";
import { StrictRangeNode } from "../../../../../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../../../../../domain/nodes/TextNodeV4.js";
import { NumericComparator } from "../../../../../domain/values/Comparator.js";
import { ObjectiveV4 } from "../../../../../domain/values/ObjectiveV4.js";
import { LenientRange, StrictRange } from "../../../../../domain/values/Range.js";
import { Timestamp } from "../../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const NOW = new Date("2026-05-11T10:00:00Z");
const clock: Clock = { now: () => Timestamp.of(NOW) };
const w = (n: number = 1): Weight => Weight.of(n);
const lenient = (): LenientRange<number> =>
  LenientRange.of(
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    NumericComparator.INSTANCE,
  );
const strict = (min: number, max: number): StrictRange<number> =>
  StrictRange.of(min, max, NumericComparator.INSTANCE);
const obj = (
  value: number = 100,
  at: string = "2026-12-31T00:00:00Z",
): ObjectiveV4<number> => ObjectiveV4.of(value, T(at));

const buildBSC = (
  id: string,
  options: {
    title?: string;
    description?: string;
    weight?: number;
    history?: [string, number][];
    objective?: ObjectiveV4<number>;
    unit?: string;
  } = {},
): BusinessScoreNode<number> => {
  const node = new BusinessScoreNode<number>(
    id,
    options.title ?? id,
    w(options.weight ?? 1),
    options.description ?? "",
    clock,
    lenient(),
    options.objective ?? obj(),
    options.unit ?? "",
  );
  for (const [iso, v] of options.history ?? []) node.addValue(T(iso), v);
  return node;
};

const buildText = (
  id: string,
  options: { title?: string; weight?: number; history?: [string, string][] } = {},
): TextNodeV4 => {
  const node = new TextNodeV4(id, options.title ?? id, w(options.weight ?? 1), clock);
  for (const [iso, v] of options.history ?? []) node.addValue(T(iso), v);
  return node;
};

describe("viewModelMapperV4 (§17.91 — Phase B.3: v4-aware view-model mapper)", () => {
  describe("mapNodeToViewModelV4 — TextNodeV4 branch", () => {
    it("maps id/title and the latest history entry's value + ISO date", () => {
      const text = buildText("t1", {
        title: "Sales notes",
        history: [
          ["2026-01-01T00:00:00Z", "Q1"],
          ["2026-04-01T00:00:00Z", "Q2"],
        ],
      });
      const vm = mapNodeToViewModelV4(text);
      expect(vm).toMatchObject({
        kind: "TextNode",
        id: "t1",
        title: "Sales notes",
        value: { text: "Q2", dateIso: "2026-04-01T00:00:00.000Z" },
      });
    });

    it("empty history → empty text + empty dateIso + empty dateColor", () => {
      const vm = mapNodeToViewModelV4(buildText("empty"));
      expect(vm).toMatchObject({
        kind: "TextNode",
        value: { text: "", dateIso: "", dateColor: "" },
      });
    });

    it("dateColor is non-empty when dateIso is non-empty (deterministic via options.now)", () => {
      const text = buildText("t", { history: [["2026-04-01T00:00:00Z", "x"]] });
      const vm = mapNodeToViewModelV4(text, { now: NOW });
      if (vm.kind !== "TextNode") throw new Error("expected TextNode");
      expect(vm.value.dateColor).toMatch(/^rgb\(/);
    });
  });

  describe("mapNodeToViewModelV4 — BusinessScoreNode branch", () => {
    it("leaf BSC with history → recordedValue VM with unit + dateIso", () => {
      const bsc = buildBSC("b", {
        title: "Revenue",
        description: "Quarterly revenue",
        history: [["2026-04-01T00:00:00Z", 75]],
        unit: "%",
      });
      const vm = mapNodeToViewModelV4(bsc);
      expect(vm).toMatchObject({
        kind: "BusinessScoreCardNode",
        id: "b",
        title: "Revenue",
        description: "Quarterly revenue",
        value: { kind: "recordedValue", value: 75, unit: "%", dateIso: "2026-04-01T00:00:00.000Z" },
        dateIso: "2026-04-01T00:00:00.000Z",
      });
    });

    it("description on TextNodeV4-style getDescription override is respected (mirrors v3 §17.15 indirectly)", () => {
      const bsc = buildBSC("b", { description: "from-field" });
      const vm = mapNodeToViewModelV4(bsc);
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.description).toBe("from-field");
    });

    it("parent BSC with eligible children → computedMean VM with unit + topmost dateIso from children", () => {
      const parent = buildBSC("p", { unit: "%" });
      parent.attach(buildBSC("c1", { weight: 1, history: [["2026-01-01T00:00:00Z", 20]] }));
      parent.attach(buildBSC("c2", { weight: 1, history: [["2026-06-01T00:00:00Z", 80]] }));
      const vm = mapNodeToViewModelV4(parent);
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.value).toEqual({ kind: "computedMean", mean: 50, unit: "%" });
      expect(vm.dateIso).toBe("2026-06-01T00:00:00.000Z");
    });

    it("parent BSC with no eligible children → childrenCount VM (no unit field per §17.91 same as v3)", () => {
      const parent = buildBSC("p");
      parent.attach(buildText("a"));
      parent.attach(buildText("b"));
      const vm = mapNodeToViewModelV4(parent);
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.value).toEqual({ kind: "childrenCount", n: 2 });
    });

    it("empty leaf BSC → childrenCount n=0 + empty dateIso/dateColor", () => {
      const vm = mapNodeToViewModelV4(buildBSC("empty"));
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.value).toEqual({ kind: "childrenCount", n: 0 });
      expect(vm.dateIso).toBe("");
      expect(vm.dateColor).toBe("");
    });

    it("objective.targetValue + targetDateIso + unit propagate from BSC's ObjectiveV4 + unit slot", () => {
      const bsc = buildBSC("b", {
        objective: obj(80, "2026-12-31T00:00:00Z"),
        unit: "ms",
      });
      const vm = mapNodeToViewModelV4(bsc);
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.objective.targetValue).toBe(80);
      expect(vm.objective.targetDateIso).toBe("2026-12-31T00:00:00.000Z");
      expect(vm.objective.unit).toBe("ms");
    });

    it("objective.valueColor non-empty for recordedValue with finite number", () => {
      const bsc = buildBSC("b", {
        history: [["2026-04-01T00:00:00Z", 50]],
        objective: obj(100, "2026-12-31T00:00:00Z"),
      });
      const vm = mapNodeToViewModelV4(bsc, { now: NOW });
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.objective.valueColor).toMatch(/^rgb\(/);
    });

    it("objective.warningColor + trendArrow are empty/null for non-recordedValue branches (computed parent)", () => {
      const parent = buildBSC("p");
      parent.attach(buildBSC("c1", { history: [["2026-01-01T00:00:00Z", 20]] }));
      parent.attach(buildBSC("c2", { history: [["2026-06-01T00:00:00Z", 80]] }));
      const vm = mapNodeToViewModelV4(parent, { now: NOW });
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.objective.warningColor).toBe("");
      expect(vm.objective.trendArrow).toBeNull();
    });

    it("objective.warningColor + trendArrow are populated for recordedValue with multi-point history", () => {
      const bsc = buildBSC("b", {
        history: [
          ["2026-01-01T00:00:00Z", 0],
          ["2026-02-01T00:00:00Z", 10],
          ["2026-03-01T00:00:00Z", 20],
        ],
        objective: obj(100, "2026-12-31T00:00:00Z"),
      });
      const vm = mapNodeToViewModelV4(bsc, { now: NOW });
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.objective.trendArrow).not.toBeNull();
    });
  });

  describe("mapNodeToViewModelV4 — StrictRangeNode branch", () => {
    it("StrictRangeNode renders as BSC kind with empty unit + degenerate empty objective", () => {
      const node = new StrictRangeNode<number>("s", "Latency", w(1), "", clock, strict(0, 100));
      node.addValue(T("2026-04-01T00:00:00Z"), 75);
      const vm = mapNodeToViewModelV4(node);
      expect(vm.kind).toBe("BusinessScoreCardNode");
      if (vm.kind !== "BusinessScoreCardNode") return;
      expect(vm.value).toEqual({
        kind: "recordedValue",
        value: 75,
        unit: "",
        dateIso: "2026-04-01T00:00:00.000Z",
      });
      expect(vm.objective.targetDateIso).toBe("");
      expect(vm.objective.unit).toBe("");
      expect(vm.objective.valueColor).toBe("");
    });
  });

  describe("error path", () => {
    it("throws ViewModelMappingErrorV4 on a v4 Node that is neither TextNodeV4 nor RangedValueNode", () => {
      class StubNode extends Node {
        constructor() {
          super("stub", "Stub", w(1));
        }
      }
      expect(() => mapNodeToViewModelV4(new StubNode())).toThrow(ViewModelMappingErrorV4);
      expect(() => mapNodeToViewModelV4(new StubNode())).toThrow(/unsupported v4 Node subclass/);
    });
  });

  describe("mapFocusedToViewModelV4", () => {
    it("returns center VM + children VMs in the same order as input + appends a plus slot when capacity allows", () => {
      const center = buildBSC("center", { unit: "%" });
      const c1 = buildBSC("c1", { history: [["2026-01-01T00:00:00Z", 10]] });
      const c2 = buildText("c2", { history: [["2026-02-01T00:00:00Z", "x"]] });
      const focused = mapFocusedToViewModelV4(center, [c1, c2]);
      expect(focused.center.id).toBe("center");
      expect(focused.children.length).toBe(3); // c1 + c2 + plus
      expect(focused.children[0].slot).toBe("node");
      expect(focused.children[1].slot).toBe("node");
      expect(focused.children[2].slot).toBe("plus");
      if (focused.children[2].slot !== "plus") return;
      expect(focused.children[2].parentId).toBe("center");
    });

    it("plus slot is omitted when capacity is exhausted (parent at MAX_CHILDREN_V4=12)", () => {
      const center = buildBSC("p");
      const children: BusinessScoreNode<number>[] = [];
      for (let i = 0; i < 12; i++) {
        const c = buildBSC(`c${i}`);
        center.attach(c);
        children.push(c);
      }
      const focused = mapFocusedToViewModelV4(center, children);
      expect(focused.children.length).toBe(12);
      expect(focused.children.every((s) => s.slot === "node")).toBe(true);
    });

    it("propagates options.now to every node's VM", () => {
      const center = buildBSC("p", { history: [["2026-04-01T00:00:00Z", 10]] });
      const child = buildText("t", { history: [["2026-04-01T00:00:00Z", "x"]] });
      const focused = mapFocusedToViewModelV4(center, [child], { now: NOW });
      if (focused.center.kind !== "BusinessScoreCardNode") throw new Error();
      expect(focused.center.dateColor).toMatch(/^rgb\(/);
      const childSlot = focused.children[0];
      if (childSlot.slot !== "node") throw new Error();
      if (childSlot.vm.kind !== "TextNode") throw new Error();
      expect(childSlot.vm.value.dateColor).toMatch(/^rgb\(/);
    });
  });
});
