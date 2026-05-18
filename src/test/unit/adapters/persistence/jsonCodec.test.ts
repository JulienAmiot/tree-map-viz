import { describe, expect, it } from "vitest";

import {
  createJsonCodec,
  JsonCodecDecodeError,
  JsonCodecEncodeError,
} from "../../../../adapters/persistence/jsonCodec.js";
import { buildSampleTree } from "../../../../adapters/sampleData.js";
import { buildShowcaseTree } from "../../../../adapters/showcaseSeed.js";
import { BusinessScoreCard } from "../../../../domain/cards/BusinessScoreCard.js";
import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { ComputationKind } from "../../../../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../../domain/nodes/ComputedNode.js";
import type { Node } from "../../../../domain/nodes/Node.js";
import { PictureNode } from "../../../../domain/nodes/PictureNode.js";
import { StrictRangeNode } from "../../../../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { WorkflowNode } from "../../../../domain/nodes/WorkflowNode.js";
import { URLNode } from "../../../../domain/nodes/URLNode.js";
import { Tree } from "../../../../domain/Tree.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { LenientRange, StrictRange } from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Unit } from "../../../../domain/values/Unit.js";
import { Weight } from "../../../../domain/values/Weight.js";

const NOW = new Date("2026-05-16T12:00:00Z");
const TARGET = Timestamp.of(new Date("2026-12-31T00:00:00.000Z"));
const T1 = Timestamp.of(new Date("2026-04-22T18:25:43.511Z"));
const T2 = Timestamp.of(new Date("2026-05-01T00:00:00.000Z"));
const clock: Clock = { now: () => Timestamp.of(NOW) };
const codec = createJsonCodec(clock);

function lenient(): LenientRange<number> {
  return LenientRange.of(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, NumericComparator.INSTANCE);
}

function makeBSN(id: string, opts: { unit?: string; disabled?: boolean; history?: [Timestamp, number][] } = {}): BusinessScoreNode<number> {
  const node = new BusinessScoreNode<number>(
    id, id, Weight.of(1), `desc-${id}`, clock, lenient(),
    opts.unit === undefined ? { objective: Objective.of(100, TARGET) } : { objective: Objective.of(100, TARGET), unit: opts.unit },
  );
  for (const [at, v] of opts.history ?? []) node.addValue(at, v);
  if (opts.disabled) node.setDisabled(true);
  return node;
}

