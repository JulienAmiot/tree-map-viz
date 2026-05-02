import { describe, expect, it } from "vitest";

import {
  ageInDays,
  dateAgeColor,
  FRESH_RGB,
  MAX_AGE_DAYS,
  STALE_RGB,
} from "../../../../../adapters/ui/views/dateAgeColor.js";

const now = new Date("2026-04-30T12:00:00.000Z");

function isoDaysAgo(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function parseRgb(s: string): { r: number; g: number; b: number } {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s);
  if (!m) throw new Error(`unexpected colour string: ${s}`);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

describe("ageInDays (\u00a717.18)", () => {
  it("returns 0 for the present", () => {
    expect(ageInDays(now.toISOString(), now)).toBe(0);
  });

  it("returns days for past dates", () => {
    expect(ageInDays(isoDaysAgo(7), now)).toBeCloseTo(7, 5);
    expect(ageInDays(isoDaysAgo(180), now)).toBeCloseTo(180, 5);
  });

  it("clamps future dates to 0 (a freshly scheduled measurement is fresh)", () => {
    const future = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(ageInDays(future, now)).toBe(0);
  });

  it("returns null for unparseable / empty input", () => {
    expect(ageInDays("", now)).toBeNull();
    expect(ageInDays("not a date", now)).toBeNull();
  });
});

describe("dateAgeColor — \u00a717.42 fixed white \u2192 dark-grey gradient", () => {
  // §17.42 retired the per-board fresh-colour the §17.21 / §17.31
  // design carried (no more Board.freshDateColor / --board-fresh /
  // colour picker on <board-settings-modal>). The helper is now a
  // pure function of `iso` + optional `now`, with both endpoints
  // hard-coded.

  it("FRESH_RGB and STALE_RGB are the operator-pinned endpoints", () => {
    expect(FRESH_RGB).toEqual({ r: 245, g: 245, b: 245 });
    expect(STALE_RGB).toEqual({ r: 64, g: 64, b: 64 });
  });

  it("returns the bright off-white at age = 0", () => {
    expect(dateAgeColor(now.toISOString(), { now })).toBe("rgb(245, 245, 245)");
  });

  it("returns the dark-grey at age = MAX_AGE_DAYS", () => {
    expect(dateAgeColor(isoDaysAgo(MAX_AGE_DAYS), { now })).toBe(
      "rgb(64, 64, 64)",
    );
  });

  it("clamps beyond MAX_AGE_DAYS to the dark-grey endpoint", () => {
    const farPast = dateAgeColor(isoDaysAgo(MAX_AGE_DAYS * 5), { now });
    const atMax = dateAgeColor(isoDaysAgo(MAX_AGE_DAYS), { now });
    expect(farPast).toBe(atMax);
    expect(farPast).toBe("rgb(64, 64, 64)");
  });

  it("interpolates linearly across MAX_AGE_DAYS, achromatic at every step", () => {
    // The endpoints are both grey (R = G = B), so the lerp at any
    // intermediate fraction also produces an achromatic colour. The
    // §17.21 hue-preserving design retired in §17.42 because the
    // monochrome dark theme already gives the timestamp enough
    // visual weight without per-board hue.
    const stops = [0, 0.25, 0.5, 0.75, 1];
    for (const t of stops) {
      const days = t * MAX_AGE_DAYS;
      const colour = parseRgb(dateAgeColor(isoDaysAgo(days), { now }));
      expect(colour.r).toBe(colour.g);
      expect(colour.r).toBe(colour.b);
      // Channel monotonically decreases as days grows.
      const expected = Math.round(245 + (64 - 245) * t);
      expect(Math.abs(colour.r - expected)).toBeLessThanOrEqual(1);
    }
  });

  it("the midpoint sits halfway between the two endpoints (within rounding)", () => {
    const mid = parseRgb(dateAgeColor(isoDaysAgo(MAX_AGE_DAYS / 2), { now }));
    // 245 + (64 - 245)/2 = 245 - 90.5 = 154.5 ⇒ 154 or 155.
    expect(mid.r).toBeGreaterThanOrEqual(154);
    expect(mid.r).toBeLessThanOrEqual(155);
    expect(mid.g).toBe(mid.r);
    expect(mid.b).toBe(mid.r);
  });

  it("falls back to currentColor for empty / unparseable input (defensive)", () => {
    expect(dateAgeColor("", { now })).toBe("currentColor");
    expect(dateAgeColor("nope", { now })).toBe("currentColor");
  });
});
