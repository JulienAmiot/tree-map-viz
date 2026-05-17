import { describe, expect, it } from "vitest";

import type { Clock } from "../../../domain/capabilities/Clock.js";
import { BusinessScoreCardV4 } from "../../../domain/cards/BusinessScoreCardV4.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import { TextNodeV4 } from "../../../domain/nodes/TextNodeV4.js";
import { Tree } from "../../../domain/Tree.js";
import { NumericComparator } from "../../../domain/values/Comparator.js";
import { Objective } from "../../../domain/values/Objective.js";
import { LenientRange } from "../../../domain/values/Range.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";
import { Unit } from "../../../domain/values/Unit.js";
import { Weight } from "../../../domain/values/Weight.js";

const clk: Clock = { now: () => Timestamp.of(new Date("2026-05-10T12:00:00Z")) };
const w = Weight.of(1);
const mkNode = (id: string, title = id): TextNodeV4 => new TextNodeV4(id, title, w, clk);

const buildLinearChain = (): { root: TextNodeV4; child: TextNodeV4; grand: TextNodeV4 } => {
  const root = mkNode("root");
  const child = mkNode("child");
  const grand = mkNode("grand");
  root.attach(child);
  child.attach(grand);
  return { root, child, grand };
};

const buildBranching = (): {
  root: TextNodeV4;
  a: TextNodeV4;
  b: TextNodeV4;
  a1: TextNodeV4;
  a2: TextNodeV4;
  b1: TextNodeV4;
} => {
  const root = mkNode("root");
  const a = mkNode("a");
  const b = mkNode("b");
  const a1 = mkNode("a1");
  const a2 = mkNode("a2");
  const b1 = mkNode("b1");
  root.attach(a);
  root.attach(b);
  a.attach(a1);
  a.attach(a2);
  b.attach(b1);
  return { root, a, b, a1, a2, b1 };
};

describe("Tree (§17.79 — v4 part 15: container closing the v4 class-diagram side)", () => {
  describe("construction + root accessor", () => {
    it("wraps a single root node and exposes it via the public readonly root field", () => {
      const root = mkNode("solo");
      const tree = new Tree(root);
      expect(tree.root).toBe(root);
    });

    it("works with a single-node tree (root has no children)", () => {
      const root = mkNode("solo");
      const tree = new Tree(root);
      expect(tree.nodes()).toEqual([root]);
      expect(tree.findById("solo")).toBe(root);
      expect(tree.findById("missing")).toBeUndefined();
    });
  });

  describe("findById — DFS lookup by id", () => {
    it("finds the root by its own id", () => {
      const { root } = buildLinearChain();
      const tree = new Tree(root);
      expect(tree.findById("root")).toBe(root);
    });

    it("finds a deep descendant down a linear chain", () => {
      const { root, grand } = buildLinearChain();
      const tree = new Tree(root);
      expect(tree.findById("grand")).toBe(grand);
    });

    it("returns undefined when no node has the id", () => {
      const { root } = buildBranching();
      const tree = new Tree(root);
      expect(tree.findById("nope")).toBeUndefined();
    });

    it("finds nodes in any branch of a branching tree", () => {
      const { root, a, b, a1, a2, b1 } = buildBranching();
      const tree = new Tree(root);
      expect(tree.findById("a")).toBe(a);
      expect(tree.findById("b")).toBe(b);
      expect(tree.findById("a1")).toBe(a1);
      expect(tree.findById("a2")).toBe(a2);
      expect(tree.findById("b1")).toBe(b1);
    });
  });

  describe("nodes() — pre-order DFS flattening", () => {
    it("returns root first, then each subtree in pre-order on a linear chain", () => {
      const { root, child, grand } = buildLinearChain();
      const tree = new Tree(root);
      expect(tree.nodes()).toEqual([root, child, grand]);
    });

    it("respects child insertion order on a branching tree (pre-order DFS)", () => {
      const { root, a, b, a1, a2, b1 } = buildBranching();
      const tree = new Tree(root);
      expect(tree.nodes()).toEqual([root, a, a1, a2, b, b1]);
    });

    it("returns a frozen snapshot — mutating the result does not affect subsequent calls", () => {
      const { root } = buildBranching();
      const tree = new Tree(root);
      const snapshot = tree.nodes();
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(() => (snapshot as unknown as TextNodeV4[]).push(mkNode("x"))).toThrow();
      expect(tree.nodes()).toHaveLength(6);
    });
  });

  describe("cards sidecar (§17.100.5 — visual-layer registry keyed by node id)", () => {
    it("defaults to the shared empty registry when omitted; non-empty map is preserved by reference", () => {
      const t1 = new Tree(mkNode("solo"));
      expect(t1.cards).toBe(Tree.EMPTY_CARDS);
      expect(t1.cards.size).toBe(0);

      const bsn = new BusinessScoreNode<number>(
        "b", "B", w, "", clk,
        LenientRange.of(0, 100, NumericComparator.INSTANCE),
        { objective: Objective.of(80, Timestamp.of(new Date("2026-12-31T00:00:00Z"))) },
      );
      const cards = new Map([["b", new BusinessScoreCardV4(bsn, Unit.of("%"))]]);
      const t2 = new Tree(mkNode("solo"), cards);
      expect(t2.cards).toBe(cards);
      expect(t2.cards.get("b")?.getUnit().value).toBe("%");
    });
  });
});
