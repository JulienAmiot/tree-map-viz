import { describe, expect, it } from "vitest";

import {
  ageInDays,
  dateAgeColor,
  DEFAULT_FRESH_COLOR,
  desaturatedCounterpart,
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

describe("dateAgeColor — back-compat with \u00a717.18 default fresh colour", () => {
  it("DEFAULT_FRESH_COLOR is the warm orange \u00a717.18 originally pinned", () => {
    expect(DEFAULT_FRESH_COLOR).toBe("rgb(255, 145, 50)");
  });

  it("returns the default fresh colour at t = 0 when no freshColor is passed", () => {
    expect(dateAgeColor(now.toISOString(), { now })).toBe(
      "rgb(255, 145, 50)",
    );
  });

  it("clamps beyond MAX_AGE_DAYS to the cold endpoint", () => {
    const farPast = dateAgeColor(isoDaysAgo(MAX_AGE_DAYS * 5), { now });
    const atMax = dateAgeColor(isoDaysAgo(MAX_AGE_DAYS), { now });
    expect(farPast).toBe(atMax);
  });

  it("interpolates monotonically — older = closer to the desaturated endpoint", () => {
    const fresh = parseRgb(dateAgeColor(isoDaysAgo(0), { now }));
    const old = parseRgb(dateAgeColor(isoDaysAgo(MAX_AGE_DAYS), { now }));
    const mid = parseRgb(dateAgeColor(isoDaysAgo(MAX_AGE_DAYS / 2), { now }));
    // Each channel sits between the two endpoints.
    for (const ch of ["r", "g", "b"] as const) {
      const lo = Math.min(fresh[ch], old[ch]);
      const hi = Math.max(fresh[ch], old[ch]);
      expect(mid[ch]).toBeGreaterThanOrEqual(lo);
      expect(mid[ch]).toBeLessThanOrEqual(hi);
    }
  });

  it("falls back to currentColor for empty / unparseable input (defensive)", () => {
    expect(dateAgeColor("", { now })).toBe("currentColor");
    expect(dateAgeColor("nope", { now })).toBe("currentColor");
  });
});

describe("dateAgeColor — \u00a717.21 board-level fresh colour + dynamic desaturation", () => {
  it("uses the caller-supplied fresh colour at t = 0 (hex)", () => {
    expect(
      dateAgeColor(now.toISOString(), { now, freshColor: "#1ea76a" }),
    ).toBe("rgb(30, 167, 106)");
  });

  it("accepts the rgb() string format too", () => {
    expect(
      dateAgeColor(now.toISOString(), {
        now,
        freshColor: "rgb(30, 167, 106)",
      }),
    ).toBe("rgb(30, 167, 106)");
  });

  it("falls back to the default fresh colour for unparseable freshColor input", () => {
    expect(
      dateAgeColor(now.toISOString(), { now, freshColor: "tomato-soup" }),
    ).toBe("rgb(255, 145, 50)");
  });

  it("at MAX_AGE_DAYS, the colour is a very desaturated version of the same hue", () => {
    // For a green fresh colour, the cold endpoint is a green-leaning grey.
    const cold = parseRgb(
      dateAgeColor(isoDaysAgo(MAX_AGE_DAYS), {
        now,
        freshColor: "#1ea76a",
      }),
    );
    // Channels are very close together (desaturated).
    const max = Math.max(cold.r, cold.g, cold.b);
    const min = Math.min(cold.r, cold.g, cold.b);
    expect(max - min).toBeLessThanOrEqual(20);
    // The hue tilt is preserved: green is the dominant channel.
    expect(cold.g).toBeGreaterThanOrEqual(cold.r);
    expect(cold.g).toBeGreaterThanOrEqual(cold.b);
  });

  it("the cold endpoint of the gradient equals desaturatedCounterpart(freshColor)", () => {
    const cold = dateAgeColor(isoDaysAgo(MAX_AGE_DAYS), {
      now,
      freshColor: "#1ea76a",
    });
    expect(cold).toBe(desaturatedCounterpart("#1ea76a"));
  });

  it("desaturatedCounterpart preserves hue across the colour wheel", () => {
    // Each fresh colour's desaturated counterpart keeps the
    // dominant-channel ordering of the input.
    const cases: { fresh: string; bigger: "r" | "g" | "b" }[] = [
      { fresh: "#ff5050", bigger: "r" },
      { fresh: "#50ff50", bigger: "g" },
      { fresh: "#5050ff", bigger: "b" },
    ];
    for (const c of cases) {
      const cold = parseRgb(desaturatedCounterpart(c.fresh));
      const channels: Record<"r" | "g" | "b", number> = {
        r: cold.r,
        g: cold.g,
        b: cold.b,
      };
      const dominant = (Object.keys(channels) as ("r" | "g" | "b")[]).reduce(
        (best, k) => (channels[k] > channels[best] ? k : best),
        "r" as "r" | "g" | "b",
      );
      expect(dominant).toBe(c.bigger);
    }
  });
});

function parseRgb(s: string): { r: number; g: number; b: number } {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s);
  if (!m) throw new Error(`unexpected colour string: ${s}`);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}
