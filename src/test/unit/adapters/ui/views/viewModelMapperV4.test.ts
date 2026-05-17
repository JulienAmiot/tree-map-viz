import { describe, expect, it } from "vitest";

import {
  mapFocusedToViewModelV4,
  mapNodeToViewModelV4,
  ViewModelMappingErrorV4,
} from "../../../../../adapters/ui/views/viewModelMapperV4.js";
import type { Clock } from "../../../../../domain/capabilities/Clock.js";
import { BusinessScoreCardV4 } from "../../../../../domain/cards/BusinessScoreCardV4.js";
import { ComputationKind } from "../../../../../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../../../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../../../domain/nodes/ComputedNode.js";
import { Node } from "../../../../../domain/nodes/Node.js";
import { StrictRangeNode } from "../../../../../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../../../../../domain/nodes/TextNodeV4.js";
import { NumericComparator } from "../../../../../domain/values/Comparator.js";
import { Objective } from "../../../../../domain/values/Objective.js";
import { LenientRange, StrictRange } from "../../../../../domain/values/Range.js";
import { Timestamp } from "../../../../../domain/values/Timestamp.js";
import { Unit } from "../../../../../domain/values/Unit.js";
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
): Objective<number> => Objective.of(value, T(at));

const buildBSC = (
  id: string,
  options: {
    title?: string;
    description?: string;
    weight?: number;
    history?: [string, number][];
    objective?: Objective<number>;
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
    { objective: options.objective ?? obj(), unit: options.unit ?? "" },
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

    it("objective.targetValue + targetDateIso + unit propagate from BSC's Objective + unit slot", () => {
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

    it("plus slot is omitted when capacity is exhausted (parent at MAX_CHILDREN=12)", () => {
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

  describe("§17.104b — ComputedNode + ComputedBusinessScoreNode branches", () => {
    const KIND_NAMES = ComputationKind.ALL.map((k) => k.name);

    it("ComputedNode → ComputedNode VM with strategy-applied numeric value, computationKind name + availableKinds list", () => {
      const node = new ComputedNode<number>("cn", "Sum", w(), "", clock, ComputationKind.SUM);
      node.attach(buildBSC("c1", { history: [["2026-01-01T00:00:00Z", 10]] }));
      node.attach(buildBSC("c2", { history: [["2026-01-01T00:00:00Z", 7]] }));
      const vm = mapNodeToViewModelV4(node);
      expect(vm).toMatchObject({
        kind: "ComputedNode",
        id: "cn",
        title: "Sum",
        value: { kind: "numeric", value: 17, unit: "" },
        computationKind: "SUM",
      });
      if (vm.kind !== "ComputedNode") throw new Error("expected ComputedNode");
      expect(vm.availableKinds).toEqual(KIND_NAMES);
    });

    it("ComputedNode with no eligible children → empty VM carrying the EmptyChildrenError reason; setComputationKind flips the dropdown", () => {
      const node = new ComputedNode<number>("cn", "Avg", w(), "", clock, ComputationKind.AVERAGE);
      const vm = mapNodeToViewModelV4(node);
      if (vm.kind !== "ComputedNode") throw new Error("expected ComputedNode");
      expect(vm.value.kind).toBe("empty");
      if (vm.value.kind !== "empty") throw new Error();
      expect(vm.value.reason).toMatch(/AVERAGE/);

      node.setComputationKind(ComputationKind.MAX);
      const flipped = mapNodeToViewModelV4(node);
      if (flipped.kind !== "ComputedNode") throw new Error();
      expect(flipped.computationKind).toBe("MAX");
    });

    it("ComputedBusinessScoreNode → CBSC VM with strategy value + BSC objective row + corner timestamp; trend arrow stays null (no recorded-value branch)", () => {
      const cbsn = new ComputedBusinessScoreNode<number>(
        "cbsn", "Avg score", w(), "Quarter rollup", clock, lenient(),
        { objective: obj(100, "2026-12-31T00:00:00Z"), initialKind: ComputationKind.AVERAGE, unit: "%" },
      );
      cbsn.attach(buildBSC("c1", { weight: 1, history: [["2026-04-01T00:00:00Z", 40]] }));
      cbsn.attach(buildBSC("c2", { weight: 1, history: [["2026-06-01T00:00:00Z", 80]] }));
      const vm = mapNodeToViewModelV4(cbsn, { now: NOW });
      expect(vm).toMatchObject({
        kind: "ComputedBusinessScoreNode",
        id: "cbsn",
        title: "Avg score",
        description: "Quarter rollup",
        value: { kind: "numeric", value: 60, unit: "%" },
        computationKind: "AVERAGE",
        dateIso: "2026-06-01T00:00:00.000Z",
      });
      if (vm.kind !== "ComputedBusinessScoreNode") throw new Error();
      expect(vm.availableKinds).toEqual(KIND_NAMES);
      expect(vm.objective.targetValue).toBe(100);
      expect(vm.objective.targetDateIso).toBe("2026-12-31T00:00:00.000Z");
      expect(vm.objective.unit).toBe("%");
      expect(vm.objective.valueColor).toMatch(/^rgb\(/);
      expect(vm.objective.warningColor).toBe("");
      expect(vm.objective.trendArrow).toBeNull();
      expect(vm.dateColor).toMatch(/^rgb\(/);
    });

    it("CBSN unit resolved through the §17.100.5 card sidecar when present (same precedence as BSC)", () => {
      const cbsn = new ComputedBusinessScoreNode<number>(
        "cbsn", "X", w(), "", clock, lenient(),
        { objective: obj(), initialKind: ComputationKind.SUM, unit: "old" },
      );
      cbsn.attach(buildBSC("c1", { history: [["2026-04-01T00:00:00Z", 5]] }));
      const cards = new Map([["cbsn", new BusinessScoreCardV4(cbsn as unknown as BusinessScoreNode<number>, Unit.of("kg"))]]);
      const vm = mapNodeToViewModelV4(cbsn, { cards });
      if (vm.kind !== "ComputedBusinessScoreNode" || vm.value.kind !== "numeric") throw new Error();
      expect(vm.value.unit).toBe("kg");
      expect(vm.objective.unit).toBe("kg");
    });
  });

  describe("§17.100.5 — cards sidecar overrides BSN.unit getter; fallback preserved", () => {
    it("card.getUnit() wins over BSN.unit for both value VM and objective VM", () => {
      const node = buildBSC("b", {
        unit: "old-bsn-unit",
        history: [["2026-04-01T00:00:00Z", 42]],
      });
      const cards = new Map([["b", new BusinessScoreCardV4(node, Unit.of("$"))]]);
      const vm = mapNodeToViewModelV4(node, { cards });
      if (vm.kind !== "BusinessScoreCardNode") throw new Error();
      if (vm.value.kind !== "recordedValue") throw new Error();
      expect(vm.value.unit).toBe("$");
      expect(vm.objective.unit).toBe("$");
    });

    it("absent card → falls back to BSN.unit (legacy §17.91 path); empty cards map equivalent to omitted", () => {
      const node = buildBSC("b", { unit: "ms", history: [["2026-04-01T00:00:00Z", 9]] });
      const vmEmpty = mapNodeToViewModelV4(node, { cards: new Map() });
      const vmOmitted = mapNodeToViewModelV4(node);
      if (vmEmpty.kind !== "BusinessScoreCardNode" || vmOmitted.kind !== "BusinessScoreCardNode") throw new Error();
      if (vmEmpty.value.kind !== "recordedValue" || vmOmitted.value.kind !== "recordedValue") throw new Error();
      expect(vmEmpty.value.unit).toBe("ms");
      expect(vmOmitted.value.unit).toBe("ms");
      expect(vmEmpty.objective.unit).toBe("ms");
    });

    it("mapFocusedToViewModelV4 threads cards through to every child's VM", () => {
      const center = buildBSC("p", { unit: "old" });
      const child = buildBSC("c", { unit: "old-child", history: [["2026-04-01T00:00:00Z", 5]] });
      const cards = new Map([
        ["p", new BusinessScoreCardV4(center, Unit.of("kg"))],
        ["c", new BusinessScoreCardV4(child, Unit.of("g"))],
      ]);
      const focused = mapFocusedToViewModelV4(center, [child], { cards });
      if (focused.center.kind !== "BusinessScoreCardNode") throw new Error();
      expect(focused.center.objective.unit).toBe("kg");
      const slot = focused.children[0];
      if (slot.slot !== "node" || slot.vm.kind !== "BusinessScoreCardNode") throw new Error();
      if (slot.vm.value.kind !== "recordedValue") throw new Error();
      expect(slot.vm.value.unit).toBe("g");
    });
  });
});
