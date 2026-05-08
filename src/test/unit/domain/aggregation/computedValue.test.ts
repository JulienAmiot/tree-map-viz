import { describe, expect, it } from "vitest";

import { computedValue } from "../../../../domain/aggregation/computedValue.js";
import { BusinessScoreCard } from "../../../../domain/nodes/BusinessScoreCard.js";
import {
  BusinessScoreCardNode,
  EmptyHistoryError,
} from "../../../../domain/nodes/BusinessScoreCardNode.js";
import { TextCard } from "../../../../domain/nodes/TextCard.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Objective } from "../../../../domain/values/Objective.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../domain/values/Title.js";
import { Unit } from "../../../../domain/values/Unit.js";
import { Weight } from "../../../../domain/values/Weight.js";

const identity = NodeIdentity.of(Title.of("X"), Description.of(""));
const farFuture = Objective.of(0, 100, Timestamp.of(new Date("2030-12-31T00:00:00Z")));
const tv = (v: number, isoDate: string) =>
  TimestampedValue.of(v, Timestamp.of(new Date(`${isoDate}T00:00:00Z`)));

interface BscOpts {
  id?: string;
  weight?: number;
  computed?: boolean;
  eligible?: boolean;
  history?: TimestampedValue<number>[];
}

function bsc(opts: BscOpts = {}): BusinessScoreCardNode<number> {
  const card = BusinessScoreCard.of(
    Unit.percent(),
    farFuture,
    opts.history ?? [tv(50, "2026-01-01")],
  );
  return new BusinessScoreCardNode(
    opts.id ?? "n",
    identity,
    Weight.of(opts.weight ?? 1),
    card,
    opts.computed ?? false,
    opts.eligible ?? true,
  );
}

function txt(idStr = "tn"): TextNode {
  return new TextNode(idStr, identity, Weight.of(1), TextCard.of());
}

describe("computedValue", () => {
  describe("non-computed parent (computed === false)", () => {
    it("returns kind 'recordedValue' with the node's currentValue", () => {
      const node = bsc({ history: [tv(40, "2024-01-15"), tv(80, "2026-04-26")] });
      const result = computedValue(node);
      expect(result.kind).toBe("recordedValue");
      if (result.kind === "recordedValue") {
        expect(result.value.value).toBe(80);
        expect(result.value.asOf.getTime()).toBe(new Date("2026-04-26T00:00:00Z").getTime());
      }
    });

    it("propagates EmptyHistoryError when the node has no history", () => {
      const node = bsc({ history: [] });
      expect(() => computedValue(node)).toThrow(EmptyHistoryError);
    });

    it("ignores children for non-computed parents (does not aggregate)", () => {
      const node = bsc({ history: [tv(50, "2026-01-01")] });
      node.attach(bsc({ id: "c1", history: [tv(999, "2026-01-01")] }));
      const result = computedValue(node);
      expect(result.kind).toBe("recordedValue");
      if (result.kind === "recordedValue") {
        expect(result.value.value).toBe(50);
      }
    });
  });

  describe("computed parent with no children", () => {
    it("returns kind 'childrenCount' with n === 0", () => {
      const node = bsc({ computed: true });
      const result = computedValue(node);
      expect(result).toEqual({ kind: "childrenCount", n: 0 });
    });
  });

  describe("computed parent with only TextNode children", () => {
    it("returns kind 'childrenCount' with n equal to total children count", () => {
      const node = bsc({ computed: true });
      node.attach(txt("t1"));
      node.attach(txt("t2"));
      node.attach(txt("t3"));
      const result = computedValue(node);
      expect(result).toEqual({ kind: "childrenCount", n: 3 });
    });
  });

  describe("computed parent with only ineligible BSC children", () => {
    it("returns kind 'childrenCount' with n equal to total children count", () => {
      const node = bsc({ computed: true });
      node.attach(bsc({ id: "c1", eligible: false }));
      node.attach(bsc({ id: "c2", eligible: false }));
      const result = computedValue(node);
      expect(result).toEqual({ kind: "childrenCount", n: 2 });
    });
  });

  describe("computed parent with a single eligible BSC child", () => {
    it("returns kind 'computedValue' equal to that child's contribution value", () => {
      const node = bsc({ computed: true });
      node.attach(bsc({ id: "c1", weight: 5, history: [tv(75, "2026-04-01")] }));
      const result = computedValue(node);
      expect(result.kind).toBe("computedValue");
      if (result.kind === "computedValue") {
        expect(result.value).toBeCloseTo(75, 10);
      }
    });
  });

  describe("computed parent with multiple eligible BSC children", () => {
    it("returns kind 'computedValue' equal to the weighted mean by Weight.value", () => {
      const node = bsc({ computed: true });
      // (50*1 + 100*3) / (1+3) = 350/4 = 87.5
      node.attach(bsc({ id: "c1", weight: 1, history: [tv(50, "2026-01-01")] }));
      node.attach(bsc({ id: "c2", weight: 3, history: [tv(100, "2026-01-01")] }));
      const result = computedValue(node);
      expect(result.kind).toBe("computedValue");
      if (result.kind === "computedValue") {
        expect(result.value).toBeCloseTo(87.5, 10);
      }
    });

    it("uses each child's *latest* contribution value, not all history", () => {
      const node = bsc({ computed: true });
      // c1 latest = 80, c2 latest = 40, equal weights → mean = 60.
      node.attach(
        bsc({
          id: "c1",
          weight: 1,
          history: [tv(20, "2024-01-15"), tv(80, "2026-04-26")],
        }),
      );
      node.attach(
        bsc({
          id: "c2",
          weight: 1,
          history: [tv(60, "2024-01-15"), tv(40, "2026-04-26")],
        }),
      );
      const result = computedValue(node);
      expect(result.kind).toBe("computedValue");
      if (result.kind === "computedValue") {
        expect(result.value).toBeCloseTo(60, 10);
      }
    });
  });

  describe("computed parent with mixed children (eligible + ineligible + TextNode)", () => {
    it("includes only ContributesToParent children that report isEligible() === true", () => {
      const node = bsc({ computed: true });
      node.attach(
        bsc({ id: "elig", weight: 2, eligible: true, history: [tv(80, "2026-01-01")] }),
      );
      node.attach(
        bsc({ id: "inelig", weight: 5, eligible: false, history: [tv(0, "2026-01-01")] }),
      );
      node.attach(txt("text-only"));
      const result = computedValue(node);
      expect(result.kind).toBe("computedValue");
      if (result.kind === "computedValue") {
        expect(result.value).toBeCloseTo(80, 10);
      }
    });

    it("falls back to childrenCount when no child is both ContributesToParent and eligible", () => {
      const node = bsc({ computed: true });
      node.attach(bsc({ id: "inelig", eligible: false }));
      node.attach(txt("t1"));
      node.attach(txt("t2"));
      const result = computedValue(node);
      expect(result).toEqual({ kind: "childrenCount", n: 3 });
    });
  });

  describe("error propagation from children", () => {
    it("propagates EmptyHistoryError when an eligible child has no history", () => {
      const node = bsc({ computed: true });
      node.attach(bsc({ id: "c1", history: [] }));
      expect(() => computedValue(node)).toThrow(EmptyHistoryError);
    });
  });
});
