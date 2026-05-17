import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddChildServiceV4 } from "../../../application/AddChildServiceV4.js";
import type { AddChildPayloadV4 } from "../../../application/AddChildServiceV4.js";
import type { IdGenerator } from "../../../application/ports/IdGenerator.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { MAX_CHILDREN } from "../../../domain/capacity/childrenCapacity.js";
import { ComputationKind } from "../../../domain/computation/ComputationKind.js";
import { ComputationOverrideError } from "../../../domain/computation/ComputationOverrideError.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../domain/nodes/ComputedNode.js";
import { StrictRangeNode } from "../../../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";
import { Weight } from "../../../domain/values/Weight.js";

const clock: Clock = { now: () => Timestamp.of(new Date("2026-05-16T10:00:00Z")) };
const makeRoot = (id = "root"): TextNode =>
  new TextNode(id, "Root", Weight.of(1), clock);
const sequentialIdGen = (prefix = "uuid"): IdGenerator => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};
const fillToCap = (parent: TextNode): void => {
  for (let i = 0; i < MAX_CHILDREN; i++) {
    parent.attach(new TextNode(`existing-${i}`, `E-${i}`, Weight.of(1), clock));
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
      expect(r1.child).toBeInstanceOf(TextNode);
      expect(r1.child.id).toBe("uuid-1");
      expect(r1.child.title).toBe("Notes");
      expect(r1.child.parent).toBe(parent);
      expect((r1.child as TextNode).getValue()).toBe("newest");
      expect((r1.child as TextNode).entries()).toHaveLength(2);
    }

    const r2 = await svc.addChild(parent, { kind: "TextNode", title: "Quick" });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.child.weight.value).toBe(1);
      expect((r2.child as TextNode).entries()).toHaveLength(0);
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

  it("rejects when parent at MAX_CHILDREN — no construction, no persist, no mutation", async () => {
    const parent = makeRoot();
    fillToCap(parent);
    const r = await svc.addChild(parent, { kind: "TextNode", title: "Overflow" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/cap|MAX_CHILDREN|maximum/i);
    expect(parent.children).toHaveLength(MAX_CHILDREN);
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

  it("StrictRange (§17.100b) — bounded min/max + history + descending range + out-of-range rejection + disabled", async () => {
    const parent = makeRoot();
    const ok = await svc.addChild(parent, {
      kind: "StrictRange",
      title: "Latency p95",
      description: "ms",
      min: 0,
      max: 1_000,
      initialHistory: [
        { value: 250, asOf: new Date("2026-04-01T00:00:00Z") },
        { value: 320, asOf: new Date("2026-04-15T00:00:00Z") },
      ],
      disabled: true,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const srn = ok.child as StrictRangeNode<number>;
      expect(srn).toBeInstanceOf(StrictRangeNode);
      expect(srn.range.minimalValue).toBe(0);
      expect(srn.range.maximalValue).toBe(1_000);
      expect(srn.getValue()).toBe(320);
      expect(srn.disabled).toBe(true);
    }

    // descending range [100..0] is direction-agnostic per §17.71 sign-product trick
    const desc = await svc.addChild(parent, {
      kind: "StrictRange", title: "Defects", min: 100, max: 0,
      initialHistory: [{ value: 50, asOf: new Date("2026-04-01T00:00:00Z") }],
    });
    expect(desc.ok).toBe(true);

    // out-of-range entry surfaces as { ok: false }
    const oor = await svc.addChild(parent, {
      kind: "StrictRange", title: "Saturation", min: 0, max: 100,
      initialHistory: [{ value: 250, asOf: new Date("2026-04-01T00:00:00Z") }],
    });
    expect(oor.ok).toBe(false);
    if (!oor.ok) expect(oor.reason).toMatch(/out of range/i);
  });

  it("Computed (§17.100b) — all 6 ComputationKinds + ComputationOverrideError on addValue + disabled", async () => {
    for (const kind of ComputationKind.ALL) {
      const r = await svc.addChild(makeRoot(`p-${kind.name}`), {
        kind: "Computed", title: `T-${kind.name}`, computationKind: kind,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const cn = r.child as ComputedNode<number>;
        expect(cn).toBeInstanceOf(ComputedNode);
        expect(cn.computationKind).toBe(kind);
      }
    }
    const r = await svc.addChild(makeRoot(), {
      kind: "Computed", title: "X", computationKind: ComputationKind.AVERAGE, disabled: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const cn = r.child as ComputedNode<number>;
      expect(cn.disabled).toBe(true);
      expect(() => cn.addValue(Timestamp.of(new Date("2026-05-01T00:00:00Z")), 1)).toThrow(
        ComputationOverrideError,
      );
    }
  });

  it("ComputedBusinessScore (§17.100b) — objective + unit + computationKind + audit-only addValue + disabled", async () => {
    const r = await svc.addChild(makeRoot(), {
      kind: "ComputedBusinessScore",
      title: "Aggregate score",
      description: "weighted mean of child KPIs",
      weight: 3,
      unit: "%",
      objective: { value: 95, at: new Date("2026-12-31T00:00:00Z") },
      computationKind: ComputationKind.WEIGHTED_AVERAGE,
      disabled: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const cbsn = r.child as ComputedBusinessScoreNode<number>;
      expect(cbsn).toBeInstanceOf(ComputedBusinessScoreNode);
      expect(cbsn.computationKind).toBe(ComputationKind.WEIGHTED_AVERAGE);
      expect(cbsn.unit).toBe("%");
      expect(cbsn.objective.value).toBe(95);
      expect(cbsn.weight.value).toBe(3);
      expect(cbsn.disabled).toBe(true);
      expect(() => cbsn.addValue(Timestamp.of(new Date("2026-05-01T00:00:00Z")), 1)).toThrow(
        ComputationOverrideError,
      );
    }
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
