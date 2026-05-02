import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsChild.js";
import type { BusinessScoreCardNodeAsChild } from "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsChild.js";
import type { BusinessScoreCardNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function makeVm(
  value: BusinessScoreCardNodeViewModel["value"],
  dateIso?: string,
  objectiveOverride: Partial<BusinessScoreCardNodeViewModel["objective"]> = {},
): BusinessScoreCardNodeViewModel {
  // SPEC §17.18 — see sibling `AsParent.test.ts` for the rationale.
  const resolvedDateIso =
    dateIso ?? (value.kind === "recordedValue" ? value.dateIso : "");
  return {
    kind: "BusinessScoreCardNode",
    id: "bsc-c",
    title: "Sales",
    description: "Region",
    value,
    dateIso: resolvedDateIso,
    // SPEC §17.21 — pin a representative dateColor since tests
    // fabricate VMs directly without going through the mapper. Empty
    // dateIso → empty dateColor (mirrors mapper behaviour).
    dateColor: resolvedDateIso ? "rgb(255, 145, 50)" : "",
    // SPEC §17.40 / §17.41 — default objective shape; tests can
    // override individual fields via the `objectiveOverride` arg. The
    // default has no trend arrow (matches the §17.41 silent-on-
    // insufficient-data policy: a fabricated VM with no history pin
    // should NOT trigger an arrow).
    objective: {
      targetValue: 100,
      targetDateIso: "2026-12-31T00:00:00.000Z",
      unit: value.kind === "childrenCount" ? "" : value.unit,
      valueColor: "",
      warningColor: "",
      trendArrow: null,
      ...objectiveOverride,
    },
  };
}

describe("<business-score-card-as-child>", () => {
  it("renders Σ for computed values, same as AsParent (\u00a75 — uniform fields across roles)", async () => {
    const vm = makeVm({ kind: "computedMean", mean: 50, unit: "%" });
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    expect(
      el.shadowRoot
        ?.querySelector('[data-testid="value"]')
        ?.textContent?.replace(/\s+/g, " ")
        .trim(),
    ).toBe("50.0 %");
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).not.toBeNull();
  });

  it("does not render Σ for recordedValue, but does render the corner timestamp with --age-color (\u00a717.18)", async () => {
    const vm = makeVm({
      kind: "recordedValue",
      value: 50,
      unit: "%",
      dateIso: "2026-04-23T18:25:43.511Z",
    });
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
    const ts = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value-date"]');
    expect(ts).not.toBeNull();
    expect(ts?.classList.contains("timestamp")).toBe(true);
    expect(ts?.getAttribute("style") ?? "").toMatch(/--age-color:\s*rgb\(/);
  });

  it('renders "5 children" for childrenCount > 0 (no Σ, no Unit, no timestamp)', async () => {
    const vm = makeVm({ kind: "childrenCount", n: 5 });
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    expect(
      el.shadowRoot?.querySelector('[data-testid="value"]')?.textContent?.trim(),
    ).toBe("5 children");
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  it("renders empty value area for childrenCount = 0", async () => {
    const vm = makeVm({ kind: "childrenCount", n: 0 });
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    expect(value?.textContent?.trim()).toBe("");
    expect(value?.getAttribute("data-value-kind")).toBe("childrenCount-empty");
  });

  // -- SPEC §17.40 ----------------------------------------------------

  it("\u00a717.40 — applies the gradient valueColor to .value via --bsc-value-color", async () => {
    const vm = makeVm(
      {
        kind: "recordedValue",
        value: 50,
        unit: "%",
        dateIso: "2026-04-23T18:25:43.511Z",
      },
      undefined,
      { valueColor: "rgb(250, 204, 21)" },
    );
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="value"]',
    );
    expect(value).not.toBeNull();
    expect(value?.getAttribute("style") ?? "").toContain(
      "--bsc-value-color: rgb(250, 204, 21)",
    );
  });

  it("\u00a717.40 — renders the target row with target value, unit, date, and bullseye icon", async () => {
    const vm = makeVm(
      {
        kind: "recordedValue",
        value: 50,
        unit: "%",
        dateIso: "2026-04-23T18:25:43.511Z",
      },
      undefined,
      { targetValue: 80, targetDateIso: "2026-12-31T00:00:00.000Z", unit: "%" },
    );
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    const row = el.shadowRoot?.querySelector('[data-testid="target-row"]');
    expect(row).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="target-icon"]'),
    ).not.toBeNull();
    const text = el.shadowRoot
      ?.querySelector('[data-testid="target-text"]')
      ?.textContent?.replace(/\s+/g, " ")
      .trim();
    expect(text).toBe("80 %");
    const date = el.shadowRoot?.querySelector(
      '[data-testid="target-date"]',
    );
    expect(date).not.toBeNull();
    expect(date?.getAttribute("datetime")).toBe("2026-12-31T00:00:00.000Z");
  });

  it("\u00a717.40 — does not render the target row for empty childrenCount n=0", async () => {
    const vm = makeVm({ kind: "childrenCount", n: 0 });
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="target-row"]'),
    ).toBeNull();
  });

  it("\u00a717.44 — renders the deadline-risk warning glyph inside the target row, after the target date, tinted by warningColor", async () => {
    const vm = makeVm(
      {
        kind: "recordedValue",
        value: 10,
        unit: "%",
        dateIso: "2026-07-02T00:00:00.000Z",
      },
      undefined,
      { warningColor: "rgb(220, 38, 38)" },
    );
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    const row = el.shadowRoot?.querySelector('[data-testid="target-row"]');
    expect(row).not.toBeNull();
    const warn = row?.querySelector<HTMLElement>(
      '[data-testid="off-track-warning"]',
    );
    // §17.44 — the warning lives INSIDE the target row, not at the
    // tile's bottom-left.
    expect(warn).not.toBeNull();
    // §17.44 — inline color tints the glyph on the
    // yellow → orange → red deviation ramp; the CSS fallback
    // (currentColor) is overridden per-element.
    expect(warn?.getAttribute("style") ?? "").toMatch(
      /\bcolor:\s*rgb\(220,\s*38,\s*38\)/,
    );
    expect(warn?.getAttribute("aria-label")?.toLowerCase()).toContain(
      "deadline",
    );
    // §17.44 — sits AFTER the target date in DOM order.
    const date = row?.querySelector('[data-testid="target-date"]');
    expect(date).not.toBeNull();
    expect(
      date!.compareDocumentPosition(warn!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("\u00a717.44 — does not render the warning glyph when warningColor is empty", async () => {
    const vm = makeVm(
      {
        kind: "recordedValue",
        value: 90,
        unit: "%",
        dateIso: "2026-07-02T00:00:00.000Z",
      },
      undefined,
      { warningColor: "" },
    );
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="off-track-warning"]'),
    ).toBeNull();
  });

  it("\u00a717.41 — renders the trend arrow next to the value when objective.trendArrow is set, with the bucket exposed as data-direction and a monochrome glyph", async () => {
    // Pin trendArrow="up-right" (on-or-near-track bucket) and assert
    // the rendered glyph + data-direction + aria-label match the
    // §17.41 mapping. The arrow must be a direct child of the
    // .value-row sibling that wraps the .value -- the same structure
    // every per-view emits so the trend arrow lands visually next
    // to the figure rather than below it.
    const vm = makeVm(
      {
        kind: "recordedValue",
        value: 50,
        unit: "%",
        dateIso: "2026-07-02T00:00:00.000Z",
      },
      undefined,
      { trendArrow: "up-right" },
    );
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    const arrow = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="trend-arrow"]',
    );
    expect(arrow).not.toBeNull();
    expect(arrow!.getAttribute("data-direction")).toBe("up-right");
    expect(arrow!.textContent?.trim()).toBe("\u2197");
    expect(arrow!.getAttribute("aria-label")?.toLowerCase()).toContain(
      "on or near schedule",
    );
    // §17.41 colour policy -- arrow is monochrome (currentColor); no
    // inline `color:` and no `--bsc-value-color` plumbing.
    expect(arrow!.getAttribute("style") ?? "").toBe("");
    // The arrow lives inside the value-row wrapper so it sits
    // horizontally next to the value (not below it in the column-
    // flex value-area).
    expect(arrow!.parentElement?.classList.contains("value-row")).toBe(true);
  });

  it.each([
    ["up", "\u2191", "well ahead"],
    ["right", "\u2192", "flat"],
    ["down-right", "\u2198", "slight regression"],
    ["down", "\u2193", "significant regression"],
  ] as const)(
    "\u00a717.41 — direction %s renders glyph %s with a meaningful aria-label",
    async (direction, glyph, labelFragment) => {
      const vm = makeVm(
        {
          kind: "recordedValue",
          value: 42,
          unit: "%",
          dateIso: "2026-07-02T00:00:00.000Z",
        },
        undefined,
        { trendArrow: direction },
      );
      const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
        "business-score-card-as-child",
        (e) => {
          e.vm = vm;
        },
      );
      const arrow = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="trend-arrow"]',
      );
      expect(arrow).not.toBeNull();
      expect(arrow!.getAttribute("data-direction")).toBe(direction);
      expect(arrow!.textContent?.trim()).toBe(glyph);
      expect(arrow!.getAttribute("aria-label")?.toLowerCase()).toContain(
        labelFragment,
      );
    },
  );

  it("\u00a717.41 — does NOT render a trend arrow when objective.trendArrow is null (insufficient history / non-recordedValue)", async () => {
    const vm = makeVm(
      {
        kind: "recordedValue",
        value: 50,
        unit: "%",
        dateIso: "2026-07-02T00:00:00.000Z",
      },
      undefined,
      { trendArrow: null },
    );
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="trend-arrow"]'),
    ).toBeNull();
  });
});
