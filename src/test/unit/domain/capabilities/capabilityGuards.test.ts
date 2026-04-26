import { describe, expect, it } from "vitest";

import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Objective } from "../../../../domain/values/Objective.js";

import {
  implementsContributesToParent,
  implementsHasObjective,
  implementsHistorizable,
} from "../../../../domain/capabilities/capabilityGuards.js";

const date = new Date("2026-01-01T00:00:00Z");

describe("capabilityGuards", () => {
  describe("non-object inputs", () => {
    const cases: ReadonlyArray<readonly [string, unknown]> = [
      ["null", null],
      ["undefined", undefined],
      ["a number", 42],
      ["a string", "x"],
      ["a boolean", true],
    ];

    for (const [label, value] of cases) {
      it(`rejects ${label} for all three guards`, () => {
        expect(implementsHistorizable(value)).toBe(false);
        expect(implementsHasObjective(value)).toBe(false);
        expect(implementsContributesToParent(value)).toBe(false);
      });
    }
  });

  describe("implementsHistorizable", () => {
    it("accepts an object with a history() method", () => {
      const stub = {
        history(): TimestampedValue<number>[] {
          return [TimestampedValue.of(1, date)];
        },
      };
      expect(implementsHistorizable(stub)).toBe(true);
    });

    it("rejects an object missing history()", () => {
      expect(implementsHistorizable({})).toBe(false);
    });

    it("rejects an object where history is not a function", () => {
      expect(implementsHistorizable({ history: "not-a-function" })).toBe(false);
    });
  });

  describe("implementsHasObjective", () => {
    it("accepts an object with an objective() method", () => {
      const stub = {
        objective(): Objective<number> {
          return Objective.of(0, 100, date);
        },
      };
      expect(implementsHasObjective(stub)).toBe(true);
    });

    it("rejects an object missing objective()", () => {
      expect(implementsHasObjective({})).toBe(false);
    });

    it("rejects an object where objective is not a function", () => {
      expect(implementsHasObjective({ objective: 123 })).toBe(false);
    });
  });

  describe("implementsContributesToParent", () => {
    it("accepts an object with isEligible() and contribution()", () => {
      const stub = {
        isEligible(): boolean {
          return true;
        },
        contribution(): TimestampedValue<number> {
          return TimestampedValue.of(1, date);
        },
      };
      expect(implementsContributesToParent(stub)).toBe(true);
    });

    it("rejects an object with only isEligible()", () => {
      const stub = {
        isEligible(): boolean {
          return true;
        },
      };
      expect(implementsContributesToParent(stub)).toBe(false);
    });

    it("rejects an object with only contribution()", () => {
      const stub = {
        contribution(): TimestampedValue<number> {
          return TimestampedValue.of(1, date);
        },
      };
      expect(implementsContributesToParent(stub)).toBe(false);
    });

    it("rejects an object where isEligible is not a function", () => {
      const stub = {
        isEligible: true,
        contribution(): TimestampedValue<number> {
          return TimestampedValue.of(1, date);
        },
      };
      expect(implementsContributesToParent(stub)).toBe(false);
    });
  });

  describe("guard behaviour for stubs that satisfy multiple capabilities", () => {
    it("a Historizable + HasObjective + ContributesToParent stub passes all three guards", () => {
      const stub = {
        history(): TimestampedValue<number>[] {
          return [];
        },
        objective(): Objective<number> {
          return Objective.of(0, 1, date);
        },
        isEligible(): boolean {
          return true;
        },
        contribution(): TimestampedValue<number> {
          return TimestampedValue.of(1, date);
        },
      };
      expect(implementsHistorizable(stub)).toBe(true);
      expect(implementsHasObjective(stub)).toBe(true);
      expect(implementsContributesToParent(stub)).toBe(true);
    });

    it("a TextNode-shape stub (no capabilities) is rejected by all three", () => {
      const stub = { id: "abc", title: "Hello" };
      expect(implementsHistorizable(stub)).toBe(false);
      expect(implementsHasObjective(stub)).toBe(false);
      expect(implementsContributesToParent(stub)).toBe(false);
    });
  });
});
