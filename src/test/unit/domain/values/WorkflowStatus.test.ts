import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKFLOW_STATUSES,
  DEFAULT_WORKFLOW_STATUS_ID,
  InvalidWorkflowStatusError,
  WorkflowStatus,
} from "../../../../domain/values/WorkflowStatus.js";

describe("WorkflowStatus (§17.117 — value object backing the board-level status table)", () => {
  describe("WorkflowStatus.of — construction + validation", () => {
    it("accepts a valid (id, label, color) triple and preserves all three fields verbatim", () => {
      const s = WorkflowStatus.of("plan", "PLAN", "rgb(161, 161, 170)");
      expect(s.id).toBe("plan");
      expect(s.label).toBe("PLAN");
      expect(s.color).toBe("rgb(161, 161, 170)");
    });

    it("trims label and color whitespace but leaves id unchanged (id is a strict slug)", () => {
      const s = WorkflowStatus.of("do", "  DO  ", "  #2563eb  ");
      expect(s.id).toBe("do");
      expect(s.label).toBe("DO");
      expect(s.color).toBe("#2563eb");
    });

    it.each<[string, string]>([
      ["", "empty id"],
      ["Plan", "uppercase letter"],
      ["plan!", "punctuation"],
      ["-leading", "leading dash"],
      ["with space", "whitespace"],
    ])("rejects id %j (%s)", (id) => {
      expect(() => WorkflowStatus.of(id, "Label", "#000")).toThrow(
        InvalidWorkflowStatusError,
      );
    });

    it.each<[string]>([[""], ["   "]])(
      "rejects empty / whitespace-only label %j",
      (label) => {
        expect(() => WorkflowStatus.of("plan", label, "#000")).toThrow(
          InvalidWorkflowStatusError,
        );
      },
    );

    it.each<[string]>([[""], ["   "]])(
      "rejects empty / whitespace-only color %j",
      (color) => {
        expect(() => WorkflowStatus.of("plan", "PLAN", color)).toThrow(
          InvalidWorkflowStatusError,
        );
      },
    );

    it("rejects non-string id at runtime (the type system would catch this; the runtime guard backstops adapter payloads)", () => {
      expect(() =>
        WorkflowStatus.of(123 as unknown as string, "PLAN", "#000"),
      ).toThrow(InvalidWorkflowStatusError);
    });
  });

  describe("equals — value-object identity", () => {
    it("returns true for two instances built with the same fields", () => {
      const a = WorkflowStatus.of("do", "DO", "#2563eb");
      const b = WorkflowStatus.of("do", "DO", "#2563eb");
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when any field differs", () => {
      const base = WorkflowStatus.of("do", "DO", "#2563eb");
      expect(base.equals(WorkflowStatus.of("done", "DO", "#2563eb"))).toBe(
        false,
      );
      expect(base.equals(WorkflowStatus.of("do", "Done", "#2563eb"))).toBe(
        false,
      );
      expect(base.equals(WorkflowStatus.of("do", "DO", "#2563ec"))).toBe(false);
    });
  });

  describe("DEFAULT_WORKFLOW_STATUSES — PDCA seed table", () => {
    it("seeds the four PDCA statuses in canonical order with the §17.117 default colours", () => {
      const ids = DEFAULT_WORKFLOW_STATUSES.map((s) => s.id);
      expect(ids).toEqual(["plan", "do", "check", "act"]);
      const labels = DEFAULT_WORKFLOW_STATUSES.map((s) => s.label);
      expect(labels).toEqual(["PLAN", "DO", "CHECK", "ACT"]);
    });

    it("is a frozen array so callers cannot mutate the shared seed", () => {
      expect(Object.isFrozen(DEFAULT_WORKFLOW_STATUSES)).toBe(true);
    });

    it("DEFAULT_WORKFLOW_STATUS_ID resolves to one of the seeded ids", () => {
      const ids = DEFAULT_WORKFLOW_STATUSES.map((s) => s.id);
      expect(ids).toContain(DEFAULT_WORKFLOW_STATUS_ID);
    });
  });
});
