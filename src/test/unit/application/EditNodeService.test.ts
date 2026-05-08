import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditNodeService } from "../../../application/EditNodeService.js";
import type { Clock } from "../../../application/ports/Clock.js";
import { BusinessScoreCard } from "../../../domain/nodes/BusinessScoreCard.js";
import { BusinessScoreCardNode } from "../../../domain/nodes/BusinessScoreCardNode.js";
import { TextCard } from "../../../domain/nodes/TextCard.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { Description } from "../../../domain/values/Description.js";
import { NodeIdentity } from "../../../domain/values/NodeIdentity.js";
import { Objective } from "../../../domain/values/Objective.js";
import { TimestampedValue } from "../../../domain/values/TimestampedValue.js";
import { Title } from "../../../domain/values/Title.js";
import { Unit } from "../../../domain/values/Unit.js";
import { Weight } from "../../../domain/values/Weight.js";

// ----- helpers --------------------------------------------------------------

function makeText(): TextNode {
  return new TextNode(
    "text-1",
    NodeIdentity.of(Title.of("Notes"), Description.of("")),
    Weight.of(1),
    TextCard.of([
      TimestampedValue.of("seed", new Date("2026-01-01T00:00:00Z")),
    ]),
  );
}

function makeBsc(): BusinessScoreCardNode<number> {
  return new BusinessScoreCardNode<number>(
    "bsc-1",
    NodeIdentity.of(Title.of("Revenue"), Description.of("EU")),
    Weight.of(2),
    BusinessScoreCard.of(
      Unit.of("M\u20ac"),
      Objective.of(0, 100, new Date("2026-12-31T00:00:00Z")),
      [TimestampedValue.of(42, new Date("2026-01-01T00:00:00Z"))],
    ),
    /* computed */ false,
    /* eligible */ true,
  );
}

// ----- tests ----------------------------------------------------------------

// SPEC \u00a717.57 \u2014 deterministic clock for the appendValue default-asOf
// path. Tests that pass an explicit `asOf` ignore this stub; tests that
// rely on the default get a frozen instant they can assert against.
const FAKE_NOW = new Date("2026-05-08T21:00:00.000Z");
const fakeClock: Clock = { now: () => FAKE_NOW };

