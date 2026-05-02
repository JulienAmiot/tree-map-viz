import { describe, expect, it } from "vitest";

import {
  deadlineShortfall,
  gradientColorAt,
  gradientPositionFraction,
  linearRegressionPrediction,
  linearRegressionSlope,
  progressRate,
  trendArrowFromRate,
  warningGradientColorAt,
} from "../../../../domain/aggregation/objectiveProgress.js";

const day = (iso: string): number => new Date(iso).getTime();

describe("gradientPositionFraction", () => {
  // §17.40 — direction-agnostic progress fraction. Encodes the
  // operator-facing semantic "how close are we to the target?",
  // collapsed to `[0, 1]` so the colour ramp can read it without
  // worrying about the sign of `target - min`.
  describe("ascending objective (min < target)", () => {
    it("returns 0 at the minimum", () => {
      expect(gradientPositionFraction(0, 0, 100)).toBe(0);
    });
    it("returns 1 at the target", () => {
      expect(gradientPositionFraction(100, 0, 100)).toBe(1);
    });
    it("returns 0.5 halfway", () => {
      expect(gradientPositionFraction(50, 0, 100)).toBe(0.5);
    });
    it("clamps below the minimum to 0", () => {
      expect(gradientPositionFraction(-20, 0, 100)).toBe(0);
    });
    it("clamps above the target to 1", () => {
      expect(gradientPositionFraction(120, 0, 100)).toBe(1);
    });
  });

  describe("descending objective (min > target)", () => {
    it("returns 0 at the minimum (the worst end)", () => {
      expect(gradientPositionFraction(100, 100, 20)).toBe(0);
    });
    it("returns 1 at the target", () => {
      expect(gradientPositionFraction(20, 100, 20)).toBe(1);
    });
    it("returns 0.5 halfway", () => {
      expect(gradientPositionFraction(60, 100, 20)).toBe(0.5);
    });
    it("clamps above the minimum (further from target) to 0", () => {
      expect(gradientPositionFraction(150, 100, 20)).toBe(0);
    });
    it("clamps below the target (overachiever) to 1", () => {
      expect(gradientPositionFraction(0, 100, 20)).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("returns 1 when min === target and current matches", () => {
      expect(gradientPositionFraction(50, 50, 50)).toBe(1);
    });
    it("returns 0 when min === target and current differs", () => {
      expect(gradientPositionFraction(40, 50, 50)).toBe(0);
    });
    it("returns 0 for NaN inputs", () => {
      expect(gradientPositionFraction(Number.NaN, 0, 100)).toBe(0);
      expect(gradientPositionFraction(50, Number.NaN, 100)).toBe(0);
      expect(gradientPositionFraction(50, 0, Number.NaN)).toBe(0);
    });
    it("returns 0 for non-finite inputs", () => {
      expect(gradientPositionFraction(Number.POSITIVE_INFINITY, 0, 100)).toBe(
        0,
      );
    });
  });
});

describe("linearRegressionPrediction", () => {
  // §17.40 — least-squares fit through historized entries, evaluated
  // at an arbitrary date. Used by `deadlineShortfall` to extrapolate
  // the operator's actual trajectory to the deadline.

  it("returns null with zero entries", () => {
    expect(linearRegressionPrediction([], day("2026-12-31"))).toBeNull();
  });

  it("returns null with a single entry (no slope is defined)", () => {
    expect(
      linearRegressionPrediction(
        [{ dateMs: day("2026-01-01"), value: 50 }],
        day("2026-12-31"),
      ),
    ).toBeNull();
  });

  it("returns null when all entries share the same timestamp", () => {
    expect(
      linearRegressionPrediction(
        [
          { dateMs: day("2026-04-23"), value: 10 },
          { dateMs: day("2026-04-23"), value: 20 },
          { dateMs: day("2026-04-23"), value: 30 },
        ],
        day("2026-12-31"),
      ),
    ).toBeNull();
  });

  it("fits a line through two distinct entries and extrapolates to the future", () => {
    // y = 80/119·t + b; at t = +245 days from the latest, y ≈ 80 + 165 ≈ 245
    const result = linearRegressionPrediction(
      [
        { dateMs: day("2026-01-01"), value: 0 },
        { dateMs: day("2026-04-30"), value: 80 },
      ],
      day("2026-12-31"),
    );
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(240);
    expect(result!).toBeLessThan(250);
  });

  it("extrapolates a flat-trend BSC at the same value (slope = 0)", () => {
    const result = linearRegressionPrediction(
      [
        { dateMs: day("2026-01-01"), value: 50 },
        { dateMs: day("2026-04-30"), value: 50 },
        { dateMs: day("2026-06-30"), value: 50 },
      ],
      day("2026-12-31"),
    );
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(50, 4);
  });

  it("least-squares averages out noisy data", () => {
    // Three entries clustered around y = 10·(month - 1) + noise; fit
    // should land near `y = 10·11 = 110` at month=12.
    const result = linearRegressionPrediction(
      [
        { dateMs: day("2026-01-01"), value: 12 },
        { dateMs: day("2026-04-01"), value: 28 },
        { dateMs: day("2026-07-01"), value: 62 },
      ],
      day("2026-12-31"),
    );
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(95);
    expect(result!).toBeLessThan(125);
  });

  it("handles a descending trend (negative slope)", () => {
    const result = linearRegressionPrediction(
      [
        { dateMs: day("2026-01-01"), value: 100 },
        { dateMs: day("2026-04-01"), value: 70 },
        { dateMs: day("2026-07-01"), value: 40 },
      ],
      day("2026-12-31"),
    );
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(10);
  });

  it("returns null when atDateMs is non-finite", () => {
    expect(
      linearRegressionPrediction(
        [
          { dateMs: day("2026-01-01"), value: 0 },
          { dateMs: day("2026-04-30"), value: 80 },
        ],
        Number.NaN,
      ),
    ).toBeNull();
  });
});

describe("linearRegressionSlope", () => {
  // §17.41 — slope-only public projection of `regressionFit`. Mirrors
  // the `linearRegressionPrediction` null-condition contract.

  it("returns null with fewer than 2 entries", () => {
    expect(linearRegressionSlope([])).toBeNull();
    expect(
      linearRegressionSlope([{ dateMs: day("2026-01-01"), value: 50 }]),
    ).toBeNull();
  });

  it("returns null when all entries share the same timestamp", () => {
    expect(
      linearRegressionSlope([
        { dateMs: day("2026-04-23"), value: 10 },
        { dateMs: day("2026-04-23"), value: 30 },
      ]),
    ).toBeNull();
  });

  it("recovers the line slope through two distinct entries", () => {
    // 80 units over 119 days ≈ 80 / (119·86400·1000) per ms.
    const slope = linearRegressionSlope([
      { dateMs: day("2026-01-01"), value: 0 },
      { dateMs: day("2026-04-30"), value: 80 },
    ]);
    expect(slope).not.toBeNull();
    const expected = 80 / (day("2026-04-30") - day("2026-01-01"));
    expect(slope!).toBeCloseTo(expected, 12);
  });

  it("returns 0 for a flat-trend BSC", () => {
    const slope = linearRegressionSlope([
      { dateMs: day("2026-01-01"), value: 50 },
      { dateMs: day("2026-04-30"), value: 50 },
      { dateMs: day("2026-06-30"), value: 50 },
    ]);
    expect(slope).not.toBeNull();
    expect(slope!).toBeCloseTo(0, 12);
  });

  it("returns a negative slope for a descending trend", () => {
    const slope = linearRegressionSlope([
      { dateMs: day("2026-01-01"), value: 100 },
      { dateMs: day("2026-04-01"), value: 70 },
      { dateMs: day("2026-07-01"), value: 40 },
    ]);
    expect(slope).not.toBeNull();
    expect(slope!).toBeLessThan(0);
  });
});

describe("progressRate", () => {
  // §17.41 — direction-agnostic normalised rate. `+1` = perfectly on
  // track to land at target by deadline.
  const firstDate = day("2026-01-01");
  const targetDate = day("2026-12-31");

  it("returns ~+1 for a perfectly on-track ascending objective", () => {
    // Target=100, min=0 by 2026-12-31. By halfway (2026-07-02) we are
    // at 50 — exactly the required rate. progressRate should be ~1.
    const rate = progressRate(
      [
        { dateMs: firstDate, value: 0 },
        { dateMs: day("2026-07-02"), value: 50 },
      ],
      0,
      100,
      targetDate,
    );
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(1, 1);
  });

  it("returns ~+2 for a metric progressing twice as fast as required", () => {
    // By halfway, we are at 100 (already at target).
    const rate = progressRate(
      [
        { dateMs: firstDate, value: 0 },
        { dateMs: day("2026-07-02"), value: 100 },
      ],
      0,
      100,
      targetDate,
    );
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(2, 1);
  });

  it("returns ~0 for a flat-trend metric", () => {
    const rate = progressRate(
      [
        { dateMs: firstDate, value: 50 },
        { dateMs: day("2026-04-30"), value: 50 },
        { dateMs: day("2026-07-02"), value: 50 },
      ],
      0,
      100,
      targetDate,
    );
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0, 6);
  });

  it("returns a negative rate for a regressing ascending metric", () => {
    // Target=100 ascending; values dropping.
    const rate = progressRate(
      [
        { dateMs: firstDate, value: 50 },
        { dateMs: day("2026-04-30"), value: 30 },
      ],
      0,
      100,
      targetDate,
    );
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0);
  });

  it("is direction-agnostic: a value dropping toward a descending target gives a POSITIVE rate", () => {
    // Target=20 (down from min=100). Value drops 100 → 50 by halfway —
    // that's progress = (100-50)/(100-20) = 0.625 fraction of the way
    // by half the timeline → rate ~1.25.
    const rate = progressRate(
      [
        { dateMs: firstDate, value: 100 },
        { dateMs: day("2026-07-02"), value: 50 },
      ],
      100,
      20,
      targetDate,
    );
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0);
    expect(rate!).toBeCloseTo(1.25, 1);
  });

  it("is direction-agnostic: a value RISING on a descending target gives a NEGATIVE rate", () => {
    // Target=20 (down from min=100). Value going up — moving AWAY.
    const rate = progressRate(
      [
        { dateMs: firstDate, value: 100 },
        { dateMs: day("2026-07-02"), value: 110 },
      ],
      100,
      20,
      targetDate,
    );
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0);
  });

  it("returns null with a single history entry", () => {
    expect(
      progressRate(
        [{ dateMs: firstDate, value: 0 }],
        0,
        100,
        targetDate,
      ),
    ).toBeNull();
  });

  it("returns null when min === target (degenerate objective)", () => {
    expect(
      progressRate(
        [
          { dateMs: firstDate, value: 50 },
          { dateMs: day("2026-04-30"), value: 50 },
        ],
        50,
        50,
        targetDate,
      ),
    ).toBeNull();
  });

  it("returns null when firstDate === targetDate (degenerate timeline)", () => {
    expect(
      progressRate(
        [
          { dateMs: targetDate, value: 0 },
          { dateMs: targetDate + 1000, value: 50 },
        ],
        0,
        100,
        targetDate,
      ),
    ).toBeNull();
  });

  it("returns null for non-finite endpoints", () => {
    expect(
      progressRate(
        [
          { dateMs: firstDate, value: 0 },
          { dateMs: day("2026-04-30"), value: 50 },
        ],
        Number.NaN,
        100,
        targetDate,
      ),
    ).toBeNull();
  });
});

