import { describe, expect, it } from "vitest";

import {
  buildShowcaseBoard,
  buildShowcaseTree,
  SHOWCASE_BOARD_ID,
  SHOWCASE_BOARD_NAME,
} from "../../../adapters/showcaseSeed.js";
import { mapFocusedToViewModel } from "../../../adapters/ui/views/viewModelMapper.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../domain/nodes/ComputedNode.js";
import type { Node } from "../../../domain/nodes/Node.js";
import { PictureNode } from "../../../domain/nodes/PictureNode.js";
import { StrictRangeNode } from "../../../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { URLNode } from "../../../domain/nodes/URLNode.js";
import { WorkflowNode } from "../../../domain/nodes/WorkflowNode.js";
import { Tree } from "../../../domain/Tree.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";

const NOW = new Date("2026-05-16T12:00:00Z");
const clock: Clock = { now: () => Timestamp.of(NOW) };

const PANEL_IDS = [
  "reliability",
  "ingestion",
  "infra-cost",
  "products",
  "team-health",
  "workflow",
] as const;

describe("showcaseSeed (§17.122 — Data Platform Obeya v5 showcase board)", () => {
  it("returns a Board with the stable id + name + Tree root anchored at \"showcase-root\" + the PDCA workflow-status table", () => {
    const board = buildShowcaseBoard(clock, NOW);
    expect(board.id).toBe(SHOWCASE_BOARD_ID);
    expect(board.name).toBe(SHOWCASE_BOARD_NAME);
    expect(board.tree).toBeInstanceOf(Tree);
    expect(board.tree.root.id).toBe("showcase-root");
    expect(board.tree.root).toBeInstanceOf(TextNode);
    expect(board.tree.root.title).toBe("Data Platform Obeya");
    expect(board.workflowStatuses.map((s) => s.id)).toEqual([
      "plan",
      "do",
      "check",
      "act",
    ]);
  });

  it("lays out exactly six top-level panels with stable slugs in obeya reading order", () => {
    const tree = buildShowcaseTree(clock, NOW);
    expect(tree.root.children.map((c) => c.id)).toEqual([...PANEL_IDS]);
  });

  it("each panel is the expected node kind (4 CBSN aggregators + 1 ComputedNode + 1 TextNode parent)", () => {
    const tree = buildShowcaseTree(clock, NOW);
    expect(tree.findById("reliability")).toBeInstanceOf(ComputedBusinessScoreNode);
    expect(tree.findById("ingestion")).toBeInstanceOf(ComputedBusinessScoreNode);
    expect(tree.findById("infra-cost")).toBeInstanceOf(ComputedNode);
    expect(tree.findById("products")).toBeInstanceOf(ComputedBusinessScoreNode);
    expect(tree.findById("team-health")).toBeInstanceOf(ComputedBusinessScoreNode);
    expect(tree.findById("workflow")).toBeInstanceOf(TextNode);
  });

  it("varies child counts across panels (5/4/4/3/4/5) — not uniform, covers the realistic operator range", () => {
    const tree = buildShowcaseTree(clock, NOW);
    const counts = PANEL_IDS.map((id) => tree.findById(id)!.children.length);
    expect(counts).toEqual([5, 4, 4, 3, 4, 5]);
  });

  it("every shipped node kind appears at least once (coverage matrix)", () => {
    const tree = buildShowcaseTree(clock, NOW);
    const all = collectAll(tree.root);
    expect(all.some((n) => n instanceof TextNode && !(n instanceof WorkflowNode))).toBe(true);
    expect(all.some((n) => n instanceof BusinessScoreNode && !(n instanceof ComputedBusinessScoreNode))).toBe(true);
    expect(all.some((n) => n instanceof ComputedBusinessScoreNode)).toBe(true);
    expect(all.some((n) => n instanceof ComputedNode)).toBe(true);
    expect(all.some((n) => n instanceof StrictRangeNode)).toBe(true);
    expect(all.some((n) => n instanceof WorkflowNode)).toBe(true);
    expect(all.some((n) => n instanceof PictureNode)).toBe(true);
    expect(all.some((n) => n instanceof URLNode)).toBe(true);
  });

  it("value distribution exercises history depth + objective polarity + the disabled-leaf affordance", () => {
    const tree = buildShowcaseTree(clock, NOW);
    const multi = ["slo-uptime", "ingest-events", "cost-compute", "prod-adoption", "team-velocity"];
    for (const id of multi) {
      const n = tree.findById(id) as BusinessScoreNode<number>;
      expect(n.entries().length, `expected multi-point history on ${id}`).toBeGreaterThanOrEqual(2);
    }
    const single = ["slo-freshness", "slo-completeness", "ingest-success", "ingest-latency-p99", "prod-nps"];
    for (const id of single) {
      const n = tree.findById(id) as BusinessScoreNode<number>;
      expect(n.entries().length, `expected single point on ${id}`).toBe(1);
    }
    const above = tree.findById("slo-uptime") as BusinessScoreNode<number>;
    expect(above.getValue()).toBeGreaterThan(above.objective.value);
    const below = tree.findById("ingest-latency-p99") as BusinessScoreNode<number>;
    expect(below.getValue()).toBeGreaterThan(below.objective.value);

    const disabled = tree.findById("slo-legacy-etl") as BusinessScoreNode<number>;
    expect(disabled.disabled).toBe(true);
    const bsnDescendants = collectAll(tree.root).filter(
      (n): n is BusinessScoreNode<number> => n instanceof BusinessScoreNode && n !== disabled,
    );
    expect(bsnDescendants.every((n) => n.disabled === false)).toBe(true);
  });

  it("every PDCA workflow-status id is referenced by at least one WorkflowNode", () => {
    const tree = buildShowcaseTree(clock, NOW);
    const statuses = collectAll(tree.root)
      .filter((n): n is WorkflowNode => n instanceof WorkflowNode)
      .map((n) => n.statusId)
      .sort();
    expect(statuses).toEqual(["act", "check", "do", "plan"]);
  });

  it("cards sidecar populated for every BSN/CBSN with a non-empty unit; non-BSN kinds have no card entry by design", () => {
    const tree = buildShowcaseTree(clock, NOW);
    const bsnIds = [
      "reliability", "slo-uptime", "slo-freshness", "slo-completeness", "slo-alerts", "slo-legacy-etl",
      "ingestion", "ingest-events", "ingest-success", "ingest-latency-p99",
      "cost-compute", "cost-storage", "cost-egress",
      "products", "prod-datasets", "prod-adoption", "prod-nps",
      "team-health", "team-velocity", "team-review-sla", "team-oncall-load",
    ];
    for (const id of bsnIds) {
      expect(tree.cards.get(id)?.getUnit().value, `missing card for ${id}`).toBeTruthy();
    }
    for (const id of [
      "showcase-root", "infra-cost", "workflow",
      "infra-topology", "ingest-kafka-dash", "team-engagement-pulse",
      "wf-data-mesh", "wf-quality-program", "wf-cost-optimization", "wf-pii-audit",
      "wf-incident-log",
    ]) {
      expect(tree.cards.has(id), `card unexpectedly present for ${id}`).toBe(false);
    }
  });

  it("maps cleanly through viewModelMapper (end-to-end smoke); root tile renders as TextNode + the six panel VM kinds line up with the panel layout", () => {
    const tree = buildShowcaseTree(clock, NOW);
    const focused = mapFocusedToViewModel(tree.root, tree.root.children, { cards: tree.cards, now: NOW });
    expect(focused.center.kind).toBe("TextNode");
    if (focused.center.kind !== "TextNode") throw new Error();
    expect(focused.center.value.text).toMatch(/Q2 status/);

    const kinds = focused.children.flatMap((s) => (s.slot === "node" ? [s.vm.kind] : []));
    expect(kinds).toEqual([
      "ComputedBusinessScoreNode",
      "ComputedBusinessScoreNode",
      "ComputedNode",
      "ComputedBusinessScoreNode",
      "ComputedBusinessScoreNode",
      "TextNode",
    ]);
  });
});

function collectAll(root: Node): readonly Node[] {
  const out: Node[] = [];
  const walk = (n: Node): void => {
    out.push(n);
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}
