import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { HistorizableValueNode } from "../../../../domain/nodes/HistorizableValueNode.js";
import { Node } from "../../../../domain/nodes/Node.js";
import { RangedValueNode } from "../../../../domain/nodes/RangedValueNode.js";
import { StrictRangeNode } from "../../../../domain/nodes/StrictRangeNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import { OutOfRangeError, StrictRange } from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const clk = (iso: string): Clock => ({ now: () => T(iso) });
const strict = (): StrictRange<number> => StrictRange.of(0, 100, NumericComparator.INSTANCE);

const node = (
  range: StrictRange<number> = strict(),
  clockIso = "2026-05-10T12:00:00Z",
): StrictRangeNode<number> =>
  new StrictRangeNode<number>("srn-1", "Latency p99", Weight.of(1), "ms", clk(clockIso), range);

describe("StrictRangeNode (§17.77 — v4 part 13: concrete strict range-bounded node, taxonomy completion)", () => {
  describe("inheritance chain (5-layer concrete leaf)", () => {
    it("extends RangedValueNode → HistorizableValueNode → ValueNode → Node and inherits identity + description", () => {
      const n = node();
      expect(n).toBeInstanceOf(StrictRangeNode);
      expect(n).toBeInstanceOf(RangedValueNode);
      expect(n).toBeInstanceOf(HistorizableValueNode);
      expect(n).toBeInstanceOf(ValueNode);
      expect(n).toBeInstanceOf(Node);
      expect(n.id).toBe("srn-1");
      expect(n.title).toBe("Latency p99");
      expect(n.weight.value).toBe(1);
      expect(n.getDescription()).toBe("ms");
    });
  });

  describe("range slot — narrowed to StrictRange<T>", () => {
    it("exposes the constructor argument reference-equal AND as a StrictRange<T> at the leaf type", () => {
      const r = strict();
      const n = node(r);
      expect(n.range).toBe(r);
      expect(n.range).toBeInstanceOf(StrictRange);
    });
  });

  describe("history surface — strict propagation through the inherited choke-point", () => {
    it("addValue rejects out-of-range writes with OutOfRangeError AND leaves history unchanged", () => {
      const n = node();
      expect(() => n.addValue(T("2026-05-10T10:00:00Z"), 999)).toThrow(OutOfRangeError);
      expect(n.entries()).toHaveLength(0);
    });

    it("addValue accepts in-range writes (incl. endpoints) and getValue returns most-recent", () => {
      const n = node();
      n.addValue(T("2026-05-10T10:00:00Z"), 0);
      n.addValue(T("2026-05-10T11:00:00Z"), 50);
      n.addValue(T("2026-05-10T12:00:00Z"), 100);
      expect(n.entries()).toHaveLength(3);
      expect(n.getValue()).toBe(100);
    });

    it("setValue propagates OutOfRangeError through the same choke-point AND uses clock.now() on success", () => {
      const n = node(strict(), "2026-05-10T15:30:00Z");
      expect(() => n.setValue(-1)).toThrow(OutOfRangeError);
      expect(n.entries()).toHaveLength(0);
      n.setValue(42);
      expect(n.getValue()).toBe(42);
      expect(n.entries()[0].asOf.moment.toISOString()).toBe("2026-05-10T15:30:00.000Z");
    });
  });
});
