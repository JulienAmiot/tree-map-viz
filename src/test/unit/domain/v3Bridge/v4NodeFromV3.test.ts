import { describe, expect, it } from "vitest";

import {
  UnknownV3NodeKindError,
  v4NodeFromV3,
  type NodeOverride,
} from "../../../../domain/v3Bridge/v4NodeFromV3.js";
import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { BusinessScoreCard } from "../../../../domain/nodes/BusinessScoreCard.js";
import { BusinessScoreCardNode } from "../../../../domain/nodes/BusinessScoreCardNode.js";
import { BusinessScoreNode } from "../../../../domain/nodes/BusinessScoreNode.js";
import { StrictRangeNode } from "../../../../domain/nodes/StrictRangeNode.js";
import { TextCard } from "../../../../domain/nodes/TextCard.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { TextNodeV4 } from "../../../../domain/nodes/TextNodeV4.js";
import { TreeNode } from "../../../../domain/nodes/TreeNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../domain/values/Title.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const clock: Clock = { now: () => T("2026-05-10T12:00:00Z") };
const w = Weight.of(1);
const ident = (title: string, desc = ""): NodeIdentity =>
  NodeIdentity.of(Title.of(title), Description.of(desc));

const buildV3Text = (id: string, title: string, history: [string, string][] = []): TextNode => {
  const tvs = history.map(([iso, v]) => TimestampedValue.of(v, T(iso)));
  return new TextNode(id, ident(title), w, TextCard.of(tvs));
};

const buildV3BSC = (
  id: string,
  title: string,
  description: string,
  history: [string, number][] = [],
  objective: Objective<number> = Objective.of(0, 100, T("2026-12-31T00:00:00Z")),
  flags: { computed?: boolean; eligibleForParentComputation?: boolean } = {},
): BusinessScoreCardNode<number> => {
  const tvs = history.map(([iso, v]) => TimestampedValue.of(v, T(iso)));
  const card = BusinessScoreCard.of<number>(
    { value: "%" } as never,
    objective,
    tvs,
  );
  return new BusinessScoreCardNode<number>(
    id,
    ident(title, description),
    w,
    card,
    flags.computed ?? true,
    flags.eligibleForParentComputation ?? true,
  );
};

