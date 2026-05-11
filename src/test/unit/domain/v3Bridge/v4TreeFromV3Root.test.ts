import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { BusinessScoreCard } from "../../../../domain/nodes/BusinessScoreCard.js";
import { BusinessScoreCardNode } from "../../../../domain/nodes/BusinessScoreCardNode.js";
import { BusinessScoreNode } from "../../../../domain/nodes/BusinessScoreNode.js";
import { StrictRangeNode } from "../../../../domain/nodes/StrictRangeNode.js";
import { TextCard } from "../../../../domain/nodes/TextCard.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { TextNodeV4 } from "../../../../domain/nodes/TextNodeV4.js";
import { TreeNode } from "../../../../domain/nodes/TreeNode.js";
import { Tree } from "../../../../domain/Tree.js";
import {
  UnknownV3NodeKindError,
  type NodeOverride,
} from "../../../../domain/v3Bridge/v4NodeFromV3.js";
import { v4TreeFromV3Root } from "../../../../domain/v3Bridge/v4TreeFromV3Root.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../domain/values/Title.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const clock: Clock = { now: () => T("2026-05-11T09:00:00Z") };
const w = Weight.of(1);
const ident = (title: string, desc = ""): NodeIdentity =>
  NodeIdentity.of(Title.of(title), Description.of(desc));

const buildV3Text = (
  id: string,
  title: string,
  history: [string, string][] = [],
): TextNode => {
  const tvs = history.map(([iso, v]) => TimestampedValue.of(v, T(iso)));
  return new TextNode(id, ident(title), w, TextCard.of(tvs));
};

const buildV3BSC = (
  id: string,
  title: string,
  description: string,
  history: [string, number][] = [],
  objective: Objective<number> = Objective.of(0, 100, T("2026-12-31T00:00:00Z")),
): BusinessScoreCardNode<number> => {
  const tvs = history.map(([iso, v]) => TimestampedValue.of(v, T(iso)));
  const card = BusinessScoreCard.of<number>(
    { value: "%" } as never,
    objective,
    tvs,
  );
  return new BusinessScoreCardNode<number>(id, ident(title, description), w, card, true, true);
};

describe("v4TreeFromV3Root (§17.88 — Phase A.2: wraps the §17.81 adapter result in a v4 Tree)", () => {
  it("returns a Tree instance whose root is the v4-converted v3 root (TextNode → TextNodeV4)", () => {
    const v3 = buildV3Text("root", "Sales notes", [
      ["2026-01-01T00:00:00Z", "Q1 plan"],
    ]);
    const tree = v4TreeFromV3Root(v3, clock);
    expect(tree).toBeInstanceOf(Tree);
    expect(tree.root).toBeInstanceOf(TextNodeV4);
    expect(tree.root.id).toBe("root");
    expect((tree.root as TextNodeV4).title).toBe("Sales notes");
  });

  it("walks v3 children recursively; tree.root has the same converted shape as v4NodeFromV3 produces", () => {
    const root = buildV3Text("root", "r");
    const a = buildV3Text("a", "ta");
    const b = buildV3BSC("b", "tb", "desc");
    const bb = buildV3Text("bb", "tbb");
    root.attach(a);
    root.attach(b);
    b.attach(bb);

    const tree = v4TreeFromV3Root(root, clock);

    expect(tree.root.children.map((c) => c.id)).toEqual(["a", "b"]);
    expect(tree.root.children[0]).toBeInstanceOf(TextNodeV4);
    expect(tree.root.children[1]).toBeInstanceOf(BusinessScoreNode);
    expect(tree.root.children[1]?.children[0]?.id).toBe("bb");
    expect(tree.root.children[1]?.children[0]).toBeInstanceOf(TextNodeV4);
  });

  it("Tree.findById locates a deeply nested v4-converted node by its v3 id", () => {
    const root = buildV3Text("root", "r");
    const a = buildV3Text("a", "ta");
    const aa = buildV3BSC("aa", "taa", "");
    const aaa = buildV3Text("aaa", "leaf");
    root.attach(a);
    a.attach(aa);
    aa.attach(aaa);

    const tree = v4TreeFromV3Root(root, clock);

    const hit = tree.findById("aaa");
    expect(hit).toBeInstanceOf(TextNodeV4);
    expect(hit?.id).toBe("aaa");

    expect(tree.findById("does-not-exist")).toBeUndefined();
  });

  it("Tree.nodes() yields a pre-order DFS of every v4-converted node, root first", () => {
    const root = buildV3Text("root", "r");
    const a = buildV3Text("a", "ta");
    const b = buildV3Text("b", "tb");
    const ba = buildV3Text("ba", "tba");
    root.attach(a);
    root.attach(b);
    b.attach(ba);

    const tree = v4TreeFromV3Root(root, clock);

    expect(tree.nodes().map((n) => n.id)).toEqual(["root", "a", "b", "ba"]);
  });

  it("propagates the override map to v4NodeFromV3 (BSC under override id becomes StrictRangeNode)", () => {
    const root = buildV3Text("root", "r");
    const lenient = buildV3BSC("lenient", "L", "");
    const strict = buildV3BSC("strict", "S", "");
    root.attach(lenient);
    root.attach(strict);

    const overrides = new Map<string, NodeOverride>([
      ["strict", { strictRange: true, min: 0, max: 100 }],
    ]);
    const tree = v4TreeFromV3Root(root, clock, { overrides });

    expect(tree.findById("lenient")).toBeInstanceOf(BusinessScoreNode);
    const strictV4 = tree.findById("strict");
    expect(strictV4).toBeInstanceOf(StrictRangeNode);
    expect((strictV4 as StrictRangeNode<number>).range.minimalValue).toBe(0);
    expect((strictV4 as StrictRangeNode<number>).range.maximalValue).toBe(100);
  });

  it("bubbles UnknownV3NodeKindError from v4NodeFromV3 on an unrecognised v3 TreeNode subclass", () => {
    class StubV3Node extends TreeNode<number> {
      currentValue(): TimestampedValue<number> {
        return TimestampedValue.of(0, T("2026-01-01T00:00:00Z"));
      }
    }
    const stub = new StubV3Node("stub-root", ident("Stub"), w);
    expect(() => v4TreeFromV3Root(stub, clock)).toThrow(UnknownV3NodeKindError);
    expect(() => v4TreeFromV3Root(stub, clock)).toThrow(/Cannot adapt v3 node "stub-root"/);
  });

  it("default opts (no overrides argument) produces a Tree with all-lenient BSCs", () => {
    const root = buildV3BSC("only-bsc", "single", "");
    const tree = v4TreeFromV3Root(root, clock);
    expect(tree.root).toBeInstanceOf(BusinessScoreNode);
  });
});
