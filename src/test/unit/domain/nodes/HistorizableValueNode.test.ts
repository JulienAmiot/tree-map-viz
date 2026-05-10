import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { EmptyHistoryError } from "../../../../domain/nodes/EmptyHistoryError.js";
import {
  HistorizableValueNode,
  TimestampNotFoundError,
} from "../../../../domain/nodes/HistorizableValueNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

class TestHistorizableValueNode<T> extends HistorizableValueNode<T> {
  constructor(
    id: string,
    title: string,
    weight: Weight,
    description: string,
    clock: Clock,
  ) {
    super(id, title, weight, description, clock);
  }
}

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const fixedClock = (iso: string): Clock => ({ now: () => T(iso) });
const node = <V>(clockIso: string, description = "d"): TestHistorizableValueNode<V> =>
  new TestHistorizableValueNode<V>(
    "n",
    "N",
    Weight.of(1),
    description,
    fixedClock(clockIso),
  );

describe("HistorizableValueNode (§17.73 — v4 part 9: history-aware abstract)", () => {
  describe("inheritance + construction", () => {
    it("extends ValueNode (and therefore Node) — instanceof + inherited fields", () => {
      const n = node<number>("2026-05-10T12:00:00Z");
      expect(n).toBeInstanceOf(ValueNode);
      expect(n.id).toBe("n");
      expect(n.title).toBe("N");
      expect(n.getDescription()).toBe("d");
    });

    it("starts with an empty history (entries returns a frozen empty array)", () => {
      const n = node<number>("2026-05-10T12:00:00Z");
      const snap = n.entries();
      expect(snap).toHaveLength(0);
      expect(Object.isFrozen(snap)).toBe(true);
    });
  });

  describe("getValue() + EmptyHistoryError", () => {
    it("throws EmptyHistoryError before any value is recorded", () => {
      const n = node<number>("2026-05-10T12:00:00Z");
      expect(() => n.getValue()).toThrow(EmptyHistoryError);
    });

    it("returns the most-recent (last-by-timestamp) value once history is populated", () => {
      const n = node<number>("2026-05-10T12:00:00Z");
      n.addValue(T("2026-05-10T10:00:00Z"), 10);
      n.addValue(T("2026-05-10T11:00:00Z"), 11);
      n.addValue(T("2026-05-10T09:00:00Z"), 9);
      expect(n.getValue()).toBe(11);
    });
  });

  describe("setValue() — clock-stamped append", () => {
    it("stamps the entry with clock.now() and pushes it to history", () => {
      const n = node<string>("2026-05-10T15:30:00Z");
      n.setValue("hello");
      const entries = n.entries();
      expect(entries).toHaveLength(1);
      expect(entries[0].value).toBe("hello");
      expect(entries[0].asOf.moment.toISOString()).toBe("2026-05-10T15:30:00.000Z");
    });
  });

  describe("addValue() — explicit timestamp + sorted-history invariant", () => {
    it("inserts entries in ascending-timestamp order regardless of insertion order", () => {
      const n = node<number>("2026-05-10T12:00:00Z");
      n.addValue(T("2026-05-10T11:00:00Z"), 11);
      n.addValue(T("2026-05-10T09:00:00Z"), 9);
      n.addValue(T("2026-05-10T10:00:00Z"), 10);
      const moments = n.entries().map((e) => e.asOf.moment.toISOString());
      expect(moments).toEqual([
        "2026-05-10T09:00:00.000Z",
        "2026-05-10T10:00:00.000Z",
        "2026-05-10T11:00:00.000Z",
      ]);
    });

    it("places same-timestamp inserts AFTER the existing entry (stable, last-write-wins for getValue)", () => {
      const n = node<number>("2026-05-10T12:00:00Z");
      n.addValue(T("2026-05-10T10:00:00Z"), 1);
      n.addValue(T("2026-05-10T10:00:00Z"), 2);
      expect(n.getValue()).toBe(2);
      expect(n.entries()).toHaveLength(2);
    });
  });

  describe("removeValue() + TimestampNotFoundError", () => {
    it("removes the entry whose timestamp matches exactly (ms-precise)", () => {
      const n = node<number>("2026-05-10T12:00:00Z");
      n.addValue(T("2026-05-10T10:00:00Z"), 10);
      n.addValue(T("2026-05-10T11:00:00Z"), 11);
      n.removeValue(T("2026-05-10T10:00:00Z"));
      expect(n.entries()).toHaveLength(1);
      expect(n.getValue()).toBe(11);
    });

    it("throws TimestampNotFoundError when no entry matches the requested timestamp", () => {
      const n = node<number>("2026-05-10T12:00:00Z");
      n.addValue(T("2026-05-10T10:00:00Z"), 10);
      expect(() => n.removeValue(T("2026-05-10T11:00:00Z"))).toThrow(TimestampNotFoundError);
    });
  });

  describe("entries() — defensive copy", () => {
    it("returns a frozen snapshot that cannot mutate the internal history", () => {
      const n = node<number>("2026-05-10T12:00:00Z");
      n.addValue(T("2026-05-10T10:00:00Z"), 10);
      const snap = n.entries();
      expect(Object.isFrozen(snap)).toBe(true);
      expect(() => (snap as unknown as unknown[]).push(undefined)).toThrow();
      expect(n.entries()).toHaveLength(1);
    });
  });
});