describe("trendArrowFromRate", () => {
  // §17.41 — 5-bucket quantisation of progressRate.

  it("maps rate >= 1.5 to up", () => {
    expect(trendArrowFromRate(1.5)).toBe("up");
    expect(trendArrowFromRate(3)).toBe("up");
    expect(trendArrowFromRate(100)).toBe("up");
  });

  it("maps 0.5 <= rate < 1.5 (on-track band) to up-right", () => {
    expect(trendArrowFromRate(0.5)).toBe("up-right");
    expect(trendArrowFromRate(1)).toBe("up-right"); // exactly on track
    expect(trendArrowFromRate(1.49)).toBe("up-right");
  });

  it("maps -0.5 < rate < 0.5 (flat band) to right", () => {
    expect(trendArrowFromRate(-0.49)).toBe("right");
    expect(trendArrowFromRate(0)).toBe("right");
    expect(trendArrowFromRate(0.49)).toBe("right");
  });

  it("maps -1.5 <= rate <= -0.5 to down-right", () => {
    expect(trendArrowFromRate(-0.5)).toBe("down-right");
    expect(trendArrowFromRate(-1)).toBe("down-right");
    expect(trendArrowFromRate(-1.5)).toBe("down-right");
  });

  it("maps rate < -1.5 to down", () => {
    expect(trendArrowFromRate(-1.51)).toBe("down");
    expect(trendArrowFromRate(-3)).toBe("down");
    expect(trendArrowFromRate(-100)).toBe("down");
  });

  it("collapses NaN / non-finite to right defensively", () => {
    expect(trendArrowFromRate(Number.NaN)).toBe("right");
    expect(trendArrowFromRate(Number.POSITIVE_INFINITY)).toBe("right");
    expect(trendArrowFromRate(Number.NEGATIVE_INFINITY)).toBe("right");
  });
});

