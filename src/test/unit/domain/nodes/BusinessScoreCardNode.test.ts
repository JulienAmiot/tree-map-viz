import { describe, expect, it } from "vitest";

import type { ContributesToParent } from "../../../../domain/capabilities/ContributesToParent.js";
import type { HasObjective } from "../../../../domain/capabilities/HasObjective.js";
import type { Historizable } from "../../../../domain/capabilities/Historizable.js";
import { BusinessScoreCard } from "../../../../domain/nodes/BusinessScoreCard.js";
import {
  BusinessScoreCardNode,
  EmptyHistoryError,
} from "../../../../domain/nodes/BusinessScoreCardNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../domain/values/Title.js";
import { Unit } from "../../../../domain/values/Unit.js";
import { Weight } from "../../../../domain/values/Weight.js";

const identity = NodeIdentity.of(Title.of("Revenue"), Description.of("Q4 KPI"));
const weight = Weight.of(2);
const targetDate = new Date("2026-12-31T00:00:00Z");
const t1 = TimestampedValue.of(40, new Date("2024-01-15T00:00:00Z"));
const t2 = TimestampedValue.of(60, new Date("2025-06-30T00:00:00Z"));
const t3 = TimestampedValue.of(80, new Date("2026-04-26T00:00:00Z"));

interface NodeOptions {
  id?: string;
  computed?: boolean;
  eligibleForParentComputation?: boolean;
  history?: readonly TimestampedValue<number>[];
}

function makeNode(opts: NodeOptions = {}): BusinessScoreCardNode<number> {
  const card = BusinessScoreCard.of(
    Unit.percent(),
    Objective.of(0, 100, targetDate),
    opts.history ?? [t1, t2, t3],
  );
  return new BusinessScoreCardNode(
    opts.id ?? "n-1",
    identity,
    weight,
    card,
    opts.computed ?? false,
    opts.eligibleForParentComputation ?? true,
  );
}

describe("BusinessScoreCardNode", () => {
  describe("construction", () => {
    it("inherits id, identity, and weight from TreeNode", () => {
      const n = makeNode({ id: "abc" });
      expect(n.id).toBe("abc");
      expect(n.identity.equals(identity)).toBe(true);
      expect(n.weight.equals(weight)).toBe(true);
    });

    it("exposes the composed BusinessScoreCard", () => {
      const card = BusinessScoreCard.of(Unit.percent(), Objective.of(0, 100, targetDate), [t1]);
      const n = new BusinessScoreCardNode("x", identity, weight, card, false, true);
      expect(n.card).toBe(card);
    });

    it("exposes the computed flag", () => {
      expect(makeNode({ computed: true }).computed).toBe(true);
      expect(makeNode({ computed: false }).computed).toBe(false);
    });

    it("exposes the eligibleForParentComputation flag", () => {
      expect(makeNode({ eligibleForParentComputation: true }).eligibleForParentComputation).toBe(
        true,
      );
      expect(makeNode({ eligibleForParentComputation: false }).eligibleForParentComputation).toBe(
        false,
      );
    });
  });

  describe("Historizable<T> implementation", () => {
    it("history() delegates to the composed card", () => {
      const n = makeNode({ history: [t1, t2] });
      expect(n.history().map((tv) => tv.value)).toEqual([40, 60]);
    });

    it("returns an immutable copy that the caller cannot mutate", () => {
      const n = makeNode({ history: [t1] });
      const snapshot = n.history();
      expect(() => (snapshot as TimestampedValue<number>[]).push(t3)).toThrow();
    });
  });

  describe("HasObjective<T> implementation", () => {
    it("objective() returns the card's objective", () => {
      const n = makeNode();
      expect(n.objective().equals(Objective.of(0, 100, targetDate))).toBe(true);
    });
  });

  describe("ContributesToParent<T> implementation", () => {
    it("isEligible() returns the eligibleForParentComputation flag", () => {
      expect(makeNode({ eligibleForParentComputation: true }).isEligible()).toBe(true);
      expect(makeNode({ eligibleForParentComputation: false }).isEligible()).toBe(false);
    });

    it("contribution() returns the latest TimestampedValue from the card history", () => {
      const n = makeNode({ history: [t1, t2, t3] });
      const c = n.contribution();
      expect(c.value).toBe(80);
      expect(c.asOf.getTime()).toBe(t3.asOf.getTime());
    });

    it("contribution() throws EmptyHistoryError when the card has no history", () => {
      const n = makeNode({ history: [] });
      expect(() => n.contribution()).toThrow(EmptyHistoryError);
    });
  });

  describe("currentValue()", () => {
    it("returns the latest TimestampedValue from the card history", () => {
      const n = makeNode({ history: [t1, t2, t3] });
      const cv = n.currentValue();
      expect(cv.value).toBe(80);
      expect(cv.asOf.getTime()).toBe(t3.asOf.getTime());
    });

    it("throws EmptyHistoryError when the card has no history", () => {
      const n = makeNode({ history: [] });
      expect(() => n.currentValue()).toThrow(EmptyHistoryError);
    });

    it("the thrown EmptyHistoryError names the offending node id", () => {
      const n = makeNode({ id: "node-with-id", history: [] });
      try {
        n.currentValue();
      } catch (e) {
        expect(e).toBeInstanceOf(EmptyHistoryError);
        expect((e as Error).message).toContain("node-with-id");
      }
    });

    it("currentValue() and contribution() return the same value (per SPEC \u00a73)", () => {
      const n = makeNode({ history: [t1, t2] });
      const cv = n.currentValue();
      const c = n.contribution();
      expect(cv.value).toBe(c.value);
      expect(cv.asOf.getTime()).toBe(c.asOf.getTime());
    });
  });

  describe("compile-time capability conformance", () => {
    it("is structurally assignable to ContributesToParent<T>", () => {
      const n = makeNode();
      const c: ContributesToParent<number> = n;
      expect(c).toBe(n);
    });

    it("is structurally assignable to Historizable<T>", () => {
      const n = makeNode();
      const h: Historizable<number> = n;
      expect(h).toBe(n);
    });

    it("is structurally assignable to HasObjective<T>", () => {
      const n = makeNode();
      const o: HasObjective<number> = n;
      expect(o).toBe(n);
    });
  });
});
