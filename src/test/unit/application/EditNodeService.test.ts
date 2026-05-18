import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditNodeService } from "../../../application/EditNodeService.js";
import type { Clock } from "../../../domain/capabilities/Clock.js";
import { BusinessScoreCard } from "../../../domain/cards/BusinessScoreCard.js";
import { ComputationKind } from "../../../domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "../../../domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "../../../domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "../../../domain/nodes/ComputedNode.js";
import { PictureNode } from "../../../domain/nodes/PictureNode.js";
import { StrictRangeNode } from "../../../domain/nodes/StrictRangeNode.js";
import { TextNode } from "../../../domain/nodes/TextNode.js";
import { WorkflowNode } from "../../../domain/nodes/WorkflowNode.js";
import { URLNode } from "../../../domain/nodes/URLNode.js";
import { NumericComparator } from "../../../domain/values/Comparator.js";
import { Objective } from "../../../domain/values/Objective.js";
import { LenientRange, StrictRange } from "../../../domain/values/Range.js";
import { Timestamp } from "../../../domain/values/Timestamp.js";
import { Unit } from "../../../domain/values/Unit.js";
import { Weight } from "../../../domain/values/Weight.js";

const NOW = new Date("2026-05-16T14:00:00Z");
const clock: Clock = { now: () => Timestamp.of(NOW) };
const makeText = (history: [string, string][] = []): TextNode => {
  const n = new TextNode("t1", "Notes", Weight.of(1), clock);
  for (const [iso, v] of history) n.addValue(Timestamp.of(new Date(iso)), v);
  return n;
};
const makeBSN = (unit = "%"): BusinessScoreNode<number> => new BusinessScoreNode<number>(
  "b1", "Revenue", Weight.of(2), "old desc", clock,
  LenientRange.of(0, 1_000, NumericComparator.INSTANCE),
  { objective: Objective.of(100, Timestamp.of(new Date("2026-12-31T00:00:00Z"))), unit },
);

