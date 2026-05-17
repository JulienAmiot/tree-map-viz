/**
 * SPEC §17.116 — coverage for the bottom-right age formatter
 * (`formatAge`). The helper walks the calendar one component at a
 * time (years → months → days) so anniversaries land on the right
 * label rather than drifting into "364 days" / "1 year 12 days".
 */

import { describe, expect, it } from "vitest";

import { formatAge } from "../../../../../adapters/ui/views/ageFormat.js";

const NOW = new Date("2026-05-17T12:00:00.000Z");

describe("formatAge (\u00a717.116)", () => {
  it("returns 'today' for same-day timestamps (zero everything)", () => {
    expect(formatAge("2026-05-17T08:00:00.000Z", NOW)).toBe("today");
  });

  it("returns 'today' for future-dated inputs (defensive — kiosk clock skew)", () => {
    expect(formatAge("2027-01-01T00:00:00.000Z", NOW)).toBe("today");
  });

  it("returns 'today' for unparseable ISO inputs (defensive)", () => {
    expect(formatAge("not-a-date", NOW)).toBe("today");
  });

  it("singular vs plural day suffix (1 day / 5 days)", () => {
    expect(formatAge("2026-05-16T12:00:00.000Z", NOW)).toBe("1 day");
    expect(formatAge("2026-05-12T12:00:00.000Z", NOW)).toBe("5 days");
  });

  it("renders months exactly without surfacing a 0 days component", () => {
    expect(formatAge("2026-04-17T12:00:00.000Z", NOW)).toBe("1 month");
    expect(formatAge("2026-02-17T12:00:00.000Z", NOW)).toBe("3 months");
  });

  it("renders combined month + day phrases (3 months 5 days)", () => {
    expect(formatAge("2026-02-12T12:00:00.000Z", NOW)).toBe("3 months 5 days");
  });

  it("renders years exactly without surfacing 0 months 0 days components", () => {
    expect(formatAge("2025-05-17T12:00:00.000Z", NOW)).toBe("1 year");
    expect(formatAge("2024-05-17T12:00:00.000Z", NOW)).toBe("2 years");
  });

  it("renders combined year + month + day phrases, dropping any zero component", () => {
    // 1y exactly minus 5 days → 11 months 12 days against 2026-05-17 NOW (May → June +12 borrow)
    expect(formatAge("2024-02-12T12:00:00.000Z", NOW)).toBe("2 years 3 months 5 days");
    // 1y 0m 5d → "1 year 5 days" (months dropped)
    expect(formatAge("2025-05-12T12:00:00.000Z", NOW)).toBe("1 year 5 days");
    // 1y 6m 0d → "1 year 6 months"
    expect(formatAge("2024-11-17T12:00:00.000Z", NOW)).toBe("1 year 6 months");
  });

  it("borrows correctly across month-length boundaries (Feb → Mar 31)", () => {
    // From 2026-02-28 to 2026-03-01 = 1 day (Feb has 28 days in 2026, non-leap)
    const marchFirst = new Date("2026-03-01T12:00:00.000Z");
    expect(formatAge("2026-02-28T12:00:00.000Z", marchFirst)).toBe("1 day");
  });
});