describe("jsonCodecV4 (§17.106a + §17.106b — v4-native encode + decode)", () => {
  describe("encode — per-kind shapes + cards sidecar + schema envelope", () => {
    it("envelope = {schemaVersion:\"v4.0\", root, cards[]}; cards sidecar serialised as flat [{nodeId,unit}] list", () => {
      const bsn = makeBSN("root", { unit: "%" });
      const cards = new Map<string, BusinessScoreCard<unknown>>();
      cards.set("root", new BusinessScoreCard(bsn, Unit.percent()));
      const json = JSON.parse(codec.encode(new Tree(bsn, cards))) as Record<string, unknown>;
      expect(json.schemaVersion).toBe("v4.0");
      expect(json.cards).toEqual([{ nodeId: "root", unit: "%" }]);
      expect((json.root as { kind: string }).kind).toBe("BusinessScoreNode");
    });

    it("TextNode + BusinessScoreNode emit per-kind shapes; disabled OMITTED when false / EMITTED when true; unit OMITTED when empty; range uses null sentinel for ±Infinity", () => {
      const t = new TextNode("t", "Notes", Weight.of(1), clock);
      t.addValue(T1, "hello");
      const tWire = JSON.parse(codec.encode(new Tree(t))).root as Record<string, unknown>;
      expect(tWire.kind).toBe("TextNode");
      expect(tWire.history).toEqual([{ value: "hello", at: T1.moment.toISOString() }]);
      expect("disabled" in tWire).toBe(false);
      t.setDisabled(true);
      expect((JSON.parse(codec.encode(new Tree(t))).root as Record<string, unknown>).disabled).toBe(true);
      const bsn = makeBSN("b");
      const bsnWire = JSON.parse(codec.encode(new Tree(bsn))).root as Record<string, unknown>;
      expect(bsnWire.range).toEqual({ kind: "lenient", min: null, max: null });
      expect("unit" in bsnWire).toBe(false);
    });

    it("ComputedBusinessScoreNode emits computationKind + NO history; ComputedNode emits computationKind only (no range/objective/history); StrictRangeNode emits strict range with finite bounds + history", () => {
      const cbsn = new ComputedBusinessScoreNode<number>("agg", "Agg", Weight.of(1), "d", clock, lenient(), { objective: Objective.of(50, TARGET), initialKind: ComputationKind.WEIGHTED_AVERAGE });
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
      expect(srnWire.kind).toBe("StrictRangeNode");
      expect(srnWire.range).toEqual({ kind: "strict", min: 0, max: 100 });
      expect(srnWire.history).toEqual([{ value: 70, at: T1.moment.toISOString() }]);
    });

    it("encodes nested children recursively + preserves child order across kinds (sampleDataV4 composite tree round-trips its node ID list verbatim through encode→JSON.parse)", () => {
      const tree = buildSampleTree(clock);
      const wire = JSON.parse(codec.encode(tree)) as { root: { id: string; children: unknown[] } };
      const collectIds = (n: { id: string; children: unknown[] }): string[] =>
        [n.id, ...(n.children as { id: string; children: unknown[] }[]).flatMap(collectIds)];
      expect(collectIds(wire.root)).toEqual(tree.nodes().map((n) => n.id));
    });

    it("encode throws JsonCodecEncodeError on unsupported Node subclass (defensive guard)", () => {
      const fake = { id: "z", title: "z", weight: Weight.of(1), children: [] as never[], disabled: false, constructor: { name: "MysteryV5Node" } } as unknown as Node;
      expect(() => codec.encode(new Tree(fake))).toThrow(JsonCodecEncodeError);
    });
  });

  describe("decode — schema/kind validation + per-kind reconstruction + RFC-6901 pointers + cards sidecar resolution", () => {
    it("envelope + kind validation: malformed JSON → typed error at \"/\"; missing or mismatching schemaVersion → typed error; unknown `kind` discriminant + unknown ComputationKind name surface with RFC-6901 pointers", () => {
      expect(() => codec.decode("{not json")).toThrow(JsonCodecDecodeError);
      expect(() => codec.decode(JSON.stringify({ schemaVersion: "v5.0", root: {}, cards: [] }))).toThrow(/schemaVersion/);
      expect(() => codec.decode(JSON.stringify({ root: {}, cards: [] }))).toThrow(/schemaVersion/);
      const unknownKind = { schemaVersion: "v4.0", root: { kind: "MysteryV5", id: "x", title: "x", weight: 1, children: [] }, cards: [] };
      expect(() => codec.decode(JSON.stringify(unknownKind))).toThrow(/unknown kind "MysteryV5"/);
      const unknownComp = { schemaVersion: "v4.0", root: { kind: "ComputedNode", id: "c", title: "c", weight: 1, description: "", computationKind: "MOOD", children: [] }, cards: [] };
      expect(() => codec.decode(JSON.stringify(unknownComp))).toThrow(/unknown ComputationKind name "MOOD"/);
    });

    it("range bounds reversal: null ↔ ±Infinity on LenientRange; finite numbers verbatim on StrictRange; ComputationKind.fromName resolves canonical singletons via reference equality", () => {
      const decodedBsn = codec.decode(codec.encode(new Tree(makeBSN("u", { unit: "%" })))).root as BusinessScoreNode<number>;
      expect([decodedBsn.range.minimalValue, decodedBsn.range.maximalValue]).toEqual([Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]);
      const srn = new StrictRangeNode<number>("s", "S", Weight.of(1), "", clock, StrictRange.of(0, 100, NumericComparator.INSTANCE));
      const decodedSrn = codec.decode(codec.encode(new Tree(srn))).root as StrictRangeNode<number>;
      expect([decodedSrn.range.minimalValue, decodedSrn.range.maximalValue]).toEqual([0, 100]);
      const cbsn = new ComputedBusinessScoreNode<number>("agg", "x", Weight.of(1), "", clock, lenient(), { objective: Objective.of(1, TARGET), initialKind: ComputationKind.MIN });
      expect((codec.decode(codec.encode(new Tree(cbsn))).root as ComputedBusinessScoreNode<number>).computationKind).toBe(ComputationKind.MIN);
    });

    it("disabled:true applied uniformly across every ValueNode subclass on decode (§17.99a); cards sidecar resolves nodeId via DFS; throws on missing/non-BSN nodeId", () => {
      const ids = ["off-bsn", "off-cbsn", "off-cn", "off-srn", "off-text"] as const;
      const root = makeBSN("root", { unit: "%" });
      root.attach(makeBSN(ids[0], { disabled: true }));
      const cbsnOff = new ComputedBusinessScoreNode<number>(ids[1], "x", Weight.of(1), "", clock, lenient(), { objective: Objective.of(1, TARGET), initialKind: ComputationKind.SUM }); cbsnOff.setDisabled(true); root.attach(cbsnOff);
      const cnOff = new ComputedNode<number>(ids[2], "x", Weight.of(1), "", clock, ComputationKind.SUM); cnOff.setDisabled(true); root.attach(cnOff);
      const srnOff = new StrictRangeNode<number>(ids[3], "x", Weight.of(1), "", clock, StrictRange.of(0, 1, NumericComparator.INSTANCE)); srnOff.setDisabled(true); root.attach(srnOff);
      const tOff = new TextNode(ids[4], "x", Weight.of(1), clock); tOff.setDisabled(true); root.attach(tOff);
      const cards = new Map<string, BusinessScoreCard<unknown>>(); cards.set("root", new BusinessScoreCard(root, Unit.of("ms")));
      const decoded = codec.decode(codec.encode(new Tree(root, cards)));
      for (const id of ids) expect((decoded.findById(id) as unknown as { disabled: boolean }).disabled, id).toBe(true);
      expect(decoded.cards.get("root")?.getUnit().value).toBe("ms");
      const missingWire = { schemaVersion: "v4.0", root: JSON.parse(codec.encode(new Tree(makeBSN("only")))).root, cards: [{ nodeId: "ghost", unit: "%" }] };
      expect(() => codec.decode(JSON.stringify(missingWire))).toThrow(/no BusinessScoreNode/);
    });
  });

  describe("round-trip preservation — every v4 kind survives encode→decode unchanged (closes the §17.106a→§17.106b gap)", () => {
    it("BusinessScoreNode full surface (history + objective + disabled + unit) round-trips, chronological order preserved AND sampleDataV4 round-trips every kind + every computationKind singleton + cards sidecar key-set", () => {
      const bsn = makeBSN("b", { unit: "%", disabled: true, history: [[T1, 50], [T2, 75]] });
      const decoded = codec.decode(codec.encode(new Tree(bsn))).root as BusinessScoreNode<number>;
      expect([decoded.id, decoded.unit, decoded.disabled, decoded.objective.value]).toEqual(["b", "%", true, 100]);
      expect(decoded.entries().map((e) => [e.asOf.moment.toISOString(), e.value])).toEqual([[T1.moment.toISOString(), 50], [T2.moment.toISOString(), 75]]);
      const original = buildSampleTree(clock);
      const rt = codec.decode(codec.encode(original));
      expect(rt.nodes().map((n) => n.id)).toEqual(original.nodes().map((n) => n.id));
      for (const orig of original.nodes()) {
        const round = rt.findById(orig.id)!;
        expect(round.constructor.name, orig.id).toBe(orig.constructor.name);
        if (orig instanceof ComputedBusinessScoreNode) expect((round as ComputedBusinessScoreNode<number>).computationKind).toBe(orig.computationKind);
        if (orig instanceof ComputedNode) expect((round as ComputedNode<number>).computationKind).toBe(orig.computationKind);
      }
      expect([...rt.cards.keys()].sort()).toEqual([...original.cards.keys()].sort());
    });

    it("Tree from showcaseSeedV4 (§17.109) round-trips byte-exact: encode(decode(json)) === json + sales-lost.disabled survives", () => {
      const original = buildShowcaseTree(clock, NOW);
      const json = codec.encode(original);
      const decoded = codec.decode(json);
      expect(decoded.nodes().map((n) => n.id)).toEqual(original.nodes().map((n) => n.id));
      expect([...decoded.cards.keys()].sort()).toEqual([...original.cards.keys()].sort());
      expect((decoded.findById("sales-lost") as BusinessScoreNode<number>).disabled).toBe(true);
      expect(codec.encode(decoded)).toBe(json);
    });
  });

  /**
   * SPEC §17.119 — PictureNode wire format. Snapshot leaf carrying a
   * single `imageUrl` string; no history / objective / description /
   * range. The shape mirrors TextNode minus the `history` array plus
   * a mandatory `imageUrl` row.
   */
  describe("PictureNode (§17.119)", () => {
    it("encodes the snapshot shape: kind + commonFields + imageUrl (no history / objective / description)", () => {
      const root = new TextNode("root", "Root", Weight.of(1), clock);
      root.addValue(T1, "anchor");
      const pic = new PictureNode(
        "pic",
        "Cat",
        Weight.of(2),
        "https://example.com/cat.jpg",
      );
      root.attach(pic);
      const wire = JSON.parse(codec.encode(new Tree(root))) as {
        root: { children: { kind: string; imageUrl: string; id: string; title: string; weight: number; children: unknown[] }[] };
      };
      const child = wire.root.children[0]!;
      expect(child.kind).toBe("PictureNode");
      expect(child.id).toBe("pic");
      expect(child.title).toBe("Cat");
      expect(child.weight).toBe(2);
      expect(child.imageUrl).toBe("https://example.com/cat.jpg");
      expect(child.children).toEqual([]);
      // No leak of history / objective / range / description on a
      // PictureNode wire row.
      expect("history" in child).toBe(false);
      expect("objective" in child).toBe(false);
      expect("range" in child).toBe(false);
      expect("description" in child).toBe(false);
    });

    it("emits disabled:true when the node is parked and OMITS it otherwise", () => {
      const pic = new PictureNode("p", "P", Weight.of(1), "https://x");
      const wireA = JSON.parse(codec.encode(new Tree(pic))).root as Record<string, unknown>;
      expect("disabled" in wireA).toBe(false);
      pic.setDisabled(true);
      const wireB = JSON.parse(codec.encode(new Tree(pic))).root as Record<string, unknown>;
      expect(wireB.disabled).toBe(true);
    });

    it("round-trips a sibling tree mixing TextNode and PictureNode (subclass dispatch picks the right kind on each side)", () => {
      const root = new TextNode("root", "Root", Weight.of(1), clock);
      root.addValue(T1, "anchor");
      const pic = new PictureNode("pic", "Cat", Weight.of(1), "https://example.com/cat.jpg");
      const txt = new TextNode("txt", "Notes", Weight.of(1), clock);
      txt.addValue(T1, "hello");
      root.attach(pic);
      root.attach(txt);
      const json = codec.encode(new Tree(root));
      const decoded = codec.decode(json);
      const decodedPic = decoded.findById("pic");
      const decodedTxt = decoded.findById("txt");
      expect(decodedPic).toBeInstanceOf(PictureNode);
      expect(decodedTxt).toBeInstanceOf(TextNode);
      expect((decodedPic as PictureNode).imageUrl).toBe(
        "https://example.com/cat.jpg",
      );
      expect((decodedTxt as TextNode).getValue()).toBe("hello");
      // Byte-exact re-encode confirms the round-trip is loss-free.
      expect(codec.encode(decoded)).toBe(json);
    });

    it("decode rejects a PictureNode with a missing or empty imageUrl (the node constructor's non-empty guard fires through the codec)", () => {
      const noUrl = {
        schemaVersion: "v4.0",
        root: {
          kind: "PictureNode",
          id: "p",
          title: "P",
          weight: 1,
          children: [],
        },
        cards: [],
      };
      expect(() => codec.decode(JSON.stringify(noUrl))).toThrow(/imageUrl/);
      const emptyUrl = {
        ...noUrl,
        root: { ...noUrl.root, imageUrl: "" },
      };
      expect(() => codec.decode(JSON.stringify(emptyUrl))).toThrow(/cannot be empty/);
    });
  });

  describe("WorkflowNode (§17.117 — TextNode + statusId)", () => {
    it("encode emits kind=\"WorkflowNode\" with the statusId field AND a string-typed history (the more-specific kind wins over the generic TextNode branch because WorkflowNode IS-A TextNode)", () => {
      const wf = new WorkflowNode("w-1", "Sprint task", Weight.of(2), clock, "do");
      wf.addValue(T1, "design draft");
      wf.addValue(T2, "review pending");
      const wire = JSON.parse(codec.encode(new Tree(wf))).root as Record<string, unknown>;
      expect(wire).toMatchObject({
        kind: "WorkflowNode",
        id: "w-1",
        title: "Sprint task",
        weight: 2,
        statusId: "do",
        children: [],
      });
      expect(wire.history).toEqual([
        { value: "design draft", at: T1.moment.toISOString() },
        { value: "review pending", at: T2.moment.toISOString() },
      ]);
      // `disabled` stays omitted when the node is enabled (parity with
      // every other ValueNode kind).
      expect("disabled" in wire).toBe(false);
    });

    it("decode rebuilds a WorkflowNode (not a TextNode) with the statusId + history restored exactly", () => {
      const original = new WorkflowNode("w-1", "Sprint task", Weight.of(1), clock, "check");
      original.addValue(T1, "hello");
      original.addValue(T2, "world");
      original.setDisabled(true);
      const decoded = codec.decode(codec.encode(new Tree(original))).root;
      expect(decoded).toBeInstanceOf(WorkflowNode);
      expect((decoded as WorkflowNode).statusId).toBe("check");
      expect((decoded as WorkflowNode).disabled).toBe(true);
      expect(
        (decoded as WorkflowNode).entries().map((e) => [
          e.asOf.moment.toISOString(),
          e.value,
        ]),
      ).toEqual([
        [T1.moment.toISOString(), "hello"],
        [T2.moment.toISOString(), "world"],
      ]);
    });

    it("decode of a v4.0 envelope missing the statusId field surfaces a typed JsonCodecDecodeError pointing at the offending pointer", () => {
      const wire = {
        schemaVersion: "v4.0",
        root: {
          kind: "WorkflowNode",
          id: "w",
          title: "T",
          weight: 1,
          history: [],
          children: [],
        },
        cards: [],
      };
      expect(() => codec.decode(JSON.stringify(wire))).toThrow(JsonCodecDecodeError);
      expect(() => codec.decode(JSON.stringify(wire))).toThrow(/statusId/);
    });

    it("Workflow + Text siblings in the same tree round-trip without one shadowing the other (the §17.117 instanceof ordering invariant)", () => {
      const root = new TextNode("root", "Root", Weight.of(1), clock);
      root.addValue(T1, "root body");
      const wfChild = new WorkflowNode("wf-1", "Workflow leaf", Weight.of(1), clock, "act");
      wfChild.addValue(T2, "in progress");
      const textChild = new TextNode("text-1", "Plain leaf", Weight.of(1), clock);
      textChild.addValue(T2, "plain body");
      root.attach(wfChild);
      root.attach(textChild);
      const decoded = codec.decode(codec.encode(new Tree(root)));
      const wfRound = decoded.findById("wf-1")!;
      const textRound = decoded.findById("text-1")!;
      expect(wfRound).toBeInstanceOf(WorkflowNode);
      expect((wfRound as WorkflowNode).statusId).toBe("act");
      expect(textRound).toBeInstanceOf(TextNode);
      // Defensive: the plain TextNode must NOT have been promoted to
      // WorkflowNode by accident.
      expect(textRound).not.toBeInstanceOf(WorkflowNode);
    });
  });

  /**
   * SPEC §17.120 — URLNode wire format. Snapshot leaf carrying the URL
   * in the standard `description` slot (per the operator's "URL is in
   * the description" contract). No history / objective / range; no
   * dedicated `url` field on the wire. The shape mirrors PictureNode's
   * snapshot envelope but swaps `imageUrl` for the reused `description`
   * field — letting future description-aware codec tooling treat URL
   * nodes uniformly with TextNode / StrictRangeNode / ComputedNode
   * description rows.
   */
  describe("URLNode (§17.120)", () => {
    it("encodes the snapshot shape: kind + commonFields + description (the URL lives in the description slot; no separate url field; no history / objective / range)", () => {
      const root = new TextNode("root", "Root", Weight.of(1), clock);
      root.addValue(T1, "anchor");
      const url = new URLNode("url", "Docs", Weight.of(3), "https://example.com/docs");
      root.attach(url);
      const wire = JSON.parse(codec.encode(new Tree(root))) as {
        root: { children: { kind: string; description: string; id: string; title: string; weight: number; children: unknown[] }[] };
      };
      const child = wire.root.children[0]!;
      expect(child.kind).toBe("URLNode");
      expect(child.id).toBe("url");
      expect(child.title).toBe("Docs");
      expect(child.weight).toBe(3);
      // SPEC §17.120 — the URL ships under `description`, not `url`.
      expect(child.description).toBe("https://example.com/docs");
      expect(child.children).toEqual([]);
      // No leak of history / objective / range / imageUrl / url on a
      // URLNode wire row.
      expect("history" in child).toBe(false);
      expect("objective" in child).toBe(false);
      expect("range" in child).toBe(false);
      expect("imageUrl" in child).toBe(false);
      expect("url" in child).toBe(false);
    });

    it("emits disabled:true when the node is parked and OMITS it otherwise", () => {
      const u = new URLNode("u", "U", Weight.of(1), "https://x");
      const wireA = JSON.parse(codec.encode(new Tree(u))).root as Record<string, unknown>;
      expect("disabled" in wireA).toBe(false);
      u.setDisabled(true);
      const wireB = JSON.parse(codec.encode(new Tree(u))).root as Record<string, unknown>;
      expect(wireB.disabled).toBe(true);
    });

    it("round-trips a sibling tree mixing TextNode, PictureNode, and URLNode (subclass dispatch picks the right kind on each side; PictureNode and URLNode do NOT confuse each other despite both being ValueNode<string> snapshot leaves)", () => {
      const root = new TextNode("root", "Root", Weight.of(1), clock);
      root.addValue(T1, "anchor");
      const url = new URLNode("url", "Docs", Weight.of(1), "https://example.com/docs");
      const pic = new PictureNode("pic", "Cat", Weight.of(1), "https://example.com/cat.jpg");
      const txt = new TextNode("txt", "Notes", Weight.of(1), clock);
      txt.addValue(T1, "hello");
      root.attach(url);
      root.attach(pic);
      root.attach(txt);
      const json = codec.encode(new Tree(root));
      const decoded = codec.decode(json);
      const decodedUrl = decoded.findById("url");
      const decodedPic = decoded.findById("pic");
      const decodedTxt = decoded.findById("txt");
      // SPEC §17.120 — instanceof discrimination is exact on decode:
      // a URLNode never round-trips as a PictureNode and vice versa,
      // even though both encode with the same commonFields slice.
      expect(decodedUrl).toBeInstanceOf(URLNode);
      expect(decodedUrl).not.toBeInstanceOf(PictureNode);
      expect(decodedPic).toBeInstanceOf(PictureNode);
      expect(decodedPic).not.toBeInstanceOf(URLNode);
      expect(decodedTxt).toBeInstanceOf(TextNode);
      expect((decodedUrl as URLNode).url).toBe("https://example.com/docs");
      expect((decodedUrl as URLNode).getDescription()).toBe(
        "https://example.com/docs",
      );
      expect((decodedPic as PictureNode).imageUrl).toBe(
        "https://example.com/cat.jpg",
      );
      expect((decodedTxt as TextNode).getValue()).toBe("hello");
      // Byte-exact re-encode confirms the round-trip is loss-free.
      expect(codec.encode(decoded)).toBe(json);
    });

    it("decode rejects a URLNode with a missing or empty description (the node constructor's non-empty guard fires through the codec)", () => {
      const noUrl = {
        schemaVersion: "v4.0",
        root: {
          kind: "URLNode",
          id: "u",
          title: "U",
          weight: 1,
          children: [],
        },
        cards: [],
      };
      expect(() => codec.decode(JSON.stringify(noUrl))).toThrow(/description/);
      const emptyUrl = {
        ...noUrl,
        root: { ...noUrl.root, description: "" },
      };
      expect(() => codec.decode(JSON.stringify(emptyUrl))).toThrow(/cannot be empty/);
    });

    it("decode preserves disabled:true on a URLNode", () => {
      const env = {
        schemaVersion: "v4.0",
        root: {
          kind: "URLNode",
          id: "u",
          title: "U",
          weight: 1,
          description: "https://x.example",
          disabled: true,
          children: [],
        },
        cards: [],
      };
      const decoded = codec.decode(JSON.stringify(env));
      const u = decoded.findById("u");
      expect(u).toBeInstanceOf(URLNode);
      expect((u as URLNode).disabled).toBe(true);
    });

    it("decode accepts custom URL schemes (mailto:, tel:, custom-scheme://, plain text) — the codec stays loose about URL shape, mirroring the domain layer", () => {
      // SPEC §17.120 — the QR code library accepts arbitrary text; the
      // codec must not reject inputs the domain accepts.
      const candidates = [
        "mailto:ops@example.com",
        "tel:+33-1-23-45-67-89",
        "custom-scheme://payload",
        "just some text",
      ];
      for (const desc of candidates) {
        const env = {
          schemaVersion: "v4.0",
          root: {
            kind: "URLNode",
            id: "u",
            title: "U",
            weight: 1,
            description: desc,
            children: [],
          },
          cards: [],
        };
        const decoded = codec.decode(JSON.stringify(env));
        expect((decoded.findById("u") as URLNode).url).toBe(desc);
      }
    });
  });
});
