import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { HistorizableValueNode } from "../../../../domain/nodes/HistorizableValueNode.js";
import { Node } from "../../../../domain/nodes/Node.js";
import { RangedValueNode } from "../../../../domain/nodes/RangedValueNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { NumericComparator } from "../../../../domain/values/Comparator.js";
import {
  LenientRange,
  OutOfRangeError,
  type Range,
  StrictRange,
} from "../../../../domain/values/Range.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

class TestRangedValueNode<T> extends RangedValueNode<T> {
  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
    range: Range<T>,
  ) {
    super(id, title, weight, description, clock, range);
  }
}

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const fixedClock = (iso: string): Clock => ({ now: () => T(iso) });
const strict = StrictRange.of(0, 10, NumericComparator.INSTANCE);
const lenient = LenientRange.of(0, 10, NumericComparator.INSTANCE);
const node = (range: Range<number>, clockIso = "2026-05-10T12:00:00Z"): TestRangedValueNode<number> =>
  new TestRangedValueNode<number>("r", "R", Weight.of(1), "d", fixedClock(clockIso), range);

describe("RangedValueNode (§17.75 — v4 part 11: range-bounded history-aware abstract)", () => {
  describe("inheritance chain", () => {
    it("extends HistorizableValueNode → ValueNode → Node (full 4-layer prototype chain)", () => {
      const n = node(strict);
      expect(n).toBeInstanceOf(RangedValueNode);
      expect(n).toBeInstanceOf(HistorizableValueNode);
      expect(n).toBeInstanceOf(ValueNode);
      expect(n).toBeInstanceOf(Node);
    });

    it("exposes the `range` field as readonly public per the v4 diagram", () => {
      const n = node(strict);
      expect(n.range).toBe(strict);
    });
  });

  describe("addValue() — range.requireValue propagation", () => {
    it("StrictRange-bound: rejects out-of-range writes with OutOfRangeError + leaves history unchanged", () => {
      const n = node(strict);
      expect(() => n.addValue(T("2026-05-10T10:00:00Z"), 99)).toThrow(OutOfRangeError);
      expect(n.entries()).toHaveLength(0);
    });

    it("StrictRange-bound: accepts in-range writes and appends to history", () => {
      const n = node(strict);
      n.addValue(T("2026-05-10T10:00:00Z"), 5);
      expect(n.entries()).toHaveLength(1);
      expect(n.getValue()).toBe(5);
    });

    it("LenientRange-bound: silently accepts out-of-range writes (requireValue is a no-op)", () => {
      const n = node(lenient);
      n.addValue(T("2026-05-10T10:00:00Z"), 99);
      expect(n.entries()).toHaveLength(1);
      expect(n.getValue()).toBe(99);
    });
  });

  describe("setValue() — indirect range check via the overridden addValue", () => {
    it("StrictRange-bound: setValue propagates OutOfRangeError (single choke-point)", () => {
      const n = node(strict, "2026-05-10T15:30:00Z");
      expect(() => n.setValue(99)).toThrow(OutOfRangeError);
      expect(n.entries()).toHaveLength(0);
    });

    it("StrictRange-bound: setValue with in-range value succeeds and uses clock.now()", () => {
      const n = node(strict, "2026-05-10T15:30:00Z");
      n.setValue(7);
      expect(n.getValue()).toBe(7);
      expect(n.entries()[0].asOf.moment.toISOString()).toBe("2026-05-10T15:30:00.000Z");
    });

    it("LenientRange-bound: setValue with out-of-range value succeeds (silent acceptance)", () => {
      const n = node(lenient, "2026-05-10T15:30:00Z");
      n.setValue(-99);
      expect(n.getValue()).toBe(-99);
    });
  });

  describe("removeValue() + entries() — inherited intact", () => {
    it("removeValue removes by exact-ms match (no range check on remove)", () => {
      const n = node(strict);
      n.addValue(T("2026-05-10T10:00:00Z"), 5);
      n.addValue(T("2026-05-10T11:00:00Z"), 7);
      n.removeValue(T("2026-05-10T10:00:00Z"));
      expect(n.entries()).toHaveLength(1);
      expect(n.getValue()).toBe(7);
    });
  });
});
