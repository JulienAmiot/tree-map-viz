import { describe, expect, it } from "vitest";

import { formatTargetDate } from "../../../../../adapters/ui/atoms/targetDateFormat.js";

describe("formatTargetDate (\u00a717.142f)", () => {
  it("formats a midnight-UTC ISO as `D MMM YYYY`", () => {
    expect(formatTargetDate("2026-04-23T00:00:00.000Z")).toBe("23 Apr 2026");
  });

  it("uses UTC accessors so a midnight-UTC ISO doesn't flip to the previous day on UTC-positive hosts", () => {
    expect(formatTargetDate("2027-01-07T00:00:00.000Z")).toBe("7 Jan 2027");
    expect(formatTargetDate("2027-01-07T23:59:59.000Z")).toBe("7 Jan 2027");
  });

  it("covers every short month label in the lookup table", () => {
    const months = [
      ["2027-01-15", "Jan"], ["2027-02-15", "Feb"], ["2027-03-15", "Mar"],
      ["2027-04-15", "Apr"], ["2027-05-15", "May"], ["2027-06-15", "Jun"],
      ["2027-07-15", "Jul"], ["2027-08-15", "Aug"], ["2027-09-15", "Sep"],
      ["2027-10-15", "Oct"], ["2027-11-15", "Nov"], ["2027-12-15", "Dec"],
    ] as const;
    for (const [iso, label] of months) {
      expect(formatTargetDate(`${iso}T00:00:00.000Z`)).toBe(`15 ${label} 2027`);
    }
  });

  it("returns the raw ISO unchanged when parsing fails (defensive)", () => {
    expect(formatTargetDate("not-a-date")).toBe("not-a-date");
  });
});
