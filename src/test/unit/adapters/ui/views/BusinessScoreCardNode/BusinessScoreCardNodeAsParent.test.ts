import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import { BusinessScoreCardNodeAsParent } from "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
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
  // SPEC §17.18 — top-level `dateIso` is what the corner timestamp
  // reads from. For tests that fabricate a VM directly (without going
  // through `viewModelMapper`) we mirror what the mapper would set:
  // `recordedValue.dateIso` for recorded BSCs, otherwise `""` which
  // omits the timestamp.
  const resolvedDateIso =
    dateIso ?? (value.kind === "recordedValue" ? value.dateIso : "");
  return {
    kind: "BusinessScoreCardNode",
    id: "bsc-1",
    title: "Revenue",
    description: "Revenue vs plan",
    value,
    dateIso: resolvedDateIso,
    // SPEC §17.21 — pin a representative dateColor; empty dateIso →
    // empty dateColor (mirrors mapper behaviour).
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

describe("<business-score-card-as-parent>", () => {
  it("renders Title and the description (\u00a717.30 \u2014 BSC parent view shows the metric's definition)", async () => {
    // SPEC §17.30 — the description (the BSC's definition, e.g.
    // "Quarterly revenue across the EU-North region…") is rendered on
    // the parent view between the title and the value. Read-only here;
    // the operator edits it through the §17.28 edit modal.
    const vm = makeVm({ kind: "computedMean", mean: 87.42, unit: "%" });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    expect(
      el.shadowRoot?.querySelector('[data-testid="title"]')?.textContent?.trim(),
    ).toBe("Revenue");
    const desc = el.shadowRoot?.querySelector('[data-testid="description"]');
    expect(desc).not.toBeNull();
    expect(desc?.textContent?.trim()).toBe("Revenue vs plan");
  });

  it("omits the description block when vm.description is empty (\u00a717.30)", async () => {
    // §17.30 — only render the description if it carries content.
    // Whitespace-only descriptions are treated as empty so the focused
    // panel doesn't grow a vertical gap for nothing.
    const vm: BusinessScoreCardNodeViewModel = {
      kind: "BusinessScoreCardNode",
      id: "bsc-1",
      title: "Revenue",
      description: "   ",
      value: { kind: "computedMean", mean: 87.42, unit: "%" },
      dateIso: "",
      dateColor: "",
      objective: {
        targetValue: 100,
        targetDateIso: "2026-12-31T00:00:00.000Z",
        unit: "%",
        valueColor: "",
        warningColor: "",
        trendArrow: null,
      },
    };
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );
    expect(el.shadowRoot?.querySelector('[data-testid="description"]')).toBeNull();
  });

  it("renders the computed mean (1-decimal) + Σ badge for kind=computedMean (no timestamp when no children-derived date)", async () => {
    const vm = makeVm({ kind: "computedMean", mean: 87.42, unit: "%" });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    const badge = el.shadowRoot?.querySelector('[data-testid="computed-badge"]');
    expect(value?.textContent?.replace(/\s+/g, " ").trim()).toBe("87.4 %");
    expect(value?.getAttribute("data-value-kind")).toBe("computedMean");
    expect(badge).not.toBeNull();
    // §17.18 — when no children date is available (`vm.dateIso === ""`),
    // the corner timestamp is omitted. With a derived date present the
    // mapper sets `vm.dateIso` and the timestamp would render — covered
    // in the §17.18 mapper tests.
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  it("renders the corner timestamp for kind=computedMean when vm.dateIso is set (\u00a717.18 — children-derived date)", async () => {
    const vm = makeVm(
      { kind: "computedMean", mean: 87.42, unit: "%" },
      "2026-04-15T10:00:00.000Z",
    );
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const date = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="value-date"]',
    );
    expect(date).not.toBeNull();
    expect(date?.getAttribute("datetime")).toBe("2026-04-15T10:00:00.000Z");
    expect(date?.getAttribute("style") ?? "").toMatch(/--age-color:\s*rgb\(/);
  });

  it("nests the unit inside the value as a `.unit` span (\u00a717.14 — 1/3-size styling, asserted in CSS)", async () => {
    const vm = makeVm({ kind: "recordedValue", value: 100, unit: "%", dateIso: "2026-04-23T18:25:43.511Z" });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value"]');
    const unit = value?.querySelector<HTMLElement>(".unit");
    expect(value).not.toBeNull();
    expect(unit).not.toBeNull();
    expect(unit?.textContent?.trim()).toBe("%");
    // The 1/3 sizing is enforced by `font-size: calc(1em / 3)` on the
    // `.unit` rule in `tileLayoutStyles`. jsdom doesn't fully resolve
    // shadow-scoped computed styles, so the visual ratio is covered in
    // the CSS file itself + the e2e suite (real browser).
  });

  it("renders value + corner timestamp (no Σ) for kind=recordedValue with age-coloured date (\u00a717.18)", async () => {
    const vm = makeVm({
      kind: "recordedValue",
      value: 100,
      unit: "%",
      dateIso: "2026-04-23T18:25:43.511Z",
    });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    const date = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="value-date"]',
    );
    expect(value?.textContent?.replace(/\s+/g, " ").trim()).toBe("100 %");
    expect(value?.getAttribute("data-value-kind")).toBe("recordedValue");
    expect(date?.getAttribute("datetime")).toBe("2026-04-23T18:25:43.511Z");
    expect(date?.classList.contains("timestamp")).toBe(true);
    // §17.18 — inline `--age-color` carries the lerped colour.
    expect(date?.getAttribute("style") ?? "").toMatch(/--age-color:\s*rgb\(/);
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
  });

  it('renders "n children" plain text (no Σ, no Unit, no timestamp) for kind=childrenCount, n>0', async () => {
    const vm = makeVm({ kind: "childrenCount", n: 3 });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    expect(value?.textContent?.trim()).toBe("3 children");
    expect(value?.getAttribute("data-value-kind")).toBe("childrenCount");
    expect(value?.textContent).not.toContain("%");
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  it("renders an empty value area for kind=childrenCount, n=0", async () => {
    const vm = makeVm({ kind: "childrenCount", n: 0 });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    expect(value?.textContent?.trim()).toBe("");
    expect(value?.getAttribute("data-value-kind")).toBe("childrenCount-empty");
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  // -- §17.28 inline editing ------------------------------------------

  describe("inline editing (\u00a717.28)", () => {
    const recordedVm = makeVm({
      kind: "recordedValue",
      value: 42,
      unit: "%",
      dateIso: "2026-04-23T00:00:00.000Z",
    });

    it("clicking the title swaps it for an input pre-filled with the current value", async () => {
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = recordedVm;
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="title"]')
        ?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-testid="title-edit"]',
      );
      expect(input).not.toBeNull();
      expect(input?.value).toBe("Revenue");
    });

    it("Enter on the title input dispatches inline-edit-title", async () => {
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = recordedVm;
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="title"]')
        ?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-testid="title-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-title", handler);
      input.value = "Revised";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]![0] as CustomEvent<{
        nodeId: string;
        title: string;
      }>;
      expect(ev.detail).toEqual({ nodeId: "bsc-1", title: "Revised" });
    });

    it("clicking the recorded value swaps it for a number input pre-filled with the value", async () => {
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = recordedVm;
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="value"]')
        ?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-testid="value-edit"]',
      );
      expect(input).not.toBeNull();
      expect(input?.type).toBe("number");
      expect(input?.value).toBe("42");
    });

    it("Enter on the value input dispatches inline-edit-value with a number", async () => {
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = recordedVm;
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="value"]')
        ?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-testid="value-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-value", handler);
      input.value = "55.5";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]![0] as CustomEvent<{
        nodeId: string;
        value: number | string;
      }>;
      expect(ev.detail.nodeId).toBe("bsc-1");
      expect(ev.detail.value).toBe(55.5);
    });

    it("computed-mean values are NOT click-to-edit (no value-edit affordance)", async () => {
      const computedVm = makeVm({ kind: "computedMean", mean: 87.4, unit: "%" });
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = computedVm;
        },
      );
      const value = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="value"]',
      );
      // No is-editable affordance on a computedMean span
      expect(value?.classList.contains("is-editable")).toBe(false);
      // Clicking it does not switch to an input
      value?.click();
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="value-edit"]'),
      ).toBeNull();
    });

    it("blank or non-numeric value commits as a no-op", async () => {
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = recordedVm;
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="value"]')
        ?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-testid="value-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-value", handler);
      input.value = "";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -- SPEC §17.40 ----------------------------------------------------

  describe("\u00a717.40 \u2014 objective row, gradient value colour, off-track warning", () => {
    it("applies vm.objective.valueColor to the .value via --bsc-value-color (recordedValue)", async () => {
      const vm = makeVm(
        {
          kind: "recordedValue",
          value: 50,
          unit: "%",
          dateIso: "2026-04-23T00:00:00.000Z",
        },
        undefined,
        { valueColor: "rgb(250, 204, 21)" },
      );
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = vm;
        },
      );
      const value = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="value"]',
      );
      expect(value?.getAttribute("style") ?? "").toContain(
        "--bsc-value-color: rgb(250, 204, 21)",
      );
    });

    it("renders the target row + bullseye icon under the value with target value, unit, and date", async () => {
      const vm = makeVm(
        {
          kind: "computedMean",
          mean: 50,
          unit: "%",
        },
        "2026-04-23T00:00:00.000Z",
        {
          targetValue: 80,
          targetDateIso: "2026-12-31T00:00:00.000Z",
          unit: "%",
        },
      );
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = vm;
        },
      );
      expect(
        el.shadowRoot?.querySelector('[data-testid="target-row"]'),
      ).not.toBeNull();
      expect(
        el.shadowRoot?.querySelector('[data-testid="target-icon"]'),
      ).not.toBeNull();
      expect(
        el.shadowRoot
          ?.querySelector('[data-testid="target-text"]')
          ?.textContent?.replace(/\s+/g, " ")
          .trim(),
      ).toBe("80 %");
      expect(
        el.shadowRoot
          ?.querySelector('[data-testid="target-date"]')
          ?.getAttribute("datetime"),
      ).toBe("2026-12-31T00:00:00.000Z");
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
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = vm;
        },
      );
      const row = el.shadowRoot?.querySelector('[data-testid="target-row"]');
      expect(row).not.toBeNull();
      const warn = row?.querySelector<HTMLElement>(
        '[data-testid="off-track-warning"]',
      );
      // §17.44 — warning lives inside the target row, after the date,
      // tinted by the deviation magnitude.
      expect(warn).not.toBeNull();
      expect(warn?.getAttribute("style") ?? "").toMatch(
        /\bcolor:\s*rgb\(220,\s*38,\s*38\)/,
      );
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
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = vm;
        },
      );
      expect(
        el.shadowRoot?.querySelector('[data-testid="off-track-warning"]'),
      ).toBeNull();
    });

    it("does not render the target row while inline-editing the value (focus is on input)", async () => {
      const vm = makeVm({
        kind: "recordedValue",
        value: 42,
        unit: "%",
        dateIso: "2026-04-23T00:00:00.000Z",
      });
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = vm;
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="value"]')
        ?.click();
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="target-row"]'),
      ).toBeNull();
    });
  });

  describe("trend arrow (\u00a717.41)", () => {
    it("renders the trend arrow next to the value when objective.trendArrow is set, with the bucket exposed as data-direction and a monochrome glyph", async () => {
      const vm = makeVm(
        {
          kind: "recordedValue",
          value: 50,
          unit: "%",
          dateIso: "2026-07-02T00:00:00.000Z",
        },
        undefined,
        { trendArrow: "up" },
      );
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = vm;
        },
      );
      const arrow = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="trend-arrow"]',
      );
      expect(arrow).not.toBeNull();
      expect(arrow!.getAttribute("data-direction")).toBe("up");
      expect(arrow!.textContent?.trim()).toBe("\u2191");
      // §17.41 colour policy -- monochrome (currentColor); no inline
      // colour plumbing.
      expect(arrow!.getAttribute("style") ?? "").toBe("");
      // Sits inside the .value-row wrapper so it lands horizontally
      // next to the value (not in the column-flex value-area below).
      expect(arrow!.parentElement?.classList.contains("value-row")).toBe(true);
    });

    it("does NOT render a trend arrow when objective.trendArrow is null (insufficient history / non-recordedValue)", async () => {
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
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = vm;
        },
      );
      expect(
        el.shadowRoot?.querySelector('[data-testid="trend-arrow"]'),
      ).toBeNull();
    });

    it("hides the trend arrow while inline-editing the value (consistent with target-row + warning policy)", async () => {
      const vm = makeVm(
        {
          kind: "recordedValue",
          value: 42,
          unit: "%",
          dateIso: "2026-04-23T00:00:00.000Z",
        },
        undefined,
        { trendArrow: "up-right" },
      );
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = vm;
        },
      );
      // Sanity check: arrow visible before editing.
      expect(
        el.shadowRoot?.querySelector('[data-testid="trend-arrow"]'),
      ).not.toBeNull();
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="value"]')
        ?.click();
      await el.updateComplete;
      // Arrow gone while editing -- the editor input does not need a
      // trend-rate gloss next to it (the operator's eye is on the
      // input field, the arrow would compete for focus).
      expect(
        el.shadowRoot?.querySelector('[data-testid="trend-arrow"]'),
      ).toBeNull();
    });
  });

  describe("title colour (\u00a717.31, simplified by \u00a717.42)", () => {
    // \u00a717.42 \u2014 see TextNodeAsParent.test.ts for the full
    // rationale. Pinned independently here because BSC and TextNode
    // are sibling per-views with their own scoped styles; a future
    // theme refactor that drops the rule from one but keeps it in
    // the other would silently desynchronise the focused-panel
    // appearance across kinds.
    it("the .title carries the bright off-white literal", () => {
      const cssText = (
        BusinessScoreCardNodeAsParent.styles as readonly { cssText?: string }[]
      )
        .map((s) => String(s.cssText ?? s))
        .join("\n");
      expect(cssText).toMatch(
        /\.title\s*\{[\s\S]*?color:\s*rgb\(245,\s*245,\s*245\)/,
      );
      // §17.42 \u2014 the prior `var(--board-fresh, ...)` look-up
      // MUST be gone so a future regression that reintroduces the
      // per-board accent fails fast here. The bare `--board-fresh`
      // string still appears in narrative comments by design; the
      // regex only flags actual `var()` consumers.
      expect(cssText).not.toMatch(/var\(--board-fresh/);
    });
  });
});
