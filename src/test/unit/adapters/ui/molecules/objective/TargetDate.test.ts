import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/molecules/objective/TargetDate.js";
import {
  formatTargetDate,
} from "../../../../../../adapters/ui/molecules/objective/TargetDate.js";
import type { TargetDateCell } from "../../../../../../adapters/ui/molecules/objective/TargetDate.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

async function mount(dateIso: string): Promise<TargetDateCell> {
  return mountLitElement<TargetDateCell>("target-date-cell", (e) => {
    e.dateIso = dateIso;
  });
}

describe("<target-date-cell> (\u00a717.137 A1)", () => {
  it("renders a <time> with the `D MMM YYYY` format + the raw ISO in `datetime`", async () => {
    const el = await mount("2026-04-23T00:00:00.000Z");
    const time = el.shadowRoot?.querySelector<HTMLTimeElement>(
      '[data-testid="target-date"]',
    );
    expect(time?.tagName).toBe("TIME");
    expect(time?.getAttribute("datetime")).toBe("2026-04-23T00:00:00.000Z");
    expect(time?.textContent?.trim()).toBe("23 Apr 2026");
  });

  it("renders nothing when `dateIso` is empty (no-deadline branch)", async () => {
    const el = await mount("");
    expect(
      el.shadowRoot?.querySelector('[data-testid="target-date"]'),
    ).toBeNull();
  });

  it("re-renders when `dateIso` is updated (reactive @property)", async () => {
    const el = await mount("2026-01-07T00:00:00.000Z");
    expect(
      el.shadowRoot
        ?.querySelector('[data-testid="target-date"]')
        ?.textContent?.trim(),
    ).toBe("7 Jan 2026");
    el.dateIso = "2027-12-31T00:00:00.000Z";
    await el.updateComplete;
    expect(
      el.shadowRoot
        ?.querySelector('[data-testid="target-date"]')
        ?.textContent?.trim(),
    ).toBe("31 Dec 2027");
  });

  it("uses UTC accessors so a midnight-UTC ISO doesn't flip to the previous day on UTC-positive hosts", () => {
    expect(formatTargetDate("2027-01-07T00:00:00.000Z")).toBe("7 Jan 2027");
    expect(formatTargetDate("2027-01-07T23:59:59.000Z")).toBe("7 Jan 2027");
  });

  it("returns the raw ISO unchanged when parsing fails (defensive)", () => {
    expect(formatTargetDate("not-a-date")).toBe("not-a-date");
  });
});
