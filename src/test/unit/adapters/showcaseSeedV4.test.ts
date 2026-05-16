import { describe, expect, it } from "vitest";

import {
  buildShowcaseBoardV4,
  buildShowcaseTreeV4,
  SHOWCASE_BOARD_ID_V4,
  SHOWCASE_BOARD_NAME_V4,
} from "../../../adapters/showcaseSeedV4.js";
import { mapFocusedToViewModelV4 } from "../../../adapters/ui/views/viewModelMapperV4.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../domain/nodes/ComputedNode.js";
import { StrictRangeNode } from "../../../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../../../domain/nodes/TextNodeV4.js";
import { Tree } from "../../../domain/Tree.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";

const NOW = new Date("2026-05-16T12:00:00Z");
const clock: Clock = { now: () => Timestamp.of(NOW) };

describe("showcaseSeedV4 (§17.109 — v4 showcase board)", () => {
  it("returns a Board with the stable id + name + a Tree root anchored at \"showcase-root\"", () => {
    const board = buildShowcaseBoardV4(clock, NOW);
    expect(board.id).toBe(SHOWCASE_BOARD_ID_V4);
    expect(board.name).toBe(SHOWCASE_BOARD_NAME_V4);
    expect(board.tree).toBeInstanceOf(Tree);
    expect(board.tree.root.id).toBe("showcase-root");
    expect(board.tree.root).toBeInstanceOf(TextNodeV4);
  });

  it("preserves every v3-showcase stable ID (e2e fixture continuity) AND adds the round-7 demo subtree (activity / cpu-saturation / activity-incident)", () => {
    const tree = buildShowcaseTreeV4(clock, NOW);
    const v3Ids = [
      "showcase-root", "engineering", "eng-velocity", "eng-review-sla", "eng-coverage", "eng-notes",
      "product", "sales", "sales-pipeline", "sales-winrate", "sales-lost",
      "operations", "bench",
    ];
    for (const id of v3Ids) expect(tree.findById(id), `missing v3 id ${id}`).toBeDefined();
    expect(tree.findById("activity")).toBeInstanceOf(ComputedNode);
    expect(tree.findById("cpu-saturation")).toBeInstanceOf(StrictRangeNode);
    expect(tree.findById("activity-incident")).toBeInstanceOf(TextNodeV4);
  });

  it("§17.99c polymorphic substitution lands first-class: engineering/sales/bench are ComputedBusinessScoreNode; product + sales children are plain BusinessScoreNode", () => {
    const tree = buildShowcaseTreeV4(clock, NOW);
    expect(tree.findById("engineering")).toBeInstanceOf(ComputedBusinessScoreNode);
    expect(tree.findById("sales")).toBeInstanceOf(ComputedBusinessScoreNode);
    expect(tree.findById("bench")).toBeInstanceOf(ComputedBusinessScoreNode);
    expect(tree.findById("product")).toBeInstanceOf(BusinessScoreNode);
    expect(tree.findById("sales-pipeline")).toBeInstanceOf(BusinessScoreNode);
    const lost = tree.findById("sales-lost") as BusinessScoreNode<number>;
    expect(lost.disabled).toBe(true);
  });

  it("§17.100.5 cards sidecar populated for every BSN-derived kind with a non-empty unit; round-7 ComputedNode + StrictRangeNode have no card entry by design", () => {
    const tree = buildShowcaseTreeV4(clock, NOW);
    const bsnIds = [
      "engineering", "eng-velocity", "eng-review-sla", "eng-coverage",
      "product", "sales", "sales-pipeline", "sales-winrate", "sales-lost", "bench",
    ];
    for (const id of bsnIds) {
      expect(tree.cards.get(id)?.getUnit().value, `missing card for ${id}`).toBeTruthy();
    }
    expect(tree.cards.has("activity")).toBe(false);
    expect(tree.cards.has("cpu-saturation")).toBe(false);
    expect(tree.cards.has("showcase-root")).toBe(false);
  });

  it("maps cleanly through viewModelMapperV4 (§17.104b end-to-end smoke); root tile renders as TextNode with markdown content + first-level kinds cover all 4 root-attached VM kinds", () => {
    const tree = buildShowcaseTreeV4(clock, NOW);
    const focused = mapFocusedToViewModelV4(tree.root, tree.root.children, { cards: tree.cards, now: NOW });
    expect(focused.center.kind).toBe("TextNode");
    if (focused.center.kind !== "TextNode") throw new Error();
    expect(focused.center.value.text).toMatch(/Q2 status/);

    const kinds = focused.children.flatMap((s) => (s.slot === "node" ? [s.vm.kind] : []));
    expect(kinds).toEqual([
      "ComputedBusinessScoreNode", "BusinessScoreCardNode", "ComputedBusinessScoreNode",
      "TextNode", "ComputedBusinessScoreNode", "ComputedNode",
    ]);
  });
});
