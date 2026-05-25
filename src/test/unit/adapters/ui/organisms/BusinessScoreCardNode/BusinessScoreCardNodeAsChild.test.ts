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
    expect(chip?.textContent?.trim()).toBe("%");
    expect(title?.textContent?.replace(/\u03a3|%/g, "").trim()).toBe("Sales");
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

  it("\u00a717.40 — applies the gradient valueColor to .current-value via --bsc-value-color (no --char-count plumbing in \u00a717.139 SVG-mono layout)", async () => {
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
    // SPEC \u00a717.139 -- the pre-\u00a717.139 --char-count CSS variable (used by
    // the retired .value clamp(min(42cqmin, 160cqi/N)) formula) is
    // no longer needed: SVG viewBox sizing handles the per-text-
    // length fit natively. The inline style now carries ONLY the
    // \u00a717.40 gradient colour.
    expect(value?.getAttribute("style") ?? "").not.toContain("--char-count");
  });

  it("\u00a717.139 / \u00a717.140 \u2014 value glyph renders as an `<svg>` with viewBox width = textLen \xd7 MONO_CHAR_WIDTH (13.2) \xd7 1.1 across all numeric branches (the \u00a717.140 10% right padding gives the trend-arrow background room to breathe before reaching the value text); textContent matches the rendered text", async () => {
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
      const svg = value?.querySelector("svg");
      expect(svg).not.toBeNull();
      const viewBox = svg?.getAttribute("viewBox") ?? "";
      const textWidth = expected.length * 13.2;
      const rightPad = textWidth * 0.1;
      expect(viewBox).toBe(`0 0 ${textWidth + rightPad} 22`);
    }
  });

  it("\u00a717.139 / \u00a717.141 \u2014 renders the target row with `.target-value` (bare target value, no unit per \u00a717.141) + `.target-date` (formatted deadline); bullseye target icon is the CSS background of `.target-value`, not a `<ds-icon>` child", async () => {
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

    // SPEC \u00a717.139 -- the pre-\u00a717.139 `<objective-cell>` +
    // `<target-date-cell>` molecules are no longer mounted by BSC
    // AsChild (they stay alive for BSC AsParent + Computed* AsParent
    // until a follow-up strand migrates those too). The target row
    // is a `display: contents` wrapper carrying the testid; the two
    // cells inside are siblings of `.current-value` at the grid
    // level.
    const row = el.shadowRoot?.querySelector('[data-testid="target-row"]');
    expect(row).not.toBeNull();
    expect(row?.querySelector("objective-cell")).toBeNull();
    expect(row?.querySelector("target-date-cell")).toBeNull();
    const targetText = row?.querySelector('[data-testid="target-text"]');
    expect(targetText).not.toBeNull();
    // SPEC §17.141 — target text is the bare value, no unit suffix
    // (the unit lives on the title-prefix chip per §17.125 + §17.140).
    expect(targetText?.textContent?.replace(/\s+/g, " ").trim()).toBe("80");
    const date = row?.querySelector('[data-testid="target-date"]');
    expect(date).not.toBeNull();
    expect(date?.getAttribute("datetime")).toBe("2026-12-31T00:00:00.000Z");
    expect(date?.textContent?.trim()).toBe("31 Dec 2026");
    // SPEC \u00a717.139 -- `.target-value` carries the bullseye icon as a
    // CSS background-image (not a DOM child). The shared
    // `.target-value` rule sets `background-image: url("data:...")`
    // via the trendArrowBg molecule; the inline style on the
    // element is empty.
    const targetValue = row?.querySelector<HTMLElement>(".target-value");
    expect(targetValue).not.toBeNull();
    expect(targetValue?.querySelector("ds-icon")).toBeNull();
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
    // SPEC \u00a717.139 -- the warning glyph stays in the target row, but
    // since the pre-\u00a717.139 `<objective-cell>` molecule no longer
    // hosts BSC AsChild's target cell, the warning lives directly
    // inside `.target-value` in the per-view's shadow root (no
    // nested molecule shadow to traverse).
    const targetValue = row?.querySelector<HTMLElement>(".target-value");
    expect(targetValue).not.toBeNull();
    const warn = targetValue?.querySelector<HTMLElement>(
      '[data-testid="off-track-warning"]',
    );
    expect(warn).not.toBeNull();
    expect(warn?.getAttribute("style") ?? "").toMatch(
      /\bcolor:\s*rgb\(220,\s*38,\s*38\)/,
    );
    expect(warn?.getAttribute("aria-label")?.toLowerCase()).toContain(
      "deadline",
    );
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

  it("\u00a717.139 — `.current-value` carries `data-direction` for the trend arrow bucket + an aria-label describing the trend; the arrow is a CSS background-image, not a `<ds-icon>` child", async () => {
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

    const value = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="value"]',
    );
    expect(value).not.toBeNull();
    expect(value!.getAttribute("data-direction")).toBe("up-right");
    expect(value!.getAttribute("aria-label")?.toLowerCase()).toContain(
      "on or near schedule",
    );
    // SPEC \u00a717.139 -- the pre-\u00a717.139 `<ds-icon>` Lucide child is
    // retired; the trend arrow lives in a CSS `background-image:
    // url("data:image/svg+xml,...")` rule keyed off the
    // `data-direction` attribute selector. The CSS data-URI content
    // is covered by `trendArrowBg.test.ts` (jsdom does not resolve
    // Constructible Stylesheets through `getComputedStyle`, so a
    // shadow-root probe is not portable here). The contract this
    // test holds is "no DOM child carries the glyph any more".
    expect(value!.querySelector("ds-icon")).toBeNull();
  });

  it.each([
    ["up", "well ahead"],
    ["right", "flat"],
    ["down-right", "slight regression"],
    ["down", "significant regression"],
  ] as const)(
    "\u00a717.139 \u2014 direction %s stamps data-direction=%s with a meaningful aria-label",
    async (direction, labelFragment) => {
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
      const value = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="value"]',
      );
      expect(value).not.toBeNull();
      expect(value!.getAttribute("data-direction")).toBe(direction);
      expect(value!.getAttribute("aria-label")?.toLowerCase()).toContain(
        labelFragment,
      );
    },
  );

  it("\u00a717.139 — `data-direction` is empty when objective.trendArrow is null (insufficient history / non-recordedValue)", async () => {
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
    const value = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="value"]',
    );
    expect(value?.getAttribute("data-direction") ?? "").toBe("");
  });

  it("\u00a717.136 S13b \u2014 stamps a `<weight-edit-button slot=\"footer-left\">` carrying the vm.id + the forwarded weight property (the §17.52 corner overlay retires from the grid and lands inside card-frame's footer-left cell)", async () => {
    const vm = makeVm({
      kind: "recordedValue",
      value: 12,
      unit: "%",
      dateIso: "2026-04-23T00:00:00.000Z",
    });
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
        e.weight = 2.5;
      },
    );
    const btn = el.shadowRoot?.querySelector<HTMLElement & { weight: number }>(
      "weight-edit-button",
    );
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("slot")).toBe("footer-left");
    expect(btn?.getAttribute("node-id")).toBe(vm.id);
    expect(btn?.weight).toBe(2.5);
  });

  it("\u00a717.139 / \u00a717.141 \u2014 the `.target-date` cell only renders when `objective.targetDateIso` is non-empty; the `.target-value` cell still renders (bare target value, no unit per \u00a717.141)", async () => {
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = makeVm(
          {
            kind: "recordedValue",
            value: 50,
            unit: "%",
            dateIso: "2026-04-23T18:25:43.511Z",
          },
          undefined,
          { targetDateIso: "" },
        );
      },
    );
    const row = el.shadowRoot?.querySelector('[data-testid="target-row"]');
    expect(row).not.toBeNull();
    expect(row?.querySelector(".target-date")).toBeNull();
    expect(row?.querySelector(".target-value")).not.toBeNull();
  });

  it("\u00a717.139 \u2014 body grid layout: `.current-value` + `.target-value` + `.target-date` are the 3 direct grid items of `.value-area` (the `.target-row` wrapper is `display: contents`, so its children become direct grid children)", async () => {
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = makeVm({
          kind: "recordedValue",
          value: 75,
          unit: "%",
          dateIso: "2026-04-23T18:25:43.511Z",
        });
      },
    );
    const valueArea = el.shadowRoot?.querySelector<HTMLElement>(".value-area");
    expect(valueArea).not.toBeNull();
    const currentValue = valueArea?.querySelector<HTMLElement>(".current-value");
    const targetRow = valueArea?.querySelector<HTMLElement>(".target-row");
    const targetValue = valueArea?.querySelector<HTMLElement>(".target-value");
    const targetDate = valueArea?.querySelector<HTMLElement>(".target-date");
    expect(currentValue).not.toBeNull();
    expect(targetRow).not.toBeNull();
    expect(targetValue).not.toBeNull();
    expect(targetDate).not.toBeNull();
    expect(currentValue?.parentElement).toBe(valueArea);
    expect(targetRow?.parentElement).toBe(valueArea);
    expect(targetValue?.parentElement).toBe(targetRow);
    expect(targetDate?.parentElement).toBe(targetRow);
    // SPEC \u00a717.139 -- the pre-\u00a717.139 `<objective-cell>` and
    // `<target-date-cell>` molecules are NOT mounted by BSC AsChild
    // (the cells render their text via the shared `svgMonoText`
    // atom inline). The molecules stay alive for BSC AsParent +
    // Computed* AsParent for the duration of this strand.
    expect(valueArea?.querySelector("objective-cell")).toBeNull();
    expect(valueArea?.querySelector("target-date-cell")).toBeNull();
  });
});
