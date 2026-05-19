import { describe, expect, it } from "vitest";

import {
  mapFocusedToViewModel,
  mapNodeToViewModel,
  ViewModelMappingError,
} from "../../../../../adapters/ui/views/viewModelMapper.js";
import type { Clock } from "../../../../../domain/capabilities/Clock.js";
import { BusinessScoreCard } from "../../../../../domain/cards/BusinessScoreCard.js";
import { ComputationKind } from "../../../../../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../../../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../../../domain/nodes/ComputedNode.js";
import { Node } from "../../../../../domain/nodes/Node.js";
import { PictureNode } from "../../../../../domain/nodes/PictureNode.js";
import { StrictRangeNode } from "../../../../../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../../../../../domain/nodes/TextNode.js";
import { WorkflowNode } from "../../../../../domain/nodes/WorkflowNode.js";
import { URLNode } from "../../../../../domain/nodes/URLNode.js";
import { NumericComparator } from "../../../../../domain/values/Comparator.js";
import { Objective } from "../../../../../domain/values/Objective.js";
import { LenientRange, StrictRange } from "../../../../../domain/values/Range.js";
import { Timestamp } from "../../../../../domain/values/Timestamp.js";
import { Unit } from "../../../../../domain/values/Unit.js";
import { Weight } from "../../../../../domain/values/Weight.js";
import { WorkflowStatus } from "../../../../../domain/values/WorkflowStatus.js";

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
): TextNode => {
  const node = new TextNode(id, options.title ?? id, w(options.weight ?? 1), clock);
  for (const [iso, v] of options.history ?? []) node.addValue(T(iso), v);
  return node;
};

const buildWorkflow = (
  id: string,
  options: {
    title?: string;
    weight?: number;
    statusId?: string;
    history?: [string, string][];
  } = {},
): WorkflowNode => {
  const node = new WorkflowNode(
    id,
    options.title ?? id,
    w(options.weight ?? 1),
    clock,
    options.statusId ?? "plan",
  );
  for (const [iso, v] of options.history ?? []) node.addValue(T(iso), v);
  return node;
};

const STATUSES = [
  WorkflowStatus.of("plan", "PLAN", "rgb(161, 161, 170)"),
  WorkflowStatus.of("do", "DO", "rgb(59, 130, 246)"),
  WorkflowStatus.of("check", "CHECK", "rgb(34, 197, 94)"),
  WorkflowStatus.of("act", "ACT", "rgb(217, 119, 6)"),
];

