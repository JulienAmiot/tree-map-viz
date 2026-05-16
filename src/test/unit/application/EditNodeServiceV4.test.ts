import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditNodeServiceV4 } from "../../../application/EditNodeServiceV4.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { BusinessScoreCardV4 } from "../../../domain/cards/BusinessScoreCardV4.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import { TextNodeV4 } from "../../../domain/nodes/TextNodeV4.js";
import { NumericComparator } from "../../../domain/values/Comparator.js";
import { ObjectiveV4 } from "../../../domain/values/ObjectiveV4.js";
import { LenientRange } from "../../../domain/values/Range.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";
import { Unit } from "../../../domain/values/Unit.js";
import { Weight } from "../../../domain/values/Weight.js";

const NOW = new Date("2026-05-16T14:00:00Z");
const clock: Clock = { now: () => Timestamp.of(NOW) };
const makeText = (history: [string, string][] = []): TextNodeV4 => {
  const n = new TextNodeV4("t1", "Notes", Weight.of(1), clock);
  for (const [iso, v] of history) n.addValue(Timestamp.of(new Date(iso)), v);
  return n;
};
const makeBSN = (unit = "%"): BusinessScoreNode<number> => new BusinessScoreNode<number>(
  "b1", "Revenue", Weight.of(2), "old desc", clock,
  LenientRange.of(0, 1_000, NumericComparator.INSTANCE),
  { objective: ObjectiveV4.of(100, Timestamp.of(new Date("2026-12-31T00:00:00Z"))), unit },
);

describe("EditNodeServiceV4 (§17.101a — Phase C skeleton + 2 v3-compat kinds + appendValue)", () => {
  let persist: ReturnType<typeof vi.fn>;
  let svc: EditNodeServiceV4;

  beforeEach(() => {
    persist = vi.fn().mockResolvedValue(undefined);
    svc = new EditNodeServiceV4(clock, persist);
  });

  it("Text edit — title + weight + disabled propagate; trim applies; persist invoked once", async () => {
    const node = makeText();
    const r = await svc.editFields(node, {
      kind: "TextNode", title: "  Renamed  ", weight: 3, disabled: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(node.title).toBe("Renamed");
      expect(node.weight.value).toBe(3);
      expect(node.disabled).toBe(true);
    }
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("BusinessScore edit — title + description + weight + objective + unit (via card) + disabled all apply atomically", async () => {
    const node = makeBSN();
    const card = new BusinessScoreCardV4(node, Unit.of("%"));
    const cards = new Map([["b1", card]]);
    const r = await svc.editFields(node, {
      kind: "BusinessScore",
      title: "Sales",
      description: "EU monthly",
      weight: 5,
      objective: { value: 250, at: new Date("2027-06-30T00:00:00Z") },
      unit: "$",
      disabled: true,
    }, { cards });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(node.title).toBe("Sales");
      expect(node.getDescription()).toBe("EU monthly");
      expect(node.weight.value).toBe(5);
      expect(node.objective.value).toBe(250);
      expect(node.objective.at.moment.toISOString()).toBe("2027-06-30T00:00:00.000Z");
      expect(card.getUnit().value).toBe("$");
      expect(node.disabled).toBe(true);
    }
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("validation + rollback — kind mismatch, empty title, bad weight, unit-without-card, persist-throw all → { ok: false } with no mutation", async () => {
    const text = makeText();
    const bsn0 = makeBSN();
    const titleBefore = text.title;
    const r1 = await svc.editFields(text, { kind: "BusinessScore", title: "X" });
    const r2 = await svc.editFields(text, { kind: "TextNode", title: "   " });
    const r3 = await svc.editFields(text, { kind: "TextNode", weight: 0 });
    const r4 = await svc.editFields(bsn0, { kind: "BusinessScore", unit: "$" });
    for (const r of [r1, r2, r3, r4]) expect(r.ok).toBe(false);
    expect(text.title).toBe(titleBefore);
    expect(bsn0.unit).toBe("%");
    expect(persist).not.toHaveBeenCalled();

    const failing = vi.fn().mockRejectedValue(new Error("Storage down"));
    const bsn = makeBSN();
    const card = new BusinessScoreCardV4(bsn, Unit.of("%"));
    const failSvc = new EditNodeServiceV4(clock, failing);
    const before = { title: bsn.title, obj: bsn.objective, unit: card.getUnit() };
    const r5 = await failSvc.editFields(bsn, {
      kind: "BusinessScore", title: "NewName",
      objective: { value: 999, at: new Date("2028-01-01T00:00:00Z") }, unit: "kg",
    }, { cards: new Map([["b1", card]]) });
    expect(r5.ok).toBe(false);
    expect(bsn.title).toBe(before.title);
    expect(bsn.objective).toBe(before.obj);
    expect(card.getUnit()).toBe(before.unit);
  });

  it("appendValue — Text + BSC; default asOf uses clock; type mismatch + persist-throw → { ok: false } with rollback", async () => {
    const text = makeText([["2026-04-01T00:00:00Z", "old"]]);
    const r1 = await svc.appendValue(text, "newest");
    expect(r1.ok).toBe(true);
    expect(text.getValue()).toBe("newest");
    expect(text.entries().at(-1)!.asOf.moment.toISOString()).toBe(NOW.toISOString());

    const bsn = makeBSN();
    const r2 = await svc.appendValue(bsn, 42, new Date("2026-03-15T00:00:00Z"));
    expect(r2.ok).toBe(true);
    expect(bsn.getValue()).toBe(42);

    expect((await svc.appendValue(text, 123 as never)).ok).toBe(false);

    const failing = vi.fn().mockRejectedValue(new Error("nope"));
    const before = bsn.entries().length;
    const r3 = await new EditNodeServiceV4(clock, failing).appendValue(bsn, 99);
    expect(r3.ok).toBe(false);
    expect(bsn.entries()).toHaveLength(before);
  });
});
