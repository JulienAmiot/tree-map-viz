import { describe, expect, it } from "vitest";

import { JsonDecodeError } from "../../../../adapters/persistence/jsonCodec.js";
import {
  createJsonCodecV4,
  JsonCodecV4EncodeError,
} from "../../../../adapters/persistence/jsonCodecV4.js";
import { buildSampleTreeV4 } from "../../../../adapters/sampleDataV4.js";
import { BusinessScoreCardV4 } from "../../../../domain/cards/BusinessScoreCardV4.js";
import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../../domain/nodes/ComputedNode.js";
import type { Node } from "../../../../domain/nodes/Node.js";
import { StrictRangeNode } from "../../../../domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "../../../../domain/nodes/TextNodeV4.js";
import { Tree } from "../../../../domain/Tree.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import { ObjectiveV4 } from "../../../../domain/values/ObjectiveV4.js";
import { LenientRange, StrictRange } from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Unit } from "../../../../domain/values/Unit.js";
import { Weight } from "../../../../domain/values/Weight.js";

const NOW = new Date("2026-05-16T12:00:00Z");
const clock: Clock = { now: () => Timestamp.of(NOW) };

type Wire = Record<string, unknown>;

function bscWire(opts: {
  id: string;
  title?: string;
  description?: string;
  weight?: number;
  unit?: string;
  computed?: boolean;
  eligible?: boolean;
  history?: [string, number][];
  children?: Wire[];
  targetValue?: number;
  minimalValue?: number;
  targetDate?: string;
}): Wire {
  return {
    nodeType: "BusinessScoreCard",
    id: opts.id,
    title: opts.title ?? opts.id,
    description: opts.description ?? "",
    weight: opts.weight ?? 1,
    unit: opts.unit ?? "%",
    targetValue: opts.targetValue ?? 100,
    minimalValue: opts.minimalValue ?? 0,
    targetDate: opts.targetDate ?? "2026-12-31T00:00:00.000Z",
    historizedValues: (opts.history ?? []).map(([date, value]) => ({ value, date })),
    computed: opts.computed ?? false,
    eligibleForParentComputation: opts.eligible ?? true,
    childrenNodes: opts.children ?? [],
  };
}

function textWire(opts: {
  id: string;
  title?: string;
  history?: [string, string][];
  children?: Wire[];
}): Wire {
  return {
    nodeType: "TextNode",
    id: opts.id,
    title: opts.title ?? opts.id,
    description: "",
    weight: 1,
    historizedValues: (opts.history ?? []).map(([date, value]) => ({ value, date })),
    childrenNodes: opts.children ?? [],
  };
}

const codec = createJsonCodecV4(clock);

