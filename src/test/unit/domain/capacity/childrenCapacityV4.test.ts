import { describe, expect, it } from "vitest";

import type { Clock } from "../../../../domain/capabilities/Clock.js";
import {
  canAddChildV4,
  MAX_CHILDREN_V4,
  shouldRenderPlusTileV4,
} from "../../../../domain/capacity/childrenCapacityV4.js";
import { TextNodeV4 } from "../../../../domain/nodes/TextNodeV4.js";
import { Timestamp } from "../../../../domain/values/Timestamp.js";
import { Weight } from "../../../../domain/values/Weight.js";

const clock: Clock = { now: () => Timestamp.of(new Date("2026-05-11T10:00:00Z")) };
const w = Weight.of(1);
const node = (id: string): TextNodeV4 => new TextNodeV4(id, id, w, clock);

const buildParentWith = (n: number): TextNodeV4 => {
  const parent = node("p");
  for (let i = 0; i < n; i++) parent.attach(node(`c${i}`));
  return parent;
};

describe("childrenCapacityV4 (§17.90 — Phase B.2: v4 children-capacity helpers)", () => {
  it("MAX_CHILDREN_V4 = 12 preserves the v3 UX limit verbatim", () => {
    expect(MAX_CHILDREN_V4).toBe(12);
  });

  it("canAddChildV4: true when below capacity (0, 1, 11 children)", () => {
    expect(canAddChildV4(buildParentWith(0))).toBe(true);
    expect(canAddChildV4(buildParentWith(1))).toBe(true);
    expect(canAddChildV4(buildParentWith(11))).toBe(true);
  });

  it("canAddChildV4: false when at or above capacity (12 children)", () => {
    expect(canAddChildV4(buildParentWith(12))).toBe(false);
  });

  it("shouldRenderPlusTileV4: matches canAddChildV4 across the boundary (today they are equivalent)", () => {
    for (let n = 0; n <= 13; n++) {
      const p = buildParentWith(Math.min(n, 12));
      expect(shouldRenderPlusTileV4(p)).toBe(canAddChildV4(p));
    }
  });

  it("works on an empty leaf node (no attached children)", () => {
    expect(canAddChildV4(node("leaf"))).toBe(true);
    expect(shouldRenderPlusTileV4(node("leaf"))).toBe(true);
  });
});