describe("deadlineShortfall", () => {
  // §17.44 — direction-agnostic *magnitude* of the deadline-risk
  // signal. Returns 0 when no warning fires, (0, 1] otherwise; the
  // mapper then feeds the value through `warningGradientColorAt` for
  // the §17.44 yellow → orange → red glyph tint.
  const targetDate = day("2026-12-31");
  const earlyMay = day("2026-05-02");

  it("is 0 when there are fewer than 2 distinct-time entries (no trend)", () => {
    expect(
      deadlineShortfall(
        [{ dateMs: day("2026-01-01"), value: 0 }],
        0,
        100,
        targetDate,
        earlyMay,
      ),
    ).toBe(0);
  });

  it("is positive when the historical trend extrapolates short of the target (ascending)", () => {
    // Slope ≈ 5/119 days; at +245 days from latest, predicted ≈ 5+10 = 15 < 100.
    // Shortfall ≈ 1 - 15/100 = 0.85.
    const shortfall = deadlineShortfall(
      [
        { dateMs: day("2026-01-01"), value: 0 },
        { dateMs: day("2026-04-30"), value: 5 },
      ],
      0,
      100,
      targetDate,
      earlyMay,
    );
    expect(shortfall).toBeGreaterThan(0);
    expect(shortfall).toBeLessThanOrEqual(1);
    expect(shortfall).toBeCloseTo(0.85, 1);
  });

  it("is 0 when the historical trend extrapolates beyond the target (ascending)", () => {
    // Slope ≈ 80/119 days; at +245 days, predicted ≈ 80 + 165 = 245 > 100
    expect(
      deadlineShortfall(
        [
          { dateMs: day("2026-01-01"), value: 0 },
          { dateMs: day("2026-04-30"), value: 80 },
        ],
        0,
        100,
        targetDate,
        earlyMay,
      ),
    ).toBe(0);
  });

  it("is positive for a descending objective whose trend doesn't drop fast enough", () => {
    // Target is 20 (down from 100). Trend is 100 → 95 over 4 months;
    // extrapolated to year-end the predicted is ~85 — still way above target.
    const shortfall = deadlineShortfall(
      [
        { dateMs: day("2026-01-01"), value: 100 },
        { dateMs: day("2026-04-30"), value: 95 },
      ],
      100,
      20,
      targetDate,
      earlyMay,
    );
    expect(shortfall).toBeGreaterThan(0);
    expect(shortfall).toBeLessThanOrEqual(1);
  });

  it("is 0 for a descending objective whose trend drops past the target", () => {
    // Target is 20 (down from 100). Trend 100 → 60 in 4 months;
    // extrapolated to year-end ≈ -20 — well past target.
    expect(
      deadlineShortfall(
        [
          { dateMs: day("2026-01-01"), value: 100 },
          { dateMs: day("2026-04-30"), value: 60 },
        ],
        100,
        20,
        targetDate,
        earlyMay,
      ),
    ).toBe(0);
  });

  it("is positive for an overachiever whose trend reverses past the target (operator opted-in)", () => {
    // Currently at 130 (overachiever, target=100), but trend 130 → 110
    // over 4 months ⇒ extrapolated to year-end ≈ 60 — falls back below target.
    // §17.40 / §17.44 decision: we still check the trend, so this fires
    // a warning.
    const shortfall = deadlineShortfall(
      [
        { dateMs: day("2026-01-01"), value: 130 },
        { dateMs: day("2026-04-30"), value: 110 },
      ],
      0,
      100,
      targetDate,
      earlyMay,
    );
    expect(shortfall).toBeGreaterThan(0);
  });

  it("is 0 once the deadline has passed", () => {
    const afterDeadline = day("2027-03-01");
    expect(
      deadlineShortfall(
        [
          { dateMs: day("2026-01-01"), value: 0 },
          { dateMs: day("2026-04-30"), value: 5 },
        ],
        0,
        100,
        targetDate,
        afterDeadline,
      ),
    ).toBe(0);
  });

  it("is 0 for malformed inputs (NaN target / now / min)", () => {
    expect(
      deadlineShortfall(
        [
          { dateMs: day("2026-01-01"), value: 0 },
          { dateMs: day("2026-04-30"), value: 5 },
        ],
        Number.NaN,
        100,
        targetDate,
        earlyMay,
      ),
    ).toBe(0);
  });

  it("saturates at 1 when the trend extrapolates past min in the wrong direction", () => {
    // Strongly regressing history (50 → 30 over ~4 months on an
    // ascending 0→100 objective). Slope ≈ -20/119d; extrapolated to
    // year-end the predicted lands well below min (0).
    // `gradientPositionFraction` clamps to 0 → shortfall = 1 (full
    // red end of the §17.44 ramp).
    const shortfall = deadlineShortfall(
      [
        { dateMs: day("2026-01-01"), value: 50 },
        { dateMs: day("2026-04-30"), value: 30 },
      ],
      0,
      100,
      targetDate,
      earlyMay,
    );
    expect(shortfall).toBe(1);
  });
});

