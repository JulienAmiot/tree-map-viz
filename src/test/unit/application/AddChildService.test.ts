import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddChildService } from "../../../application/AddChildService.js";
import type {
  AddChildPayload,
} from "../../../application/AddChildService.js";
import type { IdGenerator } from "../../../application/ports/IdGenerator.js";
import { MAX_CHILDREN } from "../../../domain/capacity/childrenCapacity.js";
import { BusinessScoreCardNode } from "../../../domain/nodes/BusinessScoreCardNode.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { Description } from "../../../domain/values/Description.js";
import { NodeIdentity } from "../../../domain/values/NodeIdentity.js";
import { Title } from "../../../domain/values/Title.js";
import { Weight } from "../../../domain/values/Weight.js";

// ----- helpers --------------------------------------------------------------

function makeRoot(idStr = "root"): TextNode {
  return new TextNode(idStr, NodeIdentity.of(Title.of("Root"), Description.of("")), Weight.of(1));
}

function fillToCap(parent: TextNode): void {
  const identity = NodeIdentity.of(Title.of("X"), Description.of(""));
  for (let i = 0; i < MAX_CHILDREN; i++) {
    parent.attach(new TextNode(`existing-${i}`, identity, Weight.of(1)));
  }
}

function sequentialIdGen(prefix = "new"): IdGenerator {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

const validBscPayload: AddChildPayload = {
  kind: "BusinessScoreCardNode",
  title: "Revenue",
  description: "Monthly revenue",
  weight: 2,
  unit: "USD",
  objective: {
    initialValue: 0,
    targetValue: 10_000,
    targetDate: new Date("2026-12-31T00:00:00Z"),
  },
  computed: false,
  eligibleForParentComputation: true,
  initialHistory: [
    { value: 1_500, asOf: new Date("2026-04-01T00:00:00Z") },
    { value: 3_000, asOf: new Date("2026-04-15T00:00:00Z") },
  ],
};

// ----- tests ----------------------------------------------------------------

describe("AddChildService", () => {
  let persist: ReturnType<typeof vi.fn>;
  let idGen: IdGenerator;
  let svc: AddChildService;

  beforeEach(() => {
    persist = vi.fn().mockResolvedValue(undefined);
    idGen = sequentialIdGen("uuid");
    svc = new AddChildService(idGen, persist);
  });

  describe("happy path — TextNode", () => {
    it("appends a TextNode child built from payload, persists, returns ok", async () => {
      const parent = makeRoot();

      const r = await svc.addChild(parent, {
        kind: "TextNode",
        title: "Notes",
        description: "Section header",
        weight: 1,
      });

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.child).toBeInstanceOf(TextNode);
        expect(r.child.id).toBe("uuid-1");
        expect(r.child.identity.title.value).toBe("Notes");
        expect(r.child.identity.description.value).toBe("Section header");
        expect(r.child.weight.value).toBe(1);
        expect(r.child.parent).toBe(parent);
      }
      expect(parent.children).toHaveLength(1);
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("uses default weight (1) and empty description when fields are omitted", async () => {
      const parent = makeRoot();

      const r = await svc.addChild(parent, { kind: "TextNode", title: "Quick" });

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.child.weight.value).toBe(1);
        expect(r.child.identity.description.value).toBe("");
      }
    });
  });

  describe("happy path — BusinessScoreCardNode", () => {
    it("appends a BusinessScoreCardNode with objective + sorted history, persists, returns ok", async () => {
      const parent = makeRoot();

      const r = await svc.addChild(parent, validBscPayload);

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.child).toBeInstanceOf(BusinessScoreCardNode);
        const child = r.child as BusinessScoreCardNode<number>;

        expect(child.id).toBe("uuid-1");
        expect(child.identity.title.value).toBe("Revenue");
        expect(child.weight.value).toBe(2);
        expect(child.computed).toBe(false);
        expect(child.eligibleForParentComputation).toBe(true);

        const obj = child.objective();
        expect(obj.initialValue).toBe(0);
        expect(obj.targetValue).toBe(10_000);
        expect(obj.targetDate.toISOString()).toBe("2026-12-31T00:00:00.000Z");

        const history = child.history();
        expect(history).toHaveLength(2);
        expect(history.map((tv) => tv.value)).toEqual([1_500, 3_000]);
        expect(child.card.unit.value).toBe("USD");
      }
      expect(parent.children).toHaveLength(1);
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("works with empty initialHistory (no recorded values yet)", async () => {
      const parent = makeRoot();

      const r = await svc.addChild(parent, {
        kind: "BusinessScoreCardNode",
        title: "Fresh KPI",
        description: "",
        unit: "%",
        objective: {
          initialValue: 0,
          targetValue: 100,
          targetDate: new Date("2027-01-01T00:00:00Z"),
        },
      });

      expect(r.ok).toBe(true);
      if (r.ok) {
        const child = r.child as BusinessScoreCardNode<number>;
        expect(child.history()).toHaveLength(0);
        expect(child.computed).toBe(false);
        expect(child.eligibleForParentComputation).toBe(true);
      }
    });
  });

  describe("capacity (MAX_CHILDREN)", () => {
    it("rejects when the parent is at the cap, never persists, never mutates the tree", async () => {
      const parent = makeRoot();
      fillToCap(parent);
      expect(parent.children).toHaveLength(MAX_CHILDREN);

      const r = await svc.addChild(parent, { kind: "TextNode", title: "Overflow" });

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/cap|MAX_CHILDREN|maximum/i);
      }
      expect(parent.children).toHaveLength(MAX_CHILDREN);
      expect(persist).not.toHaveBeenCalled();
    });
  });

  describe("payload validation", () => {
    it("rejects an empty title without persisting and without mutating the tree", async () => {
      const parent = makeRoot();

      const r = await svc.addChild(parent, { kind: "TextNode", title: "" });

      expect(r.ok).toBe(false);
      expect(parent.children).toHaveLength(0);
      expect(persist).not.toHaveBeenCalled();
    });

    it("rejects a non-positive weight without persisting", async () => {
      const parent = makeRoot();

      const r = await svc.addChild(parent, {
        kind: "TextNode",
        title: "Bad weight",
        weight: 0,
      });

      expect(r.ok).toBe(false);
      expect(parent.children).toHaveLength(0);
      expect(persist).not.toHaveBeenCalled();
    });

    it("rejects an unknown kind defensively", async () => {
      const parent = makeRoot();

      const r = await svc.addChild(parent, {
        // @ts-expect-error: deliberately invalid runtime payload to test defensive guard
        kind: "Mystery",
        title: "X",
      });

      expect(r.ok).toBe(false);
      expect(persist).not.toHaveBeenCalled();
    });

    it("rejects a BusinessScoreCardNode payload with missing unit string", async () => {
      const parent = makeRoot();

      const r = await svc.addChild(parent, {
        kind: "BusinessScoreCardNode",
        title: "Bad",
        unit: "",
        objective: {
          initialValue: 0,
          targetValue: 1,
          targetDate: new Date("2027-01-01T00:00:00Z"),
        },
      });

      expect(r.ok).toBe(false);
      expect(parent.children).toHaveLength(0);
      expect(persist).not.toHaveBeenCalled();
    });
  });

  describe("persistence boundary", () => {
    it("rolls back the attach if persist throws (atomicity)", async () => {
      const parent = makeRoot();
      const failingPersist = vi.fn().mockRejectedValue(new Error("Storage full"));
      const failingSvc = new AddChildService(idGen, failingPersist);

      const r = await failingSvc.addChild(parent, { kind: "TextNode", title: "Doomed" });

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/storage full|persist/i);
      }
      expect(parent.children).toHaveLength(0);
      expect(failingPersist).toHaveBeenCalledTimes(1);
    });

    it("uses the injected id generator for the child id", async () => {
      const parent = makeRoot();
      const taggingGen: IdGenerator = () => "explicit-id-xyz";
      const taggingSvc = new AddChildService(taggingGen, persist);

      const r = await taggingSvc.addChild(parent, { kind: "TextNode", title: "T" });

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.child.id).toBe("explicit-id-xyz");
      }
    });
  });
});