describe("EditNodeService (\u00a717.28)", () => {
  let persist: ReturnType<typeof vi.fn>;
  let svc: EditNodeService;

  beforeEach(() => {
    persist = vi.fn().mockResolvedValue(undefined);
    svc = new EditNodeService(fakeClock, persist);
  });

  describe("editFields — partial updates", () => {
    it("updates only the title when only `title` is provided (TextNode)", async () => {
      const node = makeText();
      const r = await svc.editFields(node, {
        kind: "TextNode",
        title: "Renamed",
      });
      expect(r.ok).toBe(true);
      expect(node.identity.title.value).toBe("Renamed");
      expect(node.weight.value).toBe(1);
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("updates only the weight when only `weight` is provided", async () => {
      const node = makeText();
      const r = await svc.editFields(node, {
        kind: "TextNode",
        weight: 7,
      });
      expect(r.ok).toBe(true);
      expect(node.weight.value).toBe(7);
      expect(node.identity.title.value).toBe("Notes");
    });

    it("updates BSC title + description + unit + objective + computed flags in one call", async () => {
      const node = makeBsc();
      const newDate = new Date("2027-12-31T00:00:00Z");
      const r = await svc.editFields(node, {
        kind: "BusinessScoreCardNode",
        title: "Renamed",
        description: "New scope",
        unit: "%",
        objective: { initialValue: 10, targetValue: 200, targetDate: newDate },
        computed: true,
        eligibleForParentComputation: false,
      });
      expect(r.ok).toBe(true);
      expect(node.identity.title.value).toBe("Renamed");
      expect(node.identity.description.value).toBe("New scope");
      expect(node.card.unit.value).toBe("%");
      expect(node.card.objective.initialValue).toBe(10);
      expect(node.card.objective.targetValue).toBe(200);
      expect(node.card.objective.targetDate.getTime()).toBe(newDate.getTime());
      expect(node.computed).toBe(true);
      expect(node.eligibleForParentComputation).toBe(false);
    });

    it("preserves history when fields are edited", async () => {
      const node = makeBsc();
      const before = node.card.history().length;
      await svc.editFields(node, {
        kind: "BusinessScoreCardNode",
        title: "Renamed",
      });
      expect(node.card.history()).toHaveLength(before);
    });
  });

  describe("editFields — validation + rollback", () => {
    it("rejects when the payload kind does not match the node kind", async () => {
      const node = makeText();
      const r = await svc.editFields(node, {
        kind: "BusinessScoreCardNode",
        title: "X",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/does not match/);
      }
      expect(persist).not.toHaveBeenCalled();
    });

    it("rejects when Title.of throws (empty title) and does not mutate the node", async () => {
      const node = makeText();
      const before = node.identity.title.value;
      const r = await svc.editFields(node, {
        kind: "TextNode",
        title: "",
      });
      expect(r.ok).toBe(false);
      expect(node.identity.title.value).toBe(before);
      expect(persist).not.toHaveBeenCalled();
    });

    it("rejects when Weight.of rejects (\u22640) and rolls back any preceding field edits", async () => {
      const node = makeText();
      const r = await svc.editFields(node, {
        kind: "TextNode",
        title: "After",
        weight: 0,
      });
      // Weight.of(0) throws \u2192 the weight setter wasn't reached; the title
      // setter ran first, so the rollback must restore the title.
      expect(r.ok).toBe(false);
      expect(node.identity.title.value).toBe("Notes");
      expect(node.weight.value).toBe(1);
      expect(persist).not.toHaveBeenCalled();
    });

    it("rolls back every field edit when persist() rejects", async () => {
      persist.mockRejectedValueOnce(new Error("disk full"));
      const node = makeBsc();
      const beforeTitle = node.identity.title.value;
      const beforeUnit = node.card.unit.value;
      const beforeComputed = node.computed;
      const r = await svc.editFields(node, {
        kind: "BusinessScoreCardNode",
        title: "Renamed",
        unit: "%",
        computed: true,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe("disk full");
      }
      expect(node.identity.title.value).toBe(beforeTitle);
      expect(node.card.unit.value).toBe(beforeUnit);
      expect(node.computed).toBe(beforeComputed);
    });
  });

  describe("appendValue", () => {
    it("appends a TimestampedValue<string> to a TextNode and persists", async () => {
      const node = makeText();
      const before = node.card.history().length;
      const asOf = new Date("2026-05-01T00:00:00Z");
      const r = await svc.appendValue(node, "fresh note", asOf);
      expect(r.ok).toBe(true);
      expect(node.card.history()).toHaveLength(before + 1);
      const latest = node.card.history().at(-1)!;
      expect(latest.value).toBe("fresh note");
      expect(latest.asOf.getTime()).toBe(asOf.getTime());
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("appends a TimestampedValue<number> to a BSC", async () => {
      const node = makeBsc();
      const r = await svc.appendValue(node, 88, new Date("2026-06-01T00:00:00Z"));
      expect(r.ok).toBe(true);
      const latest = node.card.history().at(-1)!;
      expect(latest.value).toBe(88);
    });

    it("rejects + rolls back when persist throws", async () => {
      persist.mockRejectedValueOnce(new Error("nope"));
      const node = makeText();
      const before = node.card.history().length;
      const r = await svc.appendValue(node, "x", new Date("2026-05-01T00:00:00Z"));
      expect(r.ok).toBe(false);
      // Rollback removes the appended entry.
      expect(node.card.history()).toHaveLength(before);
    });

    it("rejects when a string value is provided to a BSC node (type mismatch)", async () => {
      const node = makeBsc();
      const r = await svc.appendValue(node, "not a number", new Date());
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/numeric/);
      }
    });

    it("rejects when a number is provided to a TextNode (type mismatch)", async () => {
      const node = makeText();
      const r = await svc.appendValue(node, 42, new Date());
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toMatch(/string/);
      }
    });

    // SPEC \u00a717.57 \u2014 the inline value-edit kiosk gesture omits the
    // date; the service stamps the entry with `clock.now()` rather than
    // forcing each caller to drag a `new Date()` through the boundary.
    it("defaults `asOf` to `clock.now()` when the caller omits it", async () => {
      const node = makeText();
      const r = await svc.appendValue(node, "no-date inline edit");
      expect(r.ok).toBe(true);
      const latest = node.card.history().at(-1)!;
      expect(latest.value).toBe("no-date inline edit");
      expect(latest.asOf.getTime()).toBe(FAKE_NOW.getTime());
    });

    it("calls `clock.now()` only when `asOf` is omitted (explicit dates skip the port)", async () => {
      const node = makeText();
      const nowSpy = vi.fn(() => FAKE_NOW);
      const spied: Clock = { now: nowSpy };
      const spiedSvc = new EditNodeService(spied, persist);
      await spiedSvc.appendValue(node, "explicit", new Date("2026-05-01T00:00:00Z"));
      expect(nowSpy).not.toHaveBeenCalled();
      await spiedSvc.appendValue(node, "implicit");
      expect(nowSpy).toHaveBeenCalledTimes(1);
    });
  });
});
