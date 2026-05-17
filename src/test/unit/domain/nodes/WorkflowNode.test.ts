import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import { HistorizableValueNode } from "../../../../domain/nodes/HistorizableValueNode.js";
import { Node } from "../../../../domain/nodes/Node.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { ValueNode } from "../../../../domain/nodes/ValueNode.js";
import { WorkflowNode } from "../../../../domain/nodes/WorkflowNode.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const T = (iso: string): Timestamp => Timestamp.of(new Date(iso));
const fixedClock = (iso: string): Clock => ({ now: () => T(iso) });
const make = (statusId = "plan"): WorkflowNode =>
  new WorkflowNode(
    "wf",
    "Title",
    Weight.of(1),
    fixedClock("2026-05-10T12:00:00Z"),
    statusId,
  );

describe("WorkflowNode (§17.117 — TextNode + board-level status reference)", () => {
  describe("inheritance chain", () => {
    it("IS-A TextNode (so it inherits the §17.15 description = value polymorphism and the historizable value contract)", () => {
      const n = make();
      expect(n).toBeInstanceOf(TextNode);
      expect(n).toBeInstanceOf(HistorizableValueNode);
      expect(n).toBeInstanceOf(ValueNode);
      expect(n).toBeInstanceOf(Node);
    });

    it("instanceof WorkflowNode is true on a WorkflowNode but NOT on a plain TextNode (so the persistence + view encoders can branch correctly when both kinds coexist)", () => {
      const wf = make();
      const tn = new TextNode(
        "tn",
        "Plain",
        Weight.of(1),
        fixedClock("2026-05-10T12:00:00Z"),
      );
      expect(wf).toBeInstanceOf(WorkflowNode);
      expect(tn instanceof WorkflowNode).toBe(false);
      // Plain TextNode is still a TextNode (sanity check that the
      // sibling-by-extension relation does not break the parent).
      expect(tn).toBeInstanceOf(TextNode);
    });
  });

  describe("statusId — board-table reference", () => {
    it("stores the statusId passed at construction time", () => {
      expect(make("do").statusId).toBe("do");
    });

    it("trims leading / trailing whitespace from the constructor argument", () => {
      const n = new WorkflowNode(
        "wf",
        "T",
        Weight.of(1),
        fixedClock("2026-05-10T12:00:00Z"),
        "  check  ",
      );
      expect(n.statusId).toBe("check");
    });

    it("rejects an empty / whitespace-only statusId at construction time", () => {
      expect(
        () =>
          new WorkflowNode(
            "wf",
            "T",
            Weight.of(1),
            fixedClock("2026-05-10T12:00:00Z"),
            "",
          ),
      ).toThrow();
      expect(
        () =>
          new WorkflowNode(
            "wf",
            "T",
            Weight.of(1),
            fixedClock("2026-05-10T12:00:00Z"),
            "   ",
          ),
      ).toThrow();
    });

    it("setStatusId updates the field in place (no history entry; status is independent of the value timeline)", () => {
      const n = make("plan");
      const entriesBefore = n.entries().length;
      n.setStatusId("do");
      expect(n.statusId).toBe("do");
      expect(n.entries()).toHaveLength(entriesBefore);
    });

    it("setStatusId rejects an empty value (same guard as the constructor)", () => {
      const n = make("plan");
      expect(() => n.setStatusId("")).toThrow();
    });
  });

  describe("inherited TextNode surface", () => {
    it("getDescription returns getValue (the §17.15 polymorphism still holds for WorkflowNode)", () => {
      const n = make();
      n.setValue("the body");
      expect(n.getDescription()).toBe("the body");
      expect(n.getDescription()).toBe(n.getValue());
    });

    it("supports the full add / append / remove history surface from HistorizableValueNode", () => {
      const n = make();
      n.setValue("a");
      n.addValue(T("2026-05-10T13:00:00Z"), "b");
      expect(n.entries()).toHaveLength(2);
      n.removeValue(T("2026-05-10T13:00:00Z"));
      expect(n.entries()).toHaveLength(1);
      expect(n.getValue()).toBe("a");
    });
  });
});
