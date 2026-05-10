// SPEC §17.84 — assert SHAPE of the Vite-injected constants, not values
// (pinning literals would force this test to update on every Y/Z bump).

import { describe, expect, it } from "vitest";

import { APP_VERSION, BUILD_DATE } from "../../version.js";

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