describe("v4NodeFromV3 (§17.81 — Phase A.1: recursive v3→v4 Node adapter)", () => {
  it("TextNode → TextNodeV4 preserves id/title/weight, copies history, drops description (§17.15)", () => {
    const v3 = buildV3Text("t-1", "Sales notes", [
      ["2026-01-01T00:00:00Z", "Q1 plan"],
      ["2026-04-01T00:00:00Z", "Q2 plan"],
    ]);
    const v4 = v4NodeFromV3(v3, clock) as TextNodeV4;
    expect(v4).toBeInstanceOf(TextNodeV4);
    expect(v4.id).toBe("t-1");
    expect(v4.title).toBe("Sales notes");
    expect(v4.weight).toBe(w);
    const entries = v4.entries();
    expect(entries.map((e) => e.value)).toEqual(["Q1 plan", "Q2 plan"]);
    expect(entries[1].asOf.moment.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(v4.getDescription()).toBe("Q2 plan");
  });

  it("BusinessScoreCardNode → BusinessScoreNode (default) with unbounded LenientRange + ObjectiveV4 mapping", () => {
    const v3 = buildV3BSC(
      "b-1",
      "Revenue",
      "Quarterly revenue %",
      [
        ["2026-03-01T00:00:00Z", 30],
        ["2026-01-01T00:00:00Z", 10],
        ["2026-02-01T00:00:00Z", 20],
      ],
      Objective.of(10, 80, T("2026-12-31T00:00:00Z")),
    );
    const v4 = v4NodeFromV3(v3, clock) as BusinessScoreNode<number>;
    expect(v4).toBeInstanceOf(BusinessScoreNode);
    expect(v4.title).toBe("Revenue");
    expect(v4.getDescription()).toBe("Quarterly revenue %");
    expect(v4.range.minimalValue).toBe(Number.NEGATIVE_INFINITY);
    expect(v4.range.maximalValue).toBe(Number.POSITIVE_INFINITY);
    expect(v4.objective.value).toBe(80);
    expect(v4.objective.at.moment.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(v4.entries().map((e) => e.value)).toEqual([10, 20, 30]);
  });

  it("BSC → StrictRangeNode when override.strictRange=true with explicit min/max + history copy", () => {
    const v3 = buildV3BSC("b-1", "Latency", "ms", [["2026-01-01T00:00:00Z", 50]]);
    const overrides = new Map<string, NodeOverride>([
      ["b-1", { strictRange: true, min: 0, max: 100 }],
    ]);
    const v4 = v4NodeFromV3(v3, clock, { overrides }) as StrictRangeNode<number>;
    expect(v4).toBeInstanceOf(StrictRangeNode);
    expect(v4.range.minimalValue).toBe(0);
    expect(v4.range.maximalValue).toBe(100);
    expect(v4.entries().map((e) => e.value)).toEqual([50]);
  });

  it("override only fires for matching id; sibling BSCs stay lenient", () => {
    const a = buildV3BSC("a", "x", "");
    const b = buildV3BSC("b", "y", "");
    a.attach(b);
    const overrides = new Map<string, NodeOverride>([["b", { strictRange: true }]]);
    const v4 = v4NodeFromV3(a, clock, { overrides });
    expect(v4).toBeInstanceOf(BusinessScoreNode);
    expect(v4.children[0]).toBeInstanceOf(StrictRangeNode);
  });

  it("walks v3 children recursively, preserving order and node kinds across mixed branches", () => {
    const root = buildV3Text("root", "r");
    const c1 = buildV3Text("c1", "1");
    const c2 = buildV3BSC("c2", "2", "");
    const c2c = buildV3Text("c2c", "deep");
    root.attach(c1);
    root.attach(c2);
    c2.attach(c2c);
    const v4 = v4NodeFromV3(root, clock);
    expect(v4.children.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(v4.children[0]).toBeInstanceOf(TextNodeV4);
    expect(v4.children[1]).toBeInstanceOf(BusinessScoreNode);
    expect(v4.children[1].children[0].id).toBe("c2c");
    expect(v4.children[1].children[0]).toBeInstanceOf(TextNodeV4);
  });

  describe("§17.99b — v3 `eligibleForParentComputation` migrates to v4 `ValueNode<T>.disabled`", () => {
    it("v3 BSC with eligibleForParentComputation=true (default) produces a v4 node with disabled=false", () => {
      const v3 = buildV3BSC("eligible", "Sales", "");
      const v4 = v4NodeFromV3(v3, clock) as BusinessScoreNode<number>;
      expect(v4.disabled).toBe(false);
    });

    it("v3 BSC with eligibleForParentComputation=false produces a v4 BSN with disabled=true", () => {
      const v3 = buildV3BSC("parked", "Future score", "", [], undefined, {
        eligibleForParentComputation: false,
      });
      const v4 = v4NodeFromV3(v3, clock) as BusinessScoreNode<number>;
      expect(v4).toBeInstanceOf(BusinessScoreNode);
      expect(v4.disabled).toBe(true);
    });

    it("the disabled migration also fires on the StrictRangeNode branch (setDisabled inherited from ValueNode<T>)", () => {
      const v3 = buildV3BSC("strict-parked", "Latency", "ms", [], undefined, {
        eligibleForParentComputation: false,
      });
      const overrides = new Map<string, NodeOverride>([
        ["strict-parked", { strictRange: true, min: 0, max: 100 }],
      ]);
      const v4 = v4NodeFromV3(v3, clock, { overrides }) as StrictRangeNode<number>;
      expect(v4).toBeInstanceOf(StrictRangeNode);
      expect(v4.disabled).toBe(true);
    });
  });

  it("throws UnknownV3NodeKindError on a TreeNode subclass that is neither TextNode nor BusinessScoreCardNode", () => {
    class StubV3Node extends TreeNode<number> {
      currentValue(): TimestampedValue<number> {
        return TimestampedValue.of(0, T("2026-01-01T00:00:00Z"));
      }
    }
    const stub = new StubV3Node("s", ident("Stub"), w);
    expect(() => v4NodeFromV3(stub, clock)).toThrow(UnknownV3NodeKindError);
    expect(() => v4NodeFromV3(stub, clock)).toThrow(/Cannot adapt v3 node "s"/);
  });
});
