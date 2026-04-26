import { describe, expect, it } from "vitest";

import type { Historizable } from "../../../../domain/capabilities/Historizable.js";
import { BusinessScoreCard } from "../../../../domain/nodes/BusinessScoreCard.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Unit } from "../../../../domain/values/Unit.js";

describe("BusinessScoreCard", () => {
  const unit = Unit.percent();
  const objective = Objective.of(0, 100, new Date("2026-12-31T00:00:00Z"));
  const t2024 = TimestampedValue.of(10, new Date("2024-01-15T00:00:00Z"));
  const t2025 = TimestampedValue.of(20, new Date("2025-06-30T00:00:00Z"));
  const t2026 = TimestampedValue.of(30, new Date("2026-04-26T00:00:00Z"));

  describe("construction", () => {
    it("exposes the unit and objective", () => {
      const card = BusinessScoreCard.of(unit, objective);
      expect(card.unit.equals(unit)).toBe(true);
      expect(card.objective.equals(objective)).toBe(true);
    });

    it("starts with an empty history when no initial values are given", () => {
      const card = BusinessScoreCard.of(unit, objective);
      expect(card.history()).toEqual([]);
    });

    it("accepts an initial history", () => {
      const card = BusinessScoreCard.of(unit, objective, [t2024, t2025]);
      expect(card.history().map((tv) => tv.value)).toEqual([10, 20]);
    });

    it("sorts the initial history chronologically", () => {
      const card = BusinessScoreCard.of(unit, objective, [t2026, t2024, t2025]);
      expect(card.history().map((tv) => tv.value)).toEqual([10, 20, 30]);
    });

    it("defends against the caller mutating the input history array", () => {
      const seed = [t2024, t2025];
      const card = BusinessScoreCard.of(unit, objective, seed);
      seed.length = 0;
      expect(card.history()).toHaveLength(2);
    });
  });

  describe("history()", () => {
    it("returns a defensive copy the caller cannot use to mutate state", () => {
      const card = BusinessScoreCard.of(unit, objective, [t2024]);
      const snapshot = card.history();
      expect(() => (snapshot as TimestampedValue<number>[]).push(t2025)).toThrow();
      expect(card.history()).toHaveLength(1);
    });

    it("returns a fresh array on each call", () => {
      const card = BusinessScoreCard.of(unit, objective, [t2024]);
      expect(card.history()).not.toBe(card.history());
    });
  });

  describe("addRecorded()", () => {
    it("inserts into an empty history", () => {
      const card = BusinessScoreCard.of(unit, objective);
      card.addRecorded(t2025);
      expect(card.history().map((tv) => tv.value)).toEqual([20]);
    });

    it("appends a later entry while keeping the list sorted", () => {
      const card = BusinessScoreCard.of(unit, objective, [t2024]);
      card.addRecorded(t2026);
      expect(card.history().map((tv) => tv.value)).toEqual([10, 30]);
    });

    it("prepends an earlier entry while keeping the list sorted", () => {
      const card = BusinessScoreCard.of(unit, objective, [t2025]);
      card.addRecorded(t2024);
      expect(card.history().map((tv) => tv.value)).toEqual([10, 20]);
    });

    it("inserts a middle entry while keeping the list sorted", () => {
      const card = BusinessScoreCard.of(unit, objective, [t2024, t2026]);
      card.addRecorded(t2025);
      expect(card.history().map((tv) => tv.value)).toEqual([10, 20, 30]);
    });

    it("preserves both entries when two share the same asOf (stable insert)", () => {
      const sameDay = new Date("2025-06-30T00:00:00Z");
      const a = TimestampedValue.of("a", sameDay);
      const b = TimestampedValue.of("b", sameDay);
      const stringObjective = Objective.of<string>("low", "high", new Date("2026-12-31T00:00:00Z"));
      const card = BusinessScoreCard.of<string>(unit, stringObjective, [a]);
      card.addRecorded(b);
      expect(card.history().map((tv) => tv.value)).toEqual(["a", "b"]);
    });
  });

  describe("Historizable<T> conformance", () => {
    it("is assignable to Historizable<T> at compile time", () => {
      const card: Historizable<number> = BusinessScoreCard.of(unit, objective, [t2024]);
      expect(card.history()).toHaveLength(1);
    });
  });
});
