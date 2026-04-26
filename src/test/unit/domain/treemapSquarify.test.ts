import { describe, expect, it } from "vitest";

import { layoutSquarified } from "../../../domain/treemapSquarify.js";

const PHI = (1 + Math.sqrt(5)) / 2;

type Rect = { x: number; y: number; w: number; h: number };

function totalAreaFraction(rects: Rect[], w: number, h: number): number {
  return rects.reduce((a, r) => a + r.w * r.h, 0) / (w * h);
}

function largestByArea(rects: Rect[]): Rect {
  return rects.reduce((max, r) => (r.w * r.h > max.w * max.h ? r : max), rects[0]!);
}

function smallestByArea(rects: Rect[]): Rect {
  return rects.reduce((min, r) => (r.w * r.h < min.w * min.h ? r : min), rects[0]!);
}

describe("layoutSquarified", () => {
  describe("baseline behaviour", () => {
    it("allocates two tiles with area ratio matching weights 2:1", () => {
      const W = 600;
      const H = 300;
      const rects = layoutSquarified([2, 1], W, H, { padding: 0 });
      expect(rects).toHaveLength(2);
      const a0 = rects[0]!.w * rects[0]!.h;
      const a1 = rects[1]!.w * rects[1]!.h;
      const ratio = a0 / a1;
      expect(ratio).toBeCloseTo(2, 1);
      expect(totalAreaFraction(rects, W, H)).toBeCloseTo(1, 5);
    });

    it("fills the container and keeps tiles inside bounds (including padding)", () => {
      const W = 400;
      const H = 300;
      const p = 4;
      const rects = layoutSquarified([1, 1, 1, 1, 1], W, H, { padding: p });
      expect(rects).toHaveLength(5);
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(p - 0.01);
        expect(r.y).toBeGreaterThanOrEqual(p - 0.01);
        expect(r.x + r.w).toBeLessThanOrEqual(W - p + 0.01);
        expect(r.y + r.h).toBeLessThanOrEqual(H - p + 0.01);
      }
    });

    it("uses equal areas when all weights are zero (fallback)", () => {
      const rects = layoutSquarified([0, 0, 0], 100, 100, { padding: 0 });
      const areas = rects.map((r) => r.w * r.h);
      expect(areas[0]!).toBeCloseTo(areas[1]!, 0);
      expect(areas[1]!).toBeCloseTo(areas[2]!, 0);
    });
  });

  describe("aspect-ratio of the largest tile (SPEC \u00a74)", () => {
    it("keeps the largest tile within [1/\u03c6, \u03c6] for typical weights", () => {
      // [4, 1] in 600x600 → val=4 tile dominates; sliced row gives ~600x480 for it.
      const rects = layoutSquarified([4, 1], 600, 600, { padding: 0 });
      const largest = largestByArea(rects);
      const aspect = largest.w / largest.h;
      expect(aspect).toBeGreaterThanOrEqual(1 / PHI - 1e-6);
      expect(aspect).toBeLessThanOrEqual(PHI + 1e-6);
    });
  });

  describe("orientation switch (SPEC \u00a74)", () => {
    it("landscape container: 2 children split horizontally, both with full height", () => {
      const rects = layoutSquarified([1, 1], 600, 300, { padding: 0 });
      expect(rects).toHaveLength(2);
      expect(rects[0]!.h).toBeCloseTo(300, 1);
      expect(rects[1]!.h).toBeCloseTo(300, 1);
      expect(rects[0]!.w + rects[1]!.w).toBeCloseTo(600, 1);
    });

    it("portrait container: 2 children split vertically, both with full width", () => {
      const rects = layoutSquarified([1, 1], 300, 600, { padding: 0 });
      expect(rects).toHaveLength(2);
      expect(rects[0]!.w).toBeCloseTo(300, 1);
      expect(rects[1]!.w).toBeCloseTo(300, 1);
      expect(rects[0]!.h + rects[1]!.h).toBeCloseTo(600, 1);
    });
  });

  describe("min-tile clamp (SPEC \u00a74 line 105: ~1/12 floor)", () => {
    it("clamps the smallest tile area to \u22651/12 of the children area for highly skewed weights", () => {
      const W = 600;
      const H = 600;
      const minTileArea = (W * H) / 12;
      const rects = layoutSquarified([100, 1, 1, 1, 1], W, H, { padding: 0 });
      const smallest = smallestByArea(rects);
      expect(smallest.w * smallest.h).toBeGreaterThanOrEqual(minTileArea - 1);
    });

    it("still fills the entire container after clamping", () => {
      const W = 600;
      const H = 600;
      const rects = layoutSquarified([100, 1, 1, 1, 1], W, H, { padding: 0 });
      expect(totalAreaFraction(rects, W, H)).toBeCloseTo(1, 5);
    });

    it("does not trigger when all weights are above the floor", () => {
      const W = 600;
      const H = 300;
      const rects = layoutSquarified([2, 1], W, H, { padding: 0 });
      const a0 = rects[0]!.w * rects[0]!.h;
      const a1 = rects[1]!.w * rects[1]!.h;
      expect(a0 / a1).toBeCloseTo(2, 1);
    });
  });
});
