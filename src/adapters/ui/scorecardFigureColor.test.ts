import { describe, expect, it } from "vitest";
import { colorForScorecardFigure } from "./scorecardFigureColor.js";

describe("colorForScorecardFigure", () => {
  it("at minimal maps to a red channel–dominant color", () => {
    const c = colorForScorecardFigure(0, 0, 100);
    expect(c.startsWith("rgb(")).toBe(true);
    expect(c).toMatch(/rgb\(\s*255/);
  });

  it("at target maps to a green-dominant color", () => {
    const c = colorForScorecardFigure(100, 0, 100);
    expect(c).toMatch(/rgb\(\s*0/);
  });

  it("at midpoint is between (orange / yellow range)", () => {
    const c = colorForScorecardFigure(50, 0, 100);
    expect(c).toMatch(/rgb\(/);
    expect(c).not.toBe(colorForScorecardFigure(0, 0, 100));
  });

  it("clamps below min to red and above max to green", () => {
    const low = colorForScorecardFigure(-100, 0, 100);
    const atMin = colorForScorecardFigure(0, 0, 100);
    const high = colorForScorecardFigure(200, 0, 100);
    const atMax = colorForScorecardFigure(100, 0, 100);
    expect(low).toBe(atMin);
    expect(high).toBe(atMax);
  });

  it("orders min and max when given reversed bounds", () => {
    const a = colorForScorecardFigure(50, 100, 0);
    const b = colorForScorecardFigure(50, 0, 100);
    expect(a).toBe(b);
  });
});
