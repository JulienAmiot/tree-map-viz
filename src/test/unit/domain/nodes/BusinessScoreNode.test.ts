import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { BusinessScoreNode } from "../../../../domain/nodes/BusinessScoreNode.js";
import { HistorizableValueNode } from "../../../../domain/nodes/HistorizableValueNode.js";
import { Node } from "../../../../domain/nodes/Node.js";
import { RangedValueNode } from "../../../../domain/nodes/RangedValueNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import { ObjectiveV4 } from "../../../../domain/values/ObjectiveV4.js";
import { LenientRange } from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const clk = (iso: string): Clock => ({ now: () => T(iso) });
const lenient = (): LenientRange<number> => LenientRange.of(0, 100, NumericComparator.INSTANCE);
const goal = (): ObjectiveV4<number> => ObjectiveV4.of(80, T("2026-12-31T00:00:00Z"));

const node = (
  range: LenientRange<number> = lenient(),
  objective: ObjectiveV4<number> = goal(),
  clockIso = "2026-05-10T12:00:00Z",
): BusinessScoreNode<number> =>
  new BusinessScoreNode<number>("bsn-1", "Sales", Weight.of(1), "desc", clk(clockIso), range, objective);

describe("BusinessScoreNode (§17.76 — v4 part 12: concrete range-bounded node with Objective)", () => {
  describe("inheritance chain (5-layer concrete leaf)", () => {
    it("extends RangedValueNode → HistorizableValueNode → ValueNode → Node and inherits identity + description", () => {
      const n = node();
      expect(n).toBeInstanceOf(BusinessScoreNode);
      expect(n).toBeInstanceOf(RangedValueNode);
      expect(n).toBeInstanceOf(HistorizableValueNode);
      expect(n).toBeInstanceOf(ValueNode);
      expect(n).toBeInstanceOf(Node);
      expect(n.id).toBe("bsn-1");
      expect(n.title).toBe("Sales");
      expect(n.weight.value).toBe(1);
      expect(n.getDescription()).toBe("desc");
    });
  });

  describe("range slot — narrowed to LenientRange<T>", () => {
    it("exposes the constructor argument reference-equal AND as a LenientRange<T> at the leaf type", () => {
      const r = lenient();
      const n = node(r);
      expect(n.range).toBe(r);
      expect(n.range).toBeInstanceOf(LenientRange);
    });
  });

  describe("objective slot — composition per the v4 diagram", () => {
    it("exposes the constructor argument reference-equal with both fields readable", () => {
      const at = T("2027-06-30T00:00:00Z");
      const o = ObjectiveV4.of(95, at);
      const n = node(lenient(), o);
      expect(n.objective).toBe(o);
      expect(n.objective.value).toBe(95);
      expect(n.objective.at.equals(at)).toBe(true);
    });
  });

  describe("history surface — lenient acceptance through the inherited choke-point", () => {
    it("addValue silently accepts out-of-range writes and returns most-recent via getValue", () => {
      const n = node();
      n.addValue(T("2026-05-10T10:00:00Z"), 50);
      n.addValue(T("2026-05-10T12:00:00Z"), 999);
      n.addValue(T("2026-05-10T11:00:00Z"), -42);
      expect(n.entries()).toHaveLength(3);
      expect(n.getValue()).toBe(999);
    });

    it("setValue uses clock.now() for the timestamp AND silently accepts out-of-range (single lenient choke-point)", () => {
      const n = node(lenient(), goal(), "2026-05-10T15:30:00Z");
      n.setValue(1000);
      expect(n.getValue()).toBe(1000);
      expect(n.entries()[0].asOf.moment.toISOString()).toBe("2026-05-10T15:30:00.000Z");
    });
  });
});