describe("EditNodeService (§17.101a — Phase C skeleton + 2 v3-compat kinds + appendValue)", () => {
  let persist: ReturnType<typeof vi.fn>;
  let svc: EditNodeService;

  beforeEach(() => {
    persist = vi.fn().mockResolvedValue(undefined);
    svc = new EditNodeService(clock, persist);
  });

  it("Text edit — title + weight + disabled propagate; trim applies; persist invoked once", async () => {
    const node = makeText();
    const r = await svc.editFields(node, {
      kind: "TextNode", title: "  Renamed  ", weight: 3, disabled: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(node.title).toBe("Renamed");
      expect(node.weight.value).toBe(3);
      expect(node.disabled).toBe(true);
    }
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("BusinessScore edit — title + description + weight + objective + unit (via card) + disabled all apply atomically", async () => {
    const node = makeBSN();
    const card = new BusinessScoreCard(node, Unit.of("%"));
    const cards = new Map([["b1", card]]);
    const r = await svc.editFields(node, {
      kind: "BusinessScore",
      title: "Sales",
      description: "EU monthly",
      weight: 5,
      objective: { value: 250, at: new Date("2027-06-30T00:00:00Z") },
      unit: "$",
      disabled: true,
    }, { cards });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(node.title).toBe("Sales");
      expect(node.getDescription()).toBe("EU monthly");
      expect(node.weight.value).toBe(5);
      expect(node.objective.value).toBe(250);
      expect(node.objective.at.moment.toISOString()).toBe("2027-06-30T00:00:00.000Z");
      expect(card.getUnit().value).toBe("$");
      expect(node.disabled).toBe(true);
    }
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("validation + rollback — kind mismatch, empty title, bad weight, unit-without-card, persist-throw all → { ok: false } with no mutation", async () => {
    const text = makeText();
    const bsn0 = makeBSN();
    const titleBefore = text.title;
    const r1 = await svc.editFields(text, { kind: "BusinessScore", title: "X" });
    const r2 = await svc.editFields(text, { kind: "TextNode", title: "   " });
    const r3 = await svc.editFields(text, { kind: "TextNode", weight: 0 });
    const r4 = await svc.editFields(bsn0, { kind: "BusinessScore", unit: "$" });
    for (const r of [r1, r2, r3, r4]) expect(r.ok).toBe(false);
    expect(text.title).toBe(titleBefore);
    expect(bsn0.unit).toBe("%");
    expect(persist).not.toHaveBeenCalled();

    const failing = vi.fn().mockRejectedValue(new Error("Storage down"));
    const bsn = makeBSN();
    const card = new BusinessScoreCard(bsn, Unit.of("%"));
    const failSvc = new EditNodeService(clock, failing);
    const before = { title: bsn.title, obj: bsn.objective, unit: card.getUnit() };
    const r5 = await failSvc.editFields(bsn, {
      kind: "BusinessScore", title: "NewName",
      objective: { value: 999, at: new Date("2028-01-01T00:00:00Z") }, unit: "kg",
    }, { cards: new Map([["b1", card]]) });
    expect(r5.ok).toBe(false);
    expect(bsn.title).toBe(before.title);
    expect(bsn.objective).toBe(before.obj);
    expect(card.getUnit()).toBe(before.unit);
  });

  it("StrictRange edit + appendValue — common edits propagate; in-range appendValue succeeds; out-of-range surfaces { ok: false } with rollback", async () => {
    const range = StrictRange.of(0, 100, NumericComparator.INSTANCE);
    const node = new StrictRangeNode<number>("sr1", "Saturation", Weight.of(1), "old", clock, range);
    const r = await svc.editFields(node, {
      kind: "StrictRange", title: "CPU sat", weight: 4, description: "core busy %", disabled: true,
    });
    expect(r.ok).toBe(true);
    expect(node.title).toBe("CPU sat");
    expect(node.weight.value).toBe(4);
    expect(node.getDescription()).toBe("core busy %");
    expect(node.disabled).toBe(true);

    const inRange = await svc.appendValue(node, 75);
    expect(inRange.ok).toBe(true);
    expect(node.getValue()).toBe(75);

    const before = node.entries().length;
    const outOfRange = await svc.appendValue(node, 150);
    expect(outOfRange.ok).toBe(false);
    expect(node.entries()).toHaveLength(before);
  });

  it("Computed edit — setComputationKind flips strategy + common edits propagate; appendValue rejected (audit-only history)", async () => {
    const node = new ComputedNode<number>("c1", "Mean", Weight.of(1), "", clock, ComputationKind.AVERAGE);
    const r = await svc.editFields(node, {
      kind: "Computed", title: "Sum of children", description: "auto", disabled: false, computationKind: ComputationKind.SUM,
    });
    expect(r.ok).toBe(true);
    expect(node.title).toBe("Sum of children");
    expect(node.getDescription()).toBe("auto");
    expect(node.computationKind).toBe(ComputationKind.SUM);

    const append = await svc.appendValue(node, 42);
    expect(append.ok).toBe(false);
    if (!append.ok) expect(append.reason).toMatch(/computation|override|computed/i);
  });

  it("ComputedBusinessScore edit — title + description + objective + unit + computationKind + disabled all atomic; kind exact-class match (BSN payload rejected)", async () => {
    const range = LenientRange.of(0, 1_000, NumericComparator.INSTANCE);
    const node = new ComputedBusinessScoreNode<number>(
      "cbsn1", "Auto-score", Weight.of(2), "", clock, range,
      {
        objective: Objective.of(50, Timestamp.of(new Date("2027-01-01T00:00:00Z"))),
        unit: "pts",
        initialKind: ComputationKind.AVERAGE,
      },
    );
    const card = new BusinessScoreCard(node, Unit.of("pts"));
    const cards = new Map([["cbsn1", card]]);

    const wrongKind = await svc.editFields(node, { kind: "BusinessScore", title: "X" }, { cards });
    expect(wrongKind.ok).toBe(false);

    const r = await svc.editFields(node, {
      kind: "ComputedBusinessScore",
      title: "Composite KPI",
      description: "rolled up",
      objective: { value: 90, at: new Date("2027-12-31T00:00:00Z") },
      unit: "%",
      computationKind: ComputationKind.WEIGHTED_AVERAGE,
      disabled: true,
    }, { cards });
    expect(r.ok).toBe(true);
    expect(node.title).toBe("Composite KPI");
    expect(node.getDescription()).toBe("rolled up");
    expect(node.objective.value).toBe(90);
    expect(card.getUnit().value).toBe("%");
    expect(node.computationKind).toBe(ComputationKind.WEIGHTED_AVERAGE);
    expect(node.disabled).toBe(true);
  });

  describe("Workflow (§17.117) — statusId editable + inherits the full TextNode appendValue + title/weight edit surface", () => {
    const makeWorkflow = (statusId = "plan"): WorkflowNode =>
      new WorkflowNode("wf1", "Sprint task", Weight.of(1), clock, statusId);

    it("Workflow edit — title + weight + statusId apply atomically; persist invoked once", async () => {
      const node = makeWorkflow();
      const r = await svc.editFields(node, {
        kind: "Workflow",
        title: "  Renamed task  ",
        weight: 4,
        statusId: "do",
      });
      expect(r.ok).toBe(true);
      expect(node.title).toBe("Renamed task");
      expect(node.weight.value).toBe(4);
      expect(node.statusId).toBe("do");
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("Workflow edit — statusId-only patch leaves title / weight / value untouched", async () => {
      const node = makeWorkflow("plan");
      node.setValue("body before");
      const r = await svc.editFields(node, { kind: "Workflow", statusId: "check" });
      expect(r.ok).toBe(true);
      expect(node.statusId).toBe("check");
      expect(node.title).toBe("Sprint task");
      expect(node.getValue()).toBe("body before");
    });

    it("Workflow edit — invalid statusId rolls back (no partial mutation; persist not invoked)", async () => {
      const node = makeWorkflow("plan");
      const r = await svc.editFields(node, {
        kind: "Workflow",
        title: "Should not apply",
        statusId: "   ",
      });
      expect(r.ok).toBe(false);
      expect(node.title).toBe("Sprint task");
      expect(node.statusId).toBe("plan");
      expect(persist).not.toHaveBeenCalled();
    });

    it("kind mismatch — passing kind=\"Workflow\" against a plain TextNode rejects via the exact-class guard (and the reverse)", async () => {
      const text = makeText();
      const wf = makeWorkflow();
      const r1 = await svc.editFields(text, { kind: "Workflow", statusId: "do" });
      expect(r1.ok).toBe(false);
      const r2 = await svc.editFields(wf, { kind: "TextNode", title: "X" });
      expect(r2.ok).toBe(false);
      expect(wf.title).toBe("Sprint task");
      expect(text.title).toBe("Notes");
    });

    it("appendValue on a WorkflowNode uses the inherited TextNode/string branch — value history is shared with the inline-edit path", async () => {
      const wf = makeWorkflow();
      const r = await svc.appendValue(wf, "design draft");
      expect(r.ok).toBe(true);
      expect(wf.getValue()).toBe("design draft");
      expect(wf.entries().at(-1)!.asOf.moment.toISOString()).toBe(NOW.toISOString());
    });
  });

  it("appendValue — Text + BSC; default asOf uses clock; type mismatch + persist-throw → { ok: false } with rollback", async () => {
    const text = makeText([["2026-04-01T00:00:00Z", "old"]]);
    const r1 = await svc.appendValue(text, "newest");
    expect(r1.ok).toBe(true);
    expect(text.getValue()).toBe("newest");
    expect(text.entries().at(-1)!.asOf.moment.toISOString()).toBe(NOW.toISOString());

    const bsn = makeBSN();
    const r2 = await svc.appendValue(bsn, 42, new Date("2026-03-15T00:00:00Z"));
    expect(r2.ok).toBe(true);
    expect(bsn.getValue()).toBe(42);

    expect((await svc.appendValue(text, 123 as never)).ok).toBe(false);

    const failing = vi.fn().mockRejectedValue(new Error("nope"));
    const before = bsn.entries().length;
    const r3 = await new EditNodeService(clock, failing).appendValue(bsn, 99);
    expect(r3.ok).toBe(false);
    expect(bsn.entries()).toHaveLength(before);
  });

  /**
   * SPEC §17.119 — Picture edits: title / weight / disabled flow
   * through the CommonEdit path; `imageUrl` flows through the
   * Picture-specific branch. The all-or-nothing edit contract holds
   * (a persister failure rolls back every touched field, including
   * the prior image URL).
   */
  describe("Picture edits (§17.119)", () => {
    it("swaps imageUrl + title + weight atomically and persists once", async () => {
      const pic = new PictureNode(
        "p1",
        "Old name",
        Weight.of(1),
        "https://a.example/x.png",
      );
      const r = await svc.editFields(pic, {
        kind: "Picture",
        title: "  New name  ",
        weight: 3,
        imageUrl: "  https://b.example/y.png  ",
      });
      expect(r.ok).toBe(true);
      expect(pic.title).toBe("New name");
      expect(pic.weight.value).toBe(3);
      expect(pic.imageUrl).toBe("https://b.example/y.png");
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("rejects a Picture edit on a TextNode (kind-class match enforced)", async () => {
      const txt = makeText();
      const r = await svc.editFields(txt, {
        kind: "Picture",
        imageUrl: "https://x",
      });
      expect(r.ok).toBe(false);
      expect(persist).not.toHaveBeenCalled();
    });

    it("rolls back imageUrl + title when the persister rejects (atomicity)", async () => {
      const pic = new PictureNode(
        "p2",
        "Old",
        Weight.of(1),
        "https://before.example/x.png",
      );
      const failing = vi.fn().mockRejectedValue(new Error("disk full"));
      const failingSvc = new EditNodeService(clock, failing);
      const r = await failingSvc.editFields(pic, {
        kind: "Picture",
        title: "Would-be new",
        imageUrl: "https://after.example/x.png",
      });
      expect(r.ok).toBe(false);
      expect(pic.title).toBe("Old");
      expect(pic.imageUrl).toBe("https://before.example/x.png");
    });

    it("rolls back when an invalid (empty) imageUrl throws mid-edit (the imageUrl swap is the LAST applied field; title/weight stayed atomic)", async () => {
      const pic = new PictureNode(
        "p3",
        "Old",
        Weight.of(1),
        "https://before.example/x.png",
      );
      const r = await svc.editFields(pic, {
        kind: "Picture",
        title: "Would-be new",
        weight: 4,
        imageUrl: "   ",
      });
      expect(r.ok).toBe(false);
      // SPEC §17.101a -- the edit contract is "all or nothing": the
      // common-edit branch already swapped title + weight before the
      // Picture branch threw on the invalid imageUrl, so the undo
      // chain restores BOTH on the way out.
      expect(pic.title).toBe("Old");
      expect(pic.weight.value).toBe(1);
      expect(pic.imageUrl).toBe("https://before.example/x.png");
      expect(persist).not.toHaveBeenCalled();
    });
  });

  /**
   * SPEC §17.120 — URL edits: title / weight / disabled flow through
   * the CommonEdit path; `url` flows through the URL-specific branch.
   * The all-or-nothing edit contract holds (a persister failure rolls
   * back every touched field, including the prior URL).
   */
  describe("URL edits (§17.120)", () => {
    it("swaps url + title + weight atomically and persists once (the URL lives in the description slot; both projections move together)", async () => {
      const u = new URLNode(
        "u1",
        "Old name",
        Weight.of(1),
        "https://before.example/x",
      );
      const r = await svc.editFields(u, {
        kind: "URL",
        title: "  New name  ",
        weight: 3,
        url: "  https://after.example/y  ",
      });
      expect(r.ok).toBe(true);
      expect(u.title).toBe("New name");
      expect(u.weight.value).toBe(3);
      expect(u.url).toBe("https://after.example/y");
      // SPEC §17.120 — setUrl delegates to setDescription, so the
      // description slot tracks the new URL too.
      expect(u.getDescription()).toBe("https://after.example/y");
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("treats url:undefined as 'no change' (CommonEdit fields still flow through)", async () => {
      const u = new URLNode("u", "Old", Weight.of(1), "https://x");
      const r = await svc.editFields(u, { kind: "URL", title: "New" });
      expect(r.ok).toBe(true);
      expect(u.title).toBe("New");
      expect(u.url).toBe("https://x");
    });

    it("rejects a URL edit on a TextNode (kind-class match enforced)", async () => {
      const txt = makeText();
      const r = await svc.editFields(txt, {
        kind: "URL",
        url: "https://x",
      });
      expect(r.ok).toBe(false);
      expect(persist).not.toHaveBeenCalled();
    });

    it("rejects a URL edit on a PictureNode (kind-class match is exact; PictureNode and URLNode are distinct subclasses despite sharing the ValueNode<string> base)", async () => {
      // SPEC §17.120 — the kind-class check guards against accidentally
      // routing a URL payload to a PictureNode (which would otherwise
      // pass the structural check — both have title/weight/disabled
      // and a single string slot).
      const pic = new PictureNode("p", "P", Weight.of(1), "https://x");
      const r = await svc.editFields(pic, { kind: "URL", url: "https://y" });
      expect(r.ok).toBe(false);
      // Original picture untouched.
      expect(pic.imageUrl).toBe("https://x");
    });

    it("rolls back url + title when the persister rejects (atomicity)", async () => {
      const u = new URLNode(
        "u2",
        "Old",
        Weight.of(1),
        "https://before.example/x",
      );
      const failing = vi.fn().mockRejectedValue(new Error("Storage full"));
      const failingSvc = new EditNodeService(clock, failing);
      const r = await failingSvc.editFields(u, {
        kind: "URL",
        title: "Would-be new",
        url: "https://after.example/x",
      });
      expect(r.ok).toBe(false);
      expect(u.title).toBe("Old");
      expect(u.url).toBe("https://before.example/x");
      expect(u.getDescription()).toBe("https://before.example/x");
    });

    it("rolls back when an invalid (empty) url throws mid-edit (the url swap is the LAST applied field; title/weight stayed atomic)", async () => {
      const u = new URLNode(
        "u3",
        "Old",
        Weight.of(1),
        "https://before.example/x",
      );
      const r = await svc.editFields(u, {
        kind: "URL",
        title: "Would-be new",
        weight: 4,
        url: "   ",
      });
      expect(r.ok).toBe(false);
      // SPEC §17.101a — the edit contract is "all or nothing": the
      // common-edit branch already swapped title + weight before the
      // URL branch threw on the invalid url, so the undo chain
      // restores BOTH on the way out.
      expect(u.title).toBe("Old");
      expect(u.weight.value).toBe(1);
      expect(u.url).toBe("https://before.example/x");
      expect(persist).not.toHaveBeenCalled();
    });
  });
});
