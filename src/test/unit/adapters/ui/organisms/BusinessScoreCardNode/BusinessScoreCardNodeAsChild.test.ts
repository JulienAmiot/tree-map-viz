import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/organisms/BusinessScoreCardNode/BusinessScoreCardNodeAsChild.js";
import type { BusinessScoreCardNodeAsChild } from "../../../../../../adapters/ui/organisms/BusinessScoreCardNode/BusinessScoreCardNodeAsChild.js";
import type { BusinessScoreCardNodeViewModel } from "../../../../../../adapters/ui/molecules/NodeViewModel.js";
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
  it("\u00a717.121i \u2014 a disabled VM prepends a `.disabled-indicator` forbidden-sign glyph at the LEFT of the title; an enabled VM emits nothing (no strike, no value-area dim)", async () => {
    const enabledVm = makeVm({ kind: "recordedValue", value: 50, unit: "%", dateIso: "2026-04-23T18:25:43.511Z" });
    const enabled = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => { e.vm = enabledVm; },
    );
    expect(enabled.shadowRoot?.querySelector('[data-testid="disabled-indicator"]')).toBeNull();
    expect(enabled.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
    const off = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => { e.vm = { ...enabledVm, disabled: true }; },
    );
    // \u00a717.136 S2 -- the disabled indicator moved from inside the
    // title element into card-frame's `icons` slot. Look it up by
    // data-testid directly (it's the only disabled indicator in the
    // shadow root regardless of which slot wrapper it sits in).
    const indicator = off.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="disabled-indicator"]',
    );
    expect(indicator?.getAttribute("data-testid")).toBe("disabled-indicator");
    expect(indicator?.tagName).toBe("SPAN");
    // §17.133 -- the indicator now hosts a single `<ds-icon name="ban">`
    // Lucide SVG child (was an empty span styled by a `::before`
    // pseudo pre-§17.133).
    expect(indicator?.children.length).toBe(1);
    expect(indicator?.firstElementChild?.tagName.toLowerCase()).toBe("ds-icon");
    expect(indicator?.firstElementChild?.getAttribute("name")).toBe("ban");
    expect(off.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
  });

  it("\u00a717.121j \u2014 reserves the shared `.subtitle` slot (empty) so the value-area aligns with workflow/computed tiles in the wall", async () => {
    const vm = makeVm({ kind: "recordedValue", value: 50, unit: "%", dateIso: "2026-04-23T18:25:43.511Z" });
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => { e.vm = vm; },
    );
    const subtitle = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="subtitle"]');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent?.trim()).toBe("");
  });

  it("\u00a717.125 — renders the \u03a3 prefix in the title row for the computedMean branch + the (unit) chip prefix between badge and title; value remains a bare number; no .unit-below sibling renders", async () => {
    const vm = makeVm({ kind: "computedMean", mean: 50, unit: "%" });
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    // §17.132 -- Σ badge is now a `<ds-icon name="sigma">` Lucide SVG.
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"] ds-icon')?.getAttribute("name")).toBe("sigma");
    const chip = el.shadowRoot?.querySelector('[data-testid="unit-chip"]');
    expect(chip).not.toBeNull();
    expect(chip?.textContent?.trim()).toBe("(%)");
    expect(title?.textContent?.replace(/\u03a3|\(%\)/g, "").trim()).toBe("Sales");
    expect(el.shadowRoot?.querySelector('[data-testid="value"]')?.textContent?.trim()).toBe("50");
    expect(el.shadowRoot?.querySelector(".unit-below")).toBeNull();
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
    // SPEC §17.116-followup-3 — the inline style now also carries
    // --char-count alongside the gradient colour so the shared
    // .value font-size cap can shrink long values to fit the tile.
    // formatValue(50) → "50" (2 chars).
    expect(value?.getAttribute("style") ?? "").toContain("--char-count: 2");
  });

  it("\u00a717.116-followup-3 — .value stamps --char-count equal to the rendered text length across all numeric branches", async () => {
    const probes: ReadonlyArray<{
      vm: BusinessScoreCardNodeViewModel["value"];
      expected: string;
    }> = [
      { vm: { kind: "recordedValue", value: 12345.6789, unit: "EUR", dateIso: "2026-04-23T18:25:43.511Z" },
        expected: "12345.68" },
      { vm: { kind: "computedMean", mean: -100.5, unit: "%" }, expected: "-100.5" },
      { vm: { kind: "childrenCount", n: 12 }, expected: "12 children" },
    ];
    for (const { vm, expected } of probes) {
      const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
        "business-score-card-as-child",
        (e) => { e.vm = makeVm(vm); },
      );
      const value = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value"]');
      expect(value?.textContent?.trim()).toBe(expected);
      expect(value?.getAttribute("style") ?? "").toContain(`--char-count: ${expected.length}`);
    }
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
    // SPEC §17.116-followup-2 — the visible label uses the
    // `d MMM yyyy` shape (UTC accessors so the kiosk reads the
    // calendar date the operator typed regardless of local TZ).
    expect(date?.textContent?.trim()).toBe("31 Dec 2026");
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
    // §17.132 -- glyph is now a Lucide `<ds-icon>` (was U+2197 pre-§17.132).
    expect(arrow!.querySelector("ds-icon")?.getAttribute("name")).toBe(
      "arrow-up-right",
    );
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
    ["up", "arrow-up", "well ahead"],
    ["right", "arrow-right", "flat"],
    ["down-right", "arrow-down-right", "slight regression"],
    ["down", "arrow-down", "significant regression"],
  ] as const)(
    "\u00a717.41 + \u00a717.132 \u2014 direction %s renders <ds-icon name=%s> with a meaningful aria-label",
    async (direction, slug, labelFragment) => {
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
      expect(arrow!.querySelector("ds-icon")?.getAttribute("name")).toBe(slug);
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
