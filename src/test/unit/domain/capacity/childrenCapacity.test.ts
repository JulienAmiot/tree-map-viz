import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import {
  canAddChild,
  MAX_CHILDREN,
  shouldRenderPlusTile,
} from "../../../../domain/capacity/childrenCapacity.js";
import { TextNode } from "../../../../domain/nodes/TextNode.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const clock: Clock = { now: () => Timestamp.of(new Date("2026-05-11T10:00:00Z")) };
const w = Weight.of(1);
const node = (id: string): TextNode => new TextNode(id, id, w, clock);

const buildParentWith = (n: number): TextNode => {
  const parent = node("p");
  for (let i = 0; i < n; i++) parent.attach(node(`c${i}`));
  return parent;
};

describe("childrenCapacity (§17.90 — Phase B.2: v4 children-capacity helpers)", () => {
  it("MAX_CHILDREN = 12 preserves the v3 UX limit verbatim", () => {
    expect(MAX_CHILDREN).toBe(12);
  });

  it("canAddChild: true when below capacity (0, 1, 11 children)", () => {
    expect(canAddChild(buildParentWith(0))).toBe(true);
    expect(canAddChild(buildParentWith(1))).toBe(true);
    expect(canAddChild(buildParentWith(11))).toBe(true);
  });

  it("canAddChild: false when at or above capacity (12 children)", () => {
    expect(canAddChild(buildParentWith(12))).toBe(false);
  });

  it("shouldRenderPlusTile: matches canAddChild across the boundary (today they are equivalent)", () => {
    for (let n = 0; n <= 13; n++) {
      const p = buildParentWith(Math.min(n, 12));
      expect(shouldRenderPlusTile(p)).toBe(canAddChild(p));
    }
  });

  it("works on an empty leaf node (no attached children)", () => {
    expect(canAddChild(node("leaf"))).toBe(true);
    expect(shouldRenderPlusTile(node("leaf"))).toBe(true);
  });
});
