import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddChildServiceV4 } from "../../../application/AddChildServiceV4.js";
import type { AddChildPayloadV4 } from "../../../application/AddChildServiceV4.js";
import type { IdGenerator } from "../../../application/ports/IdGenerator.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { MAX_CHILDREN_V4 } from "../../../domain/capacity/childrenCapacityV4.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import { TextNodeV4 } from "../../../domain/nodes/TextNodeV4.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";
import { Weight } from "../../../domain/values/Weight.js";

const clock: Clock = { now: () => Timestamp.of(new Date("2026-05-16T10:00:00Z")) };
const makeRoot = (id = "root"): TextNodeV4 =>
  new TextNodeV4(id, "Root", Weight.of(1), clock);
const sequentialIdGen = (prefix = "uuid"): IdGenerator => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};
const fillToCap = (parent: TextNodeV4): void => {
  for (let i = 0; i < MAX_CHILDREN_V4; i++) {
    parent.attach(new TextNodeV4(`existing-${i}`, `E-${i}`, Weight.of(1), clock));
  }
};

const validBsc: AddChildPayloadV4 = {
  kind: "BusinessScore",
  title: "Revenue",
  description: "Monthly revenue",
  weight: 2,
  unit: "USD",
  objective: { value: 10_000, at: new Date("2026-12-31T00:00:00Z") },
  initialHistory: [
    { value: 1_500, asOf: new Date("2026-04-01T00:00:00Z") },
    { value: 3_000, asOf: new Date("2026-04-15T00:00:00Z") },
  ],
};

describe("AddChildServiceV4 (§17.100a — Phase C skeleton + 2 v3-compat kinds)", () => {
  let persist: ReturnType<typeof vi.fn>;
  let svc: AddChildServiceV4;

  beforeEach(() => {
    persist = vi.fn().mockResolvedValue(undefined);
    svc = new AddChildServiceV4(sequentialIdGen(), clock, persist);
  });

  it("TextNode — constructs + replays history + applies weight default + attaches + persists", async () => {
    const parent = makeRoot();
    const r1 = await svc.addChild(parent, {
      kind: "TextNode",
      title: "Notes",
      initialHistory: [
        { value: "old", asOf: new Date("2026-03-01T00:00:00Z") },
        { value: "newest", asOf: new Date("2026-04-01T00:00:00Z") },
      ],
    });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.child).toBeInstanceOf(TextNodeV4);
      expect(r1.child.id).toBe("uuid-1");
      expect(r1.child.title).toBe("Notes");
      expect(r1.child.parent).toBe(parent);
      expect((r1.child as TextNodeV4).getValue()).toBe("newest");
      expect((r1.child as TextNodeV4).entries()).toHaveLength(2);
    }

    const r2 = await svc.addChild(parent, { kind: "TextNode", title: "Quick" });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.child.weight.value).toBe(1);
      expect((r2.child as TextNodeV4).entries()).toHaveLength(0);
    }
    expect(parent.children).toHaveLength(2);
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("BusinessScore — objective + history + unit + description + disabled propagation + defaults", async () => {
    const parent = makeRoot();
    const r1 = await svc.addChild(parent, { ...validBsc, disabled: true });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      const bsn = r1.child as BusinessScoreNode<number>;
      expect(bsn).toBeInstanceOf(BusinessScoreNode);
      expect(bsn.title).toBe("Revenue");
      expect(bsn.getDescription()).toBe("Monthly revenue");
      expect(bsn.weight.value).toBe(2);
      expect(bsn.unit).toBe("USD");
      expect(bsn.objective.value).toBe(10_000);
      expect(bsn.objective.at.moment.toISOString()).toBe("2026-12-31T00:00:00.000Z");
      expect(bsn.entries().map((e) => e.value)).toEqual([1_500, 3_000]);
      expect(bsn.disabled).toBe(true);
    }

    const r2 = await svc.addChild(parent, {
      kind: "BusinessScore",
      title: "Fresh KPI",
      unit: "%",
      objective: { value: 100, at: new Date("2027-01-01T00:00:00Z") },
    });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      const bsn = r2.child as BusinessScoreNode<number>;
      expect(bsn.entries()).toHaveLength(0);
      expect(bsn.getDescription()).toBe("");
      expect(bsn.disabled).toBe(false);
    }
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("rejects when parent at MAX_CHILDREN_V4 — no construction, no persist, no mutation", async () => {
    const parent = makeRoot();
    fillToCap(parent);
    const r = await svc.addChild(parent, { kind: "TextNode", title: "Overflow" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/cap|MAX_CHILDREN|maximum/i);
    expect(parent.children).toHaveLength(MAX_CHILDREN_V4);
    expect(persist).not.toHaveBeenCalled();
  });

  it("payload validation — empty/whitespace title, non-positive weight, unknown kind all → { ok: false } with no mutation", async () => {
    const parent = makeRoot();
    const cases: AddChildPayloadV4[] = [
      { kind: "TextNode", title: "" },
      { kind: "TextNode", title: "   " },
      { kind: "TextNode", title: "Bad weight", weight: 0 },
      { kind: "Mystery" as "TextNode", title: "X" },
    ];
    for (const c of cases) {
      const r = await svc.addChild(parent, c);
      expect(r.ok).toBe(false);
    }
    expect(parent.children).toHaveLength(0);
    expect(persist).not.toHaveBeenCalled();
  });

  it("persistence boundary — rolls back attach if persist throws (atomicity); uses injected idGen verbatim", async () => {
    const parent = makeRoot();
    const failingPersist = vi.fn().mockRejectedValue(new Error("Storage full"));
    const taggingGen: IdGenerator = () => "explicit-id-xyz";
    const taggingSvc = new AddChildServiceV4(taggingGen, clock, failingPersist);

    const r = await taggingSvc.addChild(parent, { kind: "TextNode", title: "Doomed" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/storage full/i);
    expect(parent.children).toHaveLength(0);
    expect(failingPersist).toHaveBeenCalledTimes(1);

    const okSvc = new AddChildServiceV4(taggingGen, clock, persist);
    const r2 = await okSvc.addChild(makeRoot(), { kind: "TextNode", title: "T" });
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.child.id).toBe("explicit-id-xyz");
  });
});