describe("gradientColorAt", () => {
  // §17.40 — four-stop ramp red → orange → yellow → green. Pinning
  // the endpoints + the named stops keeps the visual contract under
  // version control; intermediate values exercise the linear interp.
  it("returns bright red at 0", () => {
    expect(gradientColorAt(0)).toBe("rgb(220, 38, 38)");
  });
  it("returns bright orange at 1/3", () => {
    expect(gradientColorAt(1 / 3)).toBe("rgb(234, 88, 12)");
  });
  it("returns bright yellow at 2/3", () => {
    expect(gradientColorAt(2 / 3)).toBe("rgb(250, 204, 21)");
  });
  it("returns bright green at 1", () => {
    expect(gradientColorAt(1)).toBe("rgb(22, 163, 74)");
  });
  it("clamps below 0 to red", () => {
    expect(gradientColorAt(-0.5)).toBe("rgb(220, 38, 38)");
  });
  it("clamps above 1 to green", () => {
    expect(gradientColorAt(1.5)).toBe("rgb(22, 163, 74)");
  });
  it("interpolates between red and orange at 1/6", () => {
    // Halfway between [220,38,38] and [234,88,12] → roughly
    // [227, 63, 25]; round-to-nearest rules give exact integers.
    const out = gradientColorAt(1 / 6);
    expect(out).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    const match = out.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
    expect(match).not.toBeNull();
    const [, r, g, b] = match!;
    expect(Number(r)).toBeGreaterThan(220);
    expect(Number(r)).toBeLessThan(234);
    expect(Number(g)).toBeGreaterThan(38);
    expect(Number(g)).toBeLessThan(88);
    expect(Number(b)).toBeGreaterThan(12);
    expect(Number(b)).toBeLessThan(38);
  });
});

