import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { EmptyHistoryError } from "../../../../domain/nodes/EmptyHistoryError.js";
import { HistorizableValueNode } from "../../../../domain/nodes/HistorizableValueNode.js";
import { Node } from "../../../../domain/nodes/Node.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const fixedClock = (iso: string): Clock => ({ now: () => T(iso) });
const make = (clockIso = "2026-05-10T12:00:00Z"): TextNode =>
  new TextNode("t", "Title", Weight.of(1), fixedClock(clockIso));

describe("TextNode (§17.74 — v4 part 10: first concrete subclass of HistorizableValueNode<string>)", () => {
  describe("inheritance chain", () => {
    it("extends HistorizableValueNode → ValueNode → Node", () => {
      const n = make();
      expect(n).toBeInstanceOf(HistorizableValueNode);
      expect(n).toBeInstanceOf(ValueNode);
      expect(n).toBeInstanceOf(Node);
    });
  });

  describe("getValue() — inherited tail-read of history", () => {
    it("throws EmptyHistoryError before any value is recorded", () => {
      const n = make();
      expect(() => n.getValue()).toThrow(EmptyHistoryError);
    });

    it("returns the most-recent text value once history is populated", () => {
      const n = make("2026-05-10T12:00:00Z");
      n.setValue("first");
      const later = new TextNode("u", "U", Weight.of(1), fixedClock("2026-05-10T13:00:00Z"));
      // Cross-clock check: stamp a second TextNode with a later clock to confirm
      // tail-read picks the latest entry across heterogeneous insertion times.
      n.addValue(T("2026-05-10T11:00:00Z"), "earlier");
      n.addValue(T("2026-05-10T13:00:00Z"), "latest");
      expect(n.getValue()).toBe("latest");
      expect(later.entries()).toHaveLength(0);
    });
  });

  describe("getDescription() — §17.15 polymorphic override (description IS the value)", () => {
    it("throws EmptyHistoryError before any value is recorded (same as getValue)", () => {
      const n = make();
      expect(() => n.getDescription()).toThrow(EmptyHistoryError);
    });

    it("returns getValue() once history is populated, regardless of the inherited description slot", () => {
      const n = make("2026-05-10T12:00:00Z");
      n.setValue("the body");
      expect(n.getDescription()).toBe("the body");
      expect(n.getDescription()).toBe(n.getValue());
    });

    it("ignores the inherited _description slot even when setDescription is called", () => {
      const n = make("2026-05-10T12:00:00Z");
      n.setValue("the body");
      n.setDescription("ignored");
      expect(n.getDescription()).toBe("the body");
    });
  });

  describe("constructor — description hard-wired to empty string per §17.15", () => {
    it("does not expose a description constructor parameter (empty by convention)", () => {
      const n = make();
      n.setValue("hello");
      expect(n.getDescription()).toBe("hello");
    });
  });

  describe("history surface inherited from HistorizableValueNode<string>", () => {
    it("supports setValue / addValue / removeValue / entries via the parent's impl", () => {
      const n = make("2026-05-10T12:00:00Z");
      n.setValue("a");
      n.addValue(T("2026-05-10T13:00:00Z"), "b");
      expect(n.entries()).toHaveLength(2);
      n.removeValue(T("2026-05-10T13:00:00Z"));
      expect(n.entries()).toHaveLength(1);
      expect(n.getValue()).toBe("a");
    });
  });
});
