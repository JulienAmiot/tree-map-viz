import { describe, expect, it } from "vitest";

import type { ContributesToParent } from "../../../../domain/capabilities/ContributesToParent.js";
import type { HasObjective } from "../../../../domain/capabilities/HasObjective.js";
import type { Historizable } from "../../../../domain/capabilities/Historizable.js";
import { EmptyHistoryError } from "../../../../domain/nodes/EmptyHistoryError.js";
import { TextCard } from "../../../../domain/nodes/TextCard.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { TimestampedValue } from "../../../../domain/values/TimestampedValue.js";
import { Title } from "../../../../domain/values/Title.js";
import { Weight } from "../../../../domain/values/Weight.js";

const identity = NodeIdentity.of(Title.of("Notes"), Description.of("Free-form text"));
const weight = Weight.of(3);

function makeTextNode(opts: {
  id?: string;
  history?: { value: string; iso: string }[];
} = {}): TextNode {
  const card = TextCard.of(
    (opts.history ?? []).map((e) => TimestampedValue.of(e.value, new Date(e.iso))),
  );
  return new TextNode(opts.id ?? "tn-1", identity, weight, card);
}

describe("TextNode", () => {
  describe("construction", () => {
    it("exposes id, identity, and weight inherited from TreeNode", () => {
      const n = makeTextNode({ id: "tn-42" });
      expect(n.id).toBe("tn-42");
      expect(n.identity.equals(identity)).toBe(true);
      expect(n.weight.equals(weight)).toBe(true);
    });

    it("starts with no parent and no children", () => {
      const n = makeTextNode();
      expect(n.parent).toBeNull();
      expect(n.children).toEqual([]);
    });

    it("stores the supplied TextCard reference (no copy/clone)", () => {
      const card = TextCard.of([
        TimestampedValue.of("hello", new Date("2026-04-01T00:00:00.000Z")),
      ]);
      const n = new TextNode("id", identity, weight, card);
      expect(n.card).toBe(card);
    });
  });

  describe("history()", () => {
    it("delegates to the underlying TextCard (sorted ascending by date)", () => {
      const n = makeTextNode({
        history: [
          { value: "later", iso: "2026-04-23T00:00:00.000Z" },
          { value: "earlier", iso: "2026-04-22T00:00:00.000Z" },
        ],
      });
      const h = n.history();
      expect(h).toHaveLength(2);
      expect(h[0]!.value).toBe("earlier");
      expect(h[1]!.value).toBe("later");
    });
  });

  describe("currentValue()", () => {
    it("returns the latest TimestampedValue<string> when the history is non-empty", () => {
      const n = makeTextNode({
        history: [
          { value: "earlier", iso: "2026-04-22T00:00:00.000Z" },
          { value: "newest", iso: "2026-04-23T00:00:00.000Z" },
        ],
      });
      const cv = n.currentValue();
      expect(cv.value).toBe("newest");
      expect(cv.asOf.toISOString()).toBe("2026-04-23T00:00:00.000Z");
    });

    it("throws EmptyHistoryError when the underlying TextCard has no entries", () => {
      const n = makeTextNode();
      expect(() => n.currentValue()).toThrow(EmptyHistoryError);
    });

    it("the thrown error names the offending node id", () => {
      const n = makeTextNode({ id: "tn-with-id" });
      try {
        n.currentValue();
        expect.fail("expected EmptyHistoryError");
      } catch (e) {
        expect(e).toBeInstanceOf(EmptyHistoryError);
        expect((e as Error).message).toContain("tn-with-id");
      }
    });
  });

  describe("compile-time capability surface (SPEC §3 — Option B)", () => {
    it("IS structurally assignable to Historizable<string> (gained in §17.14)", () => {
      const n = makeTextNode({
        history: [{ value: "x", iso: "2026-04-23T00:00:00.000Z" }],
      });
      const h: Historizable<string> = n;
      expect(h.history()).toHaveLength(1);
    });

    it("is NOT structurally assignable to ContributesToParent<unknown>", () => {
      const n = makeTextNode();
      // @ts-expect-error TextNode does not implement ContributesToParent at the type level (SPEC §3)
      const c: ContributesToParent<unknown> = n;
      expect(c).toBe(n);
    });

    it("is NOT structurally assignable to HasObjective<unknown>", () => {
      const n = makeTextNode();
      // @ts-expect-error TextNode does not implement HasObjective at the type level (SPEC §3)
      const o: HasObjective<unknown> = n;
      expect(o).toBe(n);
    });
  });
});
