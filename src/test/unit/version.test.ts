// SPEC §17.84 — assert SHAPE of the Vite-injected constants, not values
// (pinning literals would force this test to update on every Y/Z bump).
// §17.86 — adds shape + helper tests for `parseMajor` / `APP_MAJOR`.

import { describe, expect, it } from "vitest";

import { APP_MAJOR, APP_VERSION, BUILD_DATE, parseMajor } from "../../version.js";

describe("version module (\u00a717.84)", () => {
  it("APP_VERSION is a non-empty string", () => {
    expect(typeof APP_VERSION).toBe("string");
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });

  it("APP_VERSION starts with a SemVer MAJOR.MINOR.PATCH triple", () => {
    expect(APP_VERSION).toMatch(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+].*)?$/,
    );
  });

  it("APP_VERSION's major (X) component is a parseable integer", () => {
    const major = APP_VERSION.split(".")[0];
    expect(major).toBeDefined();
    expect(Number.isInteger(Number(major))).toBe(true);
    expect(Number(major)).toBeGreaterThanOrEqual(0);
  });

  it("BUILD_DATE is an ISO calendar date and parses as a valid Date", () => {
    expect(BUILD_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isFinite(Date.parse(BUILD_DATE))).toBe(true);
  });
});

describe("parseMajor / APP_MAJOR (\u00a717.86)", () => {
  it("parseMajor extracts the leading integer of a SemVer triple", () => {
    expect(parseMajor("0.1.0")).toBe(0);
    expect(parseMajor("1.2.3")).toBe(1);
    expect(parseMajor("12.34.56")).toBe(12);
  });

  it("parseMajor throws on a malformed input", () => {
    expect(() => parseMajor("not-a-version")).toThrow(/parseMajor/);
    expect(() => parseMajor("1.2")).toThrow(/parseMajor/);
    expect(() => parseMajor("")).toThrow(/parseMajor/);
  });

  it("APP_MAJOR equals the parsed major of APP_VERSION", () => {
    expect(APP_MAJOR).toBe(parseMajor(APP_VERSION));
    expect(Number.isInteger(APP_MAJOR)).toBe(true);
    expect(APP_MAJOR).toBeGreaterThanOrEqual(0);
  });
});
