import { describe, expect, it } from "vitest";

import {
  ageInDays,
  dateAgeColor,
  MAX_AGE_DAYS,
} from "../../../../../adapters/ui/views/dateAgeColor.js";

const now = new Date("2026-04-30T12:00:00.000Z");

function isoDaysAgo(days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
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

describe("dateAgeColor (\u00a717.18)", () => {
  it("returns warm orange for today (t = 0)", () => {
    // Endpoint colour is rgb(255, 145, 50).
    expect(dateAgeColor(now.toISOString(), now)).toBe("rgb(255, 145, 50)");
  });

  it("returns cold pale blue at MAX_AGE_DAYS (t = 1)", () => {
    expect(dateAgeColor(isoDaysAgo(MAX_AGE_DAYS), now)).toBe("rgb(140, 180, 220)");
  });

  it("clamps beyond MAX_AGE_DAYS to the cold endpoint (older = same blue)", () => {
    expect(dateAgeColor(isoDaysAgo(MAX_AGE_DAYS * 5), now)).toBe(
      "rgb(140, 180, 220)",
    );
  });

  it("interpolates monotonically — older dates trend bluer (lower R, higher B)", () => {
    const fresh = parseRgb(dateAgeColor(isoDaysAgo(0), now));
    const mid = parseRgb(dateAgeColor(isoDaysAgo(MAX_AGE_DAYS / 2), now));
    const old = parseRgb(dateAgeColor(isoDaysAgo(MAX_AGE_DAYS), now));

    expect(fresh.r).toBeGreaterThan(mid.r);
    expect(mid.r).toBeGreaterThan(old.r);
    expect(fresh.b).toBeLessThan(mid.b);
    expect(mid.b).toBeLessThan(old.b);
  });

  it("falls back to currentColor for empty / unparseable input (defensive)", () => {
    expect(dateAgeColor("", now)).toBe("currentColor");
    expect(dateAgeColor("nope", now)).toBe("currentColor");
  });
});

function parseRgb(s: string): { r: number; g: number; b: number } {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s);
  if (!m) throw new Error(`unexpected colour string: ${s}`);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}