describe("warningGradientColorAt", () => {
  // §17.44 — three-stop ramp yellow → orange → red keyed to the
  // deadline-shortfall magnitude. Pinning the endpoints + the named
  // stop keeps the "lowest deviation = yellow, highest = red" visual
  // contract under version control.

  it("returns empty string for 0 (no warning to render)", () => {
    expect(warningGradientColorAt(0)).toBe("");
  });

  it("returns empty string for negative inputs (defensive)", () => {
    expect(warningGradientColorAt(-0.1)).toBe("");
    expect(warningGradientColorAt(-1)).toBe("");
  });

  it("returns empty string for NaN / non-finite inputs (defensive)", () => {
    expect(warningGradientColorAt(Number.NaN)).toBe("");
    expect(warningGradientColorAt(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("returns bright yellow at the lowest positive deviation (just above 0)", () => {
    // The yellow stop sits at f=0; an arbitrarily small positive
    // shortfall reads as the yellow endpoint after RGB lerp from
    // (yellow → orange, t≈0).
    expect(warningGradientColorAt(0.0001)).toBe("rgb(250, 204, 21)");
  });

  it("returns bright orange at 0.5", () => {
    expect(warningGradientColorAt(0.5)).toBe("rgb(234, 88, 12)");
  });

  it("returns bright red at 1 (highest deviation)", () => {
    expect(warningGradientColorAt(1)).toBe("rgb(220, 38, 38)");
  });

  it("clamps above 1 to red (defensive saturation)", () => {
    expect(warningGradientColorAt(1.5)).toBe("rgb(220, 38, 38)");
    expect(warningGradientColorAt(100)).toBe("rgb(220, 38, 38)");
  });

  it("interpolates between yellow and orange at 0.25", () => {
    // Halfway between [250,204,21] (yellow) and [234,88,12] (orange).
    const out = warningGradientColorAt(0.25);
    expect(out).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    const match = out.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
    expect(match).not.toBeNull();
    const [, r, g, b] = match!;
    // Yellow → orange: red channel decreases, green decreases sharply,
    // blue decreases slightly.
    expect(Number(r)).toBeLessThanOrEqual(250);
    expect(Number(r)).toBeGreaterThan(234);
    expect(Number(g)).toBeLessThan(204);
    expect(Number(g)).toBeGreaterThan(88);
    expect(Number(b)).toBeLessThan(21);
    expect(Number(b)).toBeGreaterThanOrEqual(12);
  });

  it("interpolates between orange and red at 0.75", () => {
    const out = warningGradientColorAt(0.75);
    const match = out.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
    expect(match).not.toBeNull();
    const [, r, g, b] = match!;
    // Orange → red: red channel decreases, green decreases, blue
    // increases slightly.
    expect(Number(r)).toBeGreaterThan(220);
    expect(Number(r)).toBeLessThan(234);
    expect(Number(g)).toBeGreaterThanOrEqual(38);
    expect(Number(g)).toBeLessThan(88);
    expect(Number(b)).toBeGreaterThanOrEqual(12);
    expect(Number(b)).toBeLessThanOrEqual(38);
  });
});
