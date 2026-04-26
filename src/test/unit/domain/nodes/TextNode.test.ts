import { describe, expect, it } from "vitest";

import type { ContributesToParent } from "../../../../domain/capabilities/ContributesToParent.js";
import type { HasObjective } from "../../../../domain/capabilities/HasObjective.js";
import type { Historizable } from "../../../../domain/capabilities/Historizable.js";
import { NotValuedError, TextNode } from "../../../../domain/nodes/TextNode.js";
import { Description } from "../../../../domain/values/Description.js";
import { NodeIdentity } from "../../../../domain/values/NodeIdentity.js";
import { Title } from "../../../../domain/values/Title.js";
import { Weight } from "../../../../domain/values/Weight.js";

const identity = NodeIdentity.of(Title.of("Notes"), Description.of("Free-form text"));
const weight = Weight.of(3);

function makeTextNode(id = "tn-1"): TextNode {
  return new TextNode(id, identity, weight);
}

describe("TextNode", () => {
  describe("construction", () => {
    it("exposes id, identity, and weight inherited from TreeNode", () => {
      const n = makeTextNode("tn-42");
      expect(n.id).toBe("tn-42");
      expect(n.identity.equals(identity)).toBe(true);
      expect(n.weight.equals(weight)).toBe(true);
    });

    it("starts with no parent and no children", () => {
      const n = makeTextNode();
      expect(n.parent).toBeNull();
      expect(n.children).toEqual([]);
    });
  });

  describe("currentValue()", () => {
    it("throws NotValuedError because a TextNode has no value", () => {
      const n = makeTextNode();
      expect(() => n.currentValue()).toThrow(NotValuedError);
    });

    it("the thrown error names the offending node id", () => {
      const n = makeTextNode("tn-with-id");
      try {
        n.currentValue();
      } catch (e) {
        expect(e).toBeInstanceOf(NotValuedError);
        expect((e as Error).message).toContain("tn-with-id");
      }
    });
  });

  describe("compile-time capability exclusion", () => {
    it("is NOT structurally assignable to ContributesToParent<unknown>", () => {
      const n = makeTextNode();
      // @ts-expect-error TextNode does not implement ContributesToParent at the type level (SPEC §3 line 40)
      const c: ContributesToParent<unknown> = n;
      expect(c).toBe(n);
    });

    it("is NOT structurally assignable to Historizable<unknown>", () => {
      const n = makeTextNode();
      // @ts-expect-error TextNode does not implement Historizable at the type level (SPEC §3 line 40)
      const h: Historizable<unknown> = n;
      expect(h).toBe(n);
    });

    it("is NOT structurally assignable to HasObjective<unknown>", () => {
      const n = makeTextNode();
      // @ts-expect-error TextNode does not implement HasObjective at the type level (SPEC §3 line 40)
      const o: HasObjective<unknown> = n;
      expect(o).toBe(n);
    });
  });
});