describe("jsonCodecV4 (§17.105 — decode-side adapter)", () => {
  describe("round-7 fixture suite (the §17.94 plan row's first-load translation)", () => {
    it("plain v3 BSC wire → v4 BusinessScoreNode with objective + history + lenient range", () => {
      const tree = codec.decode(JSON.stringify(
        bscWire({ id: "p", unit: "%", targetValue: 110, minimalValue: 0, history: [["2026-04-22T18:25:43.511Z", 95]] }),
      ));
      expect(tree).toBeInstanceOf(Tree);
      const root = tree.root;
      expect(root).toBeInstanceOf(BusinessScoreNode);
      const bsn = root as BusinessScoreNode<number>;
      expect(bsn.id).toBe("p");
      expect(bsn.objective.value).toBe(110);
      expect(bsn.objective.at.moment.toISOString()).toBe("2026-12-31T00:00:00.000Z");
      expect(bsn.entries().map((e) => [e.asOf.moment.toISOString(), e.value])).toEqual([
        ["2026-04-22T18:25:43.511Z", 95],
      ]);
    });

    it("v3 BSC with computed:true → ComputedBusinessScoreNode (§17.99c polymorphic substitution); history NOT carried + computationKind = WEIGHTED_AVERAGE", () => {
      const tree = codec.decode(JSON.stringify(
        bscWire({ id: "agg", computed: true, history: [["2026-04-22T18:25:43.511Z", 50]] }),
      ));
      const root = tree.root;
      expect(root).toBeInstanceOf(ComputedBusinessScoreNode);
      const cbsn = root as ComputedBusinessScoreNode<number>;
      expect(cbsn.entries()).toHaveLength(0);
      expect(cbsn.computationKind).toBe(ComputationKind.WEIGHTED_AVERAGE);
    });

    it("eligibleForParentComputation:false → disabled:true (§17.99b broader successor); applied uniformly across BSN + CBSN", () => {
      const wire = bscWire({
        id: "root", children: [
          bscWire({ id: "off-plain", eligible: false }),
          bscWire({ id: "off-computed", eligible: false, computed: true }),
          bscWire({ id: "on-plain", eligible: true }),
        ],
      });
      const tree = codec.decode(JSON.stringify(wire));
      const offPlain = tree.findById("off-plain") as BusinessScoreNode<number>;
      const offComputed = tree.findById("off-computed") as ComputedBusinessScoreNode<number>;
      const onPlain = tree.findById("on-plain") as BusinessScoreNode<number>;
      expect(offPlain.disabled).toBe(true);
      expect(offComputed.disabled).toBe(true);
      expect(onPlain.disabled).toBe(false);
    });

    it("every BSC's unit → Tree.cards entry (§17.100.5 sidecar build at the bridge boundary); the v3 codec rejects empty units so the entry is always present", () => {
      const wire = bscWire({
        id: "root", unit: "%", children: [
          bscWire({ id: "child-a", unit: "ms" }),
          bscWire({ id: "child-b", unit: "$" }),
        ],
      });
      const tree = codec.decode(JSON.stringify(wire));
      expect(tree.cards.get("root")?.getUnit().value).toBe("%");
      expect(tree.cards.get("child-a")?.getUnit().value).toBe("ms");
      expect(tree.cards.get("child-b")?.getUnit().value).toBe("$");
    });

    it("TextNode wire → TextNodeV4 with history; description hardcoded to \"\" per §17.15 / TextNodeV4 contract", () => {
      const tree = codec.decode(JSON.stringify(textWire({
        id: "t", title: "Notes", history: [["2026-04-22T18:25:43.511Z", "Q1 note"]],
      })));
      const root = tree.root as TextNodeV4;
      expect(root).toBeInstanceOf(TextNodeV4);
      expect(root.title).toBe("Notes");
      expect(root.getDescription()).toBe("Q1 note");
      expect(root.entries().map((e) => e.value)).toEqual(["Q1 note"]);
    });

    it("strictRange override → StrictRangeNode (§17.81 per-id escape hatch); wins over computed:true", () => {
      const codecStrict = createJsonCodecV4(clock, {
        overrides: new Map([["scoped", { strictRange: true, min: 0, max: 100 }]]),
      });
      const wire = bscWire({
        id: "root", children: [bscWire({ id: "scoped", computed: true })],
      });
      const tree = codecStrict.decode(JSON.stringify(wire));
      expect(tree.findById("scoped")).toBeInstanceOf(StrictRangeNode);
    });

    it("composite tree preserves children order + parent wiring across the bridge", () => {
      const wire = bscWire({
        id: "root", children: [
          bscWire({ id: "a", children: [bscWire({ id: "a1" })] }),
          textWire({ id: "b" }),
        ],
      });
      const tree = codec.decode(JSON.stringify(wire));
      expect(tree.nodes().map((n) => n.id)).toEqual(["root", "a", "a1", "b"]);
      const a = tree.findById("a")!;
      expect(a.parent?.id).toBe("root");
      expect(a.children[0]!.id).toBe("a1");
    });
  });

  describe("errors + encode stub", () => {
    it("malformed JSON propagates JsonDecodeError from the v3 codec (validate-before-replace contract preserved)", () => {
      expect(() => codec.decode("{not json")).toThrow(JsonDecodeError);
    });

    it("unknown nodeType propagates JsonDecodeError pointing at the offending field", () => {
      expect(() => codec.decode(JSON.stringify({ nodeType: "Mystery", id: "x" })))
        .toThrow(/unknown nodeType "Mystery"/);
    });

  });

  describe("§17.106a — v4-native encode (decode rewrite remains §17.106b's job)", () => {
    const TARGET = Timestamp.of(new Date("2026-12-31T00:00:00.000Z"));
    const T1 = Timestamp.of(new Date("2026-04-22T18:25:43.511Z"));
    const lenient = (): LenientRange<number> => LenientRange.of(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, NumericComparator.INSTANCE);

    it("envelope = {schemaVersion:\"v4.0\", root, cards[]}; cards sidecar serialised as flat [{nodeId,unit}] list", () => {
      const bsn = new BusinessScoreNode<number>("root", "Root", Weight.of(1), "d", clock, lenient(), { objective: ObjectiveV4.of(100, TARGET), unit: "%" });
      const cards = new Map<string, BusinessScoreCardV4<unknown>>();
      cards.set("root", new BusinessScoreCardV4(bsn, Unit.percent()));
      const json = JSON.parse(codec.encode(new Tree(bsn, cards))) as Record<string, unknown>;
      expect(json.schemaVersion).toBe("v4.0");
      expect(json.cards).toEqual([{ nodeId: "root", unit: "%" }]);
      expect((json.root as { kind: string }).kind).toBe("BusinessScoreNode");
    });

    it("TextNodeV4 + BusinessScoreNode emit per-kind shapes; disabled OMITTED when false / EMITTED when true; unit OMITTED when empty; range uses null sentinel for ±Infinity", () => {
      const t = new TextNodeV4("t", "Notes", Weight.of(1), clock);
      t.addValue(T1, "hello");
      const tWire = JSON.parse(codec.encode(new Tree(t))).root as Record<string, unknown>;
      expect(tWire.kind).toBe("TextNodeV4");
      expect(tWire.history).toEqual([{ value: "hello", at: T1.moment.toISOString() }]);
      expect("disabled" in tWire).toBe(false);
      t.setDisabled(true);
      expect((JSON.parse(codec.encode(new Tree(t))).root as Record<string, unknown>).disabled).toBe(true);
      const bsn = new BusinessScoreNode<number>("b", "B", Weight.of(1), "d", clock, lenient(), { objective: ObjectiveV4.of(100, TARGET) });
      const bsnWire = JSON.parse(codec.encode(new Tree(bsn))).root as Record<string, unknown>;
      expect(bsnWire.range).toEqual({ kind: "lenient", min: null, max: null });
      expect("unit" in bsnWire).toBe(false);
    });

    it("ComputedBusinessScoreNode emits computationKind + NO history; ComputedNode emits computationKind only (no range/objective/history); StrictRangeNode emits strict range with finite bounds + history", () => {
      const cbsn = new ComputedBusinessScoreNode<number>("agg", "Agg", Weight.of(1), "d", clock, lenient(), { objective: ObjectiveV4.of(50, TARGET), initialKind: ComputationKind.WEIGHTED_AVERAGE });
      const cbsnWire = JSON.parse(codec.encode(new Tree(cbsn))).root as Record<string, unknown>;
      expect(cbsnWire.kind).toBe("ComputedBusinessScoreNode");
      expect(cbsnWire.computationKind).toBe("WEIGHTED_AVERAGE");
      expect("history" in cbsnWire).toBe(false);

      const cn = new ComputedNode<number>("c", "C", Weight.of(1), "events", clock, ComputationKind.COUNT);
      const cnWire = JSON.parse(codec.encode(new Tree(cn))).root as Record<string, unknown>;
      expect(cnWire).toEqual({ kind: "ComputedNode", id: "c", title: "C", weight: 1, description: "events", computationKind: "COUNT", children: [] });

      const srn = new StrictRangeNode<number>("s", "S", Weight.of(1), "0-100", clock, StrictRange.of(0, 100, NumericComparator.INSTANCE));
      srn.addValue(T1, 70);
      const srnWire = JSON.parse(codec.encode(new Tree(srn))).root as Record<string, unknown>;
      expect(srnWire.kind).toBe("StrictRangeNodeV4");
      expect(srnWire.range).toEqual({ kind: "strict", min: 0, max: 100 });
      expect(srnWire.history).toEqual([{ value: 70, at: T1.moment.toISOString() }]);
    });

    it("encodes nested children recursively + preserves child order across kinds (sampleDataV4 composite tree round-trips its node ID list verbatim through encode→JSON.parse)", () => {
      const tree = buildSampleTreeV4(clock);
      const wire = JSON.parse(codec.encode(tree)) as { root: { children: { id: string; kind: string; children: unknown[] }[] } };
      const collectIds = (n: { id: string; children: unknown[] }): string[] =>
        [n.id, ...(n.children as { id: string; children: unknown[] }[]).flatMap(collectIds)];
      expect(collectIds(wire.root as { id: string; children: unknown[] })).toEqual(tree.nodes().map((n) => n.id));
    });

    it("encode throws JsonCodecV4EncodeError on unsupported Node subclass (defensive guard for future kinds added without codec extension; \u00a717.106b decoder will mirror this on unknown kinds)", () => {
      class MysteryNode { id = "z"; title = "z"; constructor() { /* not a v4 Node */ } get weight() { return Weight.of(1); } get children(): never[] { return []; } get disabled() { return false; } }
      const fake = new MysteryNode() as unknown as Node;
      expect(() => codec.encode(new Tree(fake))).toThrow(JsonCodecV4EncodeError);
    });
  });
});