describe("viewModelMapperV4 (§17.91 — Phase B.3: v4-aware view-model mapper)", () => {
  describe("mapNodeToViewModel — TextNode branch", () => {
    it("maps id/title and the latest history entry's value + ISO date", () => {
      const text = buildText("t1", {
        title: "Sales notes",
        history: [
          ["2026-01-01T00:00:00Z", "Q1"],
          ["2026-04-01T00:00:00Z", "Q2"],
        ],
      });
      const vm = mapNodeToViewModel(text);
      expect(vm).toMatchObject({
        kind: "TextNode",
        id: "t1",
        title: "Sales notes",
        value: { text: "Q2", dateIso: "2026-04-01T00:00:00.000Z" },
      });
    });

    it("empty history → empty text + empty dateIso + empty dateColor", () => {
      const vm = mapNodeToViewModel(buildText("empty"));
      expect(vm).toMatchObject({
        kind: "TextNode",
        value: { text: "", dateIso: "", dateColor: "" },
      });
    });

    it("dateColor is non-empty when dateIso is non-empty (deterministic via options.now)", () => {
      const text = buildText("t", { history: [["2026-04-01T00:00:00Z", "x"]] });
      const vm = mapNodeToViewModel(text, { now: NOW });
      if (vm.kind !== "TextNode") throw new Error("expected TextNode");
      expect(vm.value.dateColor).toMatch(/^rgb\(/);
    });
  });

  describe("mapNodeToViewModel — WorkflowNode branch (§17.117)", () => {
    it("emits kind=\"WorkflowNode\" with the value / dateIso / dateColor mirroring the TextNode branch AND the status object resolved against options.workflowStatuses", () => {
      const wf = buildWorkflow("w", {
        statusId: "do",
        history: [["2026-04-01T00:00:00Z", "ready for review"]],
      });
      const vm = mapNodeToViewModel(wf, { workflowStatuses: STATUSES, now: NOW });
      expect(vm).toMatchObject({
        kind: "WorkflowNode",
        id: "w",
        value: { text: "ready for review", dateIso: "2026-04-01T00:00:00.000Z" },
        status: { id: "do", label: "DO", color: "rgb(59, 130, 246)" },
      });
      if (vm.kind !== "WorkflowNode") throw new Error("expected WorkflowNode");
      expect(vm.value.dateColor).toMatch(/^rgb\(/);
    });

    it("WorkflowNode wins over the generic TextNode branch (instanceof order matters; the more-specific kind paints the VM)", () => {
      const wf = buildWorkflow("w");
      const vm = mapNodeToViewModel(wf, { workflowStatuses: STATUSES });
      expect(vm.kind).toBe("WorkflowNode");
      // Defensive: a plain TextNode in the same tree still maps to
      // the TextNode branch (siblings, not subsumed).
      const tn = buildText("t");
      expect(mapNodeToViewModel(tn, { workflowStatuses: STATUSES }).kind).toBe("TextNode");
    });

    it("orphan statusId (id not in the workflow-status table) falls back to a muted-grey placeholder badge with the id uppercased — does NOT throw", () => {
      const wf = buildWorkflow("w", { statusId: "ghost" });
      const vm = mapNodeToViewModel(wf, { workflowStatuses: STATUSES });
      if (vm.kind !== "WorkflowNode") throw new Error("expected WorkflowNode");
      expect(vm.status).toEqual({
        id: "ghost",
        label: "GHOST",
        color: "rgb(150, 150, 150)",
      });
    });

    it("missing options.workflowStatuses (e.g. unit fixture forgot to pass it) treats every id as orphan rather than throwing", () => {
      const wf = buildWorkflow("w", { statusId: "plan" });
      const vm = mapNodeToViewModel(wf);
      if (vm.kind !== "WorkflowNode") throw new Error("expected WorkflowNode");
      expect(vm.status.color).toBe("rgb(150, 150, 150)");
      expect(vm.status.label).toBe("PLAN");
    });

    it("empty history → empty text + empty dateIso + empty dateColor (same defensive contract as TextNode)", () => {
      const vm = mapNodeToViewModel(buildWorkflow("w"), { workflowStatuses: STATUSES });
      expect(vm).toMatchObject({
        kind: "WorkflowNode",
        value: { text: "", dateIso: "", dateColor: "" },
      });
    });

    it("\u00a717.121f \u2014 bakes the focused board's full status table into availableStatuses so the AsParent inline picker can render an <option> per entry", () => {
      const vm = mapNodeToViewModel(buildWorkflow("w", { statusId: "do" }), {
        workflowStatuses: STATUSES,
      });
      if (vm.kind !== "WorkflowNode") throw new Error("expected WorkflowNode");
      expect(vm.availableStatuses).toEqual([
        { id: "plan", label: "PLAN", color: "rgb(161, 161, 170)" },
        { id: "do", label: "DO", color: "rgb(59, 130, 246)" },
        { id: "check", label: "CHECK", color: "rgb(34, 197, 94)" },
        { id: "act", label: "ACT", color: "rgb(217, 119, 6)" },
      ]);
    });

    it("\u00a717.121f \u2014 missing options.workflowStatuses collapses availableStatuses to an empty list (the inline picker falls back to the read-only badge)", () => {
      const vm = mapNodeToViewModel(buildWorkflow("w", { statusId: "plan" }));
      if (vm.kind !== "WorkflowNode") throw new Error("expected WorkflowNode");
      expect(vm.availableStatuses).toEqual([]);
    });
  });

  describe("mapNodeToViewModel — BusinessScoreNode branch", () => {
    it("leaf BSC with history → recordedValue VM with unit + dateIso", () => {
      const bsc = buildBSC("b", {
        title: "Revenue",
        description: "Quarterly revenue",
        history: [["2026-04-01T00:00:00Z", 75]],
        unit: "%",
      });
      const vm = mapNodeToViewModel(bsc);
      expect(vm).toMatchObject({
        kind: "BusinessScoreCardNode",
        id: "b",
        title: "Revenue",
        description: "Quarterly revenue",
        value: { kind: "recordedValue", value: 75, unit: "%", dateIso: "2026-04-01T00:00:00.000Z" },
        dateIso: "2026-04-01T00:00:00.000Z",
      });
    });

    it("description on TextNode-style getDescription override is respected (mirrors v3 §17.15 indirectly)", () => {
      const bsc = buildBSC("b", { description: "from-field" });
      const vm = mapNodeToViewModel(bsc);
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.description).toBe("from-field");
    });

    it("parent BSC with eligible children → computedMean VM with unit + topmost dateIso from children", () => {
      const parent = buildBSC("p", { unit: "%" });
      parent.attach(buildBSC("c1", { weight: 1, history: [["2026-01-01T00:00:00Z", 20]] }));
      parent.attach(buildBSC("c2", { weight: 1, history: [["2026-06-01T00:00:00Z", 80]] }));
      const vm = mapNodeToViewModel(parent);
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.value).toEqual({ kind: "computedMean", mean: 50, unit: "%" });
      expect(vm.dateIso).toBe("2026-06-01T00:00:00.000Z");
    });

    it("parent BSC with no eligible children → childrenCount VM (no unit field per §17.91 same as v3)", () => {
      const parent = buildBSC("p");
      parent.attach(buildText("a"));
      parent.attach(buildText("b"));
      const vm = mapNodeToViewModel(parent);
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.value).toEqual({ kind: "childrenCount", n: 2 });
    });

    it("empty leaf BSC → childrenCount n=0 + empty dateIso/dateColor", () => {
      const vm = mapNodeToViewModel(buildBSC("empty"));
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
      const vm = mapNodeToViewModel(bsc);
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
      const vm = mapNodeToViewModel(bsc, { now: NOW });
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.objective.valueColor).toMatch(/^rgb\(/);
    });

    it("objective.warningColor + trendArrow are empty/null for non-recordedValue branches (computed parent)", () => {
      const parent = buildBSC("p");
      parent.attach(buildBSC("c1", { history: [["2026-01-01T00:00:00Z", 20]] }));
      parent.attach(buildBSC("c2", { history: [["2026-06-01T00:00:00Z", 80]] }));
      const vm = mapNodeToViewModel(parent, { now: NOW });
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
      const vm = mapNodeToViewModel(bsc, { now: NOW });
      if (vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC");
      expect(vm.objective.trendArrow).not.toBeNull();
    });
  });

  describe("mapNodeToViewModel — StrictRangeNode branch", () => {
    it("StrictRangeNode renders as BSC kind with empty unit + degenerate empty objective", () => {
      const node = new StrictRangeNode<number>("s", "Latency", w(1), "", clock, strict(0, 100));
      node.addValue(T("2026-04-01T00:00:00Z"), 75);
      const vm = mapNodeToViewModel(node);
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
    it("throws ViewModelMappingError on a v4 Node that is neither TextNode nor RangedValueNode", () => {
      class StubNode extends Node {
        constructor() {
          super("stub", "Stub", w(1));
        }
      }
      expect(() => mapNodeToViewModel(new StubNode())).toThrow(ViewModelMappingError);
      expect(() => mapNodeToViewModel(new StubNode())).toThrow(/unsupported v4 Node subclass/);
    });
  });

  describe("mapFocusedToViewModel", () => {
    it("returns center VM + children VMs in the same order as input + appends a plus slot when capacity allows", () => {
      const center = buildBSC("center", { unit: "%" });
      const c1 = buildBSC("c1", { history: [["2026-01-01T00:00:00Z", 10]] });
      const c2 = buildText("c2", { history: [["2026-02-01T00:00:00Z", "x"]] });
      const focused = mapFocusedToViewModel(center, [c1, c2]);
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
      const focused = mapFocusedToViewModel(center, children);
      expect(focused.children.length).toBe(12);
      expect(focused.children.every((s) => s.slot === "node")).toBe(true);
    });

    it("propagates options.now to every node's VM", () => {
      const center = buildBSC("p", { history: [["2026-04-01T00:00:00Z", 10]] });
      const child = buildText("t", { history: [["2026-04-01T00:00:00Z", "x"]] });
      const focused = mapFocusedToViewModel(center, [child], { now: NOW });
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
      const vm = mapNodeToViewModel(node);
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
      const vm = mapNodeToViewModel(node);
      if (vm.kind !== "ComputedNode") throw new Error("expected ComputedNode");
      expect(vm.value.kind).toBe("empty");
      if (vm.value.kind !== "empty") throw new Error();
      expect(vm.value.reason).toMatch(/AVERAGE/);

      node.setComputationKind(ComputationKind.MAX);
      const flipped = mapNodeToViewModel(node);
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
      const vm = mapNodeToViewModel(cbsn, { now: NOW });
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

    it("CBSN with N ineligible children → childrenCount n=N VM (parity with v3 BSC childrenCount branch, §17.114e)", () => {
      // SPEC §13.2 / §17.40 — the strategy raises EmptyChildrenError
      // when no child contributes a number. With at least one child
      // (here: 3 children, two disabled BSCs + one TextNode — none
      // eligible for WEIGHTED_AVERAGE) the mapper surfaces a
      // childrenCount VM (renders as "<n> children" plain text)
      // instead of the strategy-error reason; matches the v3 BSC
      // valueTemplate.ts childrenCount n>0 branch. With zero children
      // the empty branch still wins (covered by the ComputedNode
      // case above) — the distinction lets the view layer keep the
      // strategy-error reason for the empty-tree case while
      // surfacing the operator-readable count for the
      // ineligible-only case.
      const cbsn = new ComputedBusinessScoreNode<number>(
        "cbsn", "Avg", w(), "", clock, lenient(),
        { objective: obj(), initialKind: ComputationKind.WEIGHTED_AVERAGE, unit: "%" },
      );
      const inelA = buildBSC("ineligibleA", { history: [["2026-04-22T00:00:00Z", 10]] });
      const inelB = buildBSC("ineligibleB", { history: [["2026-04-22T00:00:00Z", 20]] });
      inelA.setDisabled(true);
      inelB.setDisabled(true);
      cbsn.attach(inelA);
      cbsn.attach(inelB);
      cbsn.attach(buildText("txt", { history: [] }));
      const vm = mapNodeToViewModel(cbsn);
      if (vm.kind !== "ComputedBusinessScoreNode") throw new Error("expected CBSN VM");
      expect(vm.value.kind).toBe("childrenCount");
      if (vm.value.kind !== "childrenCount") throw new Error();
      expect(vm.value.n).toBe(3);
    });

    it("CBSN unit resolved through the §17.100.5 card sidecar when present (same precedence as BSC)", () => {
      const cbsn = new ComputedBusinessScoreNode<number>(
        "cbsn", "X", w(), "", clock, lenient(),
        { objective: obj(), initialKind: ComputationKind.SUM, unit: "old" },
      );
      cbsn.attach(buildBSC("c1", { history: [["2026-04-01T00:00:00Z", 5]] }));
      const cards = new Map([["cbsn", new BusinessScoreCard(cbsn as unknown as BusinessScoreNode<number>, Unit.of("kg"))]]);
      const vm = mapNodeToViewModel(cbsn, { cards });
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
      const cards = new Map([["b", new BusinessScoreCard(node, Unit.of("$"))]]);
      const vm = mapNodeToViewModel(node, { cards });
      if (vm.kind !== "BusinessScoreCardNode") throw new Error();
      if (vm.value.kind !== "recordedValue") throw new Error();
      expect(vm.value.unit).toBe("$");
      expect(vm.objective.unit).toBe("$");
    });

    it("absent card → falls back to BSN.unit (legacy §17.91 path); empty cards map equivalent to omitted", () => {
      const node = buildBSC("b", { unit: "ms", history: [["2026-04-01T00:00:00Z", 9]] });
      const vmEmpty = mapNodeToViewModel(node, { cards: new Map() });
      const vmOmitted = mapNodeToViewModel(node);
      if (vmEmpty.kind !== "BusinessScoreCardNode" || vmOmitted.kind !== "BusinessScoreCardNode") throw new Error();
      if (vmEmpty.value.kind !== "recordedValue" || vmOmitted.value.kind !== "recordedValue") throw new Error();
      expect(vmEmpty.value.unit).toBe("ms");
      expect(vmOmitted.value.unit).toBe("ms");
      expect(vmEmpty.objective.unit).toBe("ms");
    });

    it("mapFocusedToViewModel threads cards through to every child's VM", () => {
      const center = buildBSC("p", { unit: "old" });
      const child = buildBSC("c", { unit: "old-child", history: [["2026-04-01T00:00:00Z", 5]] });
      const cards = new Map([
        ["p", new BusinessScoreCard(center, Unit.of("kg"))],
        ["c", new BusinessScoreCard(child, Unit.of("g"))],
      ]);
      const focused = mapFocusedToViewModel(center, [child], { cards });
      if (focused.center.kind !== "BusinessScoreCardNode") throw new Error();
      expect(focused.center.objective.unit).toBe("kg");
      const slot = focused.children[0];
      if (slot.slot !== "node" || slot.vm.kind !== "BusinessScoreCardNode") throw new Error();
      if (slot.vm.value.kind !== "recordedValue") throw new Error();
      expect(slot.vm.value.unit).toBe("g");
    });
  });

  /**
   * SPEC §17.119 — PictureNode mapper. Trivial 1:1 projection (title +
   * URL only); no timestamp / objective / colour math. Defensive case:
   * the `now` and `cards` options never affect a picture VM.
   */
  describe("PictureNode (§17.119)", () => {
    it("maps title + imageUrl through verbatim", () => {
      const pic = new PictureNode(
        "p1",
        "Cat",
        w(),
        "https://example.com/cat.jpg",
      );
      const vm = mapNodeToViewModel(pic);
      expect(vm.kind).toBe("PictureNode");
      if (vm.kind !== "PictureNode") throw new Error();
      expect(vm.id).toBe("p1");
      expect(vm.title).toBe("Cat");
      expect(vm.imageUrl).toBe("https://example.com/cat.jpg");
    });

    it("ignores `now` and `cards` (no timestamp / no objective / no unit baked into a picture VM)", () => {
      const pic = new PictureNode(
        "p2",
        "Other",
        w(),
        "https://example.com/o.jpg",
      );
      const vm = mapNodeToViewModel(pic, {
        now: new Date("2030-01-01T00:00:00Z"),
        cards: new Map(),
      });
      expect(vm.kind).toBe("PictureNode");
    });

    it("mapFocusedToViewModel surfaces a PictureNode child slot beside other kinds", () => {
      const root = buildText("root", { history: [["2026-04-01T00:00:00Z", "anchor"]] });
      const pic = new PictureNode("p", "Cat", w(), "https://example.com/cat.jpg");
      root.attach(pic);
      const focused = mapFocusedToViewModel(root, [pic]);
      expect(focused.center.kind).toBe("TextNode");
      const slot = focused.children[0];
      if (slot?.slot !== "node") throw new Error("expected node slot");
      expect(slot.vm.kind).toBe("PictureNode");
      if (slot.vm.kind !== "PictureNode") throw new Error();
      expect(slot.vm.imageUrl).toBe("https://example.com/cat.jpg");
    });
  });

  /**
   * SPEC §17.120 — URLNode mapper. Trivial 1:1 projection (title +
   * url only); no timestamp / objective / colour math. Defensive
   * case: the `now` and `cards` options never affect a URL VM.
   */
  describe("URLNode (§17.120)", () => {
    it("maps title + url through verbatim (via the URLNode.url getter, which surfaces the inherited description slot per §17.120)", () => {
      const u = new URLNode("u1", "Docs", w(), "https://example.com/docs");
      const vm = mapNodeToViewModel(u);
      expect(vm.kind).toBe("URLNode");
      if (vm.kind !== "URLNode") throw new Error();
      expect(vm.id).toBe("u1");
      expect(vm.title).toBe("Docs");
      expect(vm.url).toBe("https://example.com/docs");
    });

    it("does NOT surface a separate `description` field on the VM (SPEC §17.120 — the URL IS the description; never leak both onto the VM)", () => {
      const u = new URLNode("u", "T", w(), "https://example.com/x");
      const vm = mapNodeToViewModel(u);
      expect(vm.kind).toBe("URLNode");
      if (vm.kind !== "URLNode") throw new Error();
      expect("description" in vm).toBe(false);
      expect("imageUrl" in vm).toBe(false);
      // The VM exposes exactly the four URL-leaf fields and nothing else.
      expect(Object.keys(vm).sort()).toEqual(["id", "kind", "title", "url"]);
    });

    it("ignores `now` and `cards` (no timestamp / no objective / no unit baked into a URL VM)", () => {
      const u = new URLNode("u2", "Other", w(), "https://example.com/o");
      const vm = mapNodeToViewModel(u, {
        now: new Date("2030-01-01T00:00:00Z"),
        cards: new Map(),
      });
      expect(vm.kind).toBe("URLNode");
    });

    it("preserves the URL even when it's not a typical https URL (mailto:, tel:, custom schemes — domain stays loose, VM does too)", () => {
      // SPEC §17.120 — the mapper does NOT pre-validate URL shape;
      // any non-empty string the domain accepts passes through verbatim.
      const cases = [
        "mailto:ops@example.com",
        "tel:+33-1-23-45-67-89",
        "custom-scheme://payload",
        "just some text",
      ];
      for (const raw of cases) {
        const u = new URLNode("u", "T", w(), raw);
        const vm = mapNodeToViewModel(u);
        if (vm.kind !== "URLNode") throw new Error();
        expect(vm.url).toBe(raw);
      }
    });

    it("mapFocusedToViewModel surfaces a URLNode child slot beside other kinds (URL + Picture + Text mix; instanceof discrimination keeps them distinct)", () => {
      const root = buildText("root", { history: [["2026-04-01T00:00:00Z", "anchor"]] });
      const url = new URLNode("u", "Docs", w(), "https://example.com/docs");
      const pic = new PictureNode("p", "Cat", w(), "https://example.com/cat.jpg");
      root.attach(url);
      root.attach(pic);
      const focused = mapFocusedToViewModel(root, [url, pic]);
      expect(focused.center.kind).toBe("TextNode");
      const urlSlot = focused.children[0];
      const picSlot = focused.children[1];
      if (urlSlot?.slot !== "node") throw new Error("expected url node slot");
      if (picSlot?.slot !== "node") throw new Error("expected pic node slot");
      expect(urlSlot.vm.kind).toBe("URLNode");
      expect(picSlot.vm.kind).toBe("PictureNode");
      if (urlSlot.vm.kind !== "URLNode") throw new Error();
      if (picSlot.vm.kind !== "PictureNode") throw new Error();
      // SPEC §17.120 — URL and Picture VMs do not bleed into each
      // other despite their structural similarity.
      expect(urlSlot.vm.url).toBe("https://example.com/docs");
      expect(picSlot.vm.imageUrl).toBe("https://example.com/cat.jpg");
    });
  });
});
