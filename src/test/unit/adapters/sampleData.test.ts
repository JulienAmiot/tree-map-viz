import { describe, expect, it } from "vitest";

import { buildSampleTree } from "../../../adapters/sampleData.js";
import { mapFocusedToViewModel } from "../../../adapters/ui/views/viewModelMapper.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../domain/nodes/ComputedNode.js";
import { StrictRangeNode } from "../../../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";

const NOW = new Date("2026-05-16T00:00:00Z");
const clock: Clock = { now: () => Timestamp.of(NOW) };

describe("sampleDataV4 (§17.108 — v4 fixture builder)", () => {
  it("returns a Tree whose subtree covers every concrete v4 node kind + a §17.100.5 card sidecar", () => {
    const tree = buildSampleTree(clock);
    const ids = tree.nodes().map((n) => n.id);
    expect(ids).toEqual(["org", "health", "sales", "ops", "activity", "cpu", "note"]);

    const byId = (id: string) => tree.findById(id);
    expect(byId("org")).toBeInstanceOf(TextNode);
    expect(byId("health")).toBeInstanceOf(ComputedBusinessScoreNode);
    expect(byId("sales")).toBeInstanceOf(BusinessScoreNode);
    expect(byId("ops")).toBeInstanceOf(BusinessScoreNode);
    expect(byId("activity")).toBeInstanceOf(ComputedNode);
    expect(byId("cpu")).toBeInstanceOf(StrictRangeNode);
    expect(byId("note")).toBeInstanceOf(TextNode);

    expect(tree.cards.has("sales")).toBe(true);
    expect(tree.cards.get("sales")?.getUnit().value).toBe("%");
  });

  it("aggregator nodes dispatch through the §17.95 strategy chassis: CBSN weighted avg + ComputedNode count", () => {
    const tree = buildSampleTree(clock);
    const health = tree.findById("health") as ComputedBusinessScoreNode<number>;
    expect(health.getValue()).toBeCloseTo((104 * 3 + 98 * 1) / 4);

    const activity = tree.findById("activity") as ComputedNode<number>;
    expect(activity.getValue()).toBe(2);
  });

  it("maps cleanly through viewModelMapperV4 (every §17.104b branch + §17.100.5 card precedence end-to-end)", () => {
    const tree = buildSampleTree(clock);
    const focused = mapFocusedToViewModel(tree.root, tree.root.children, { cards: tree.cards, now: NOW });
    expect(focused.center.kind).toBe("TextNode");

    const kinds = focused.children.flatMap((s) => (s.slot === "node" ? [s.vm.kind] : []));
    expect(kinds).toEqual(["ComputedBusinessScoreNode", "ComputedNode"]);

    const salesVm = mapFocusedToViewModel(
      tree.findById("health")!, tree.findById("health")!.children, { cards: tree.cards, now: NOW },
    ).children[0];
    if (salesVm.slot !== "node" || salesVm.vm.kind !== "BusinessScoreCardNode") throw new Error("expected BSC slot");
    if (salesVm.vm.value.kind !== "recordedValue") throw new Error("expected recordedValue");
    expect(salesVm.vm.value.unit).toBe("%");
  });
});
