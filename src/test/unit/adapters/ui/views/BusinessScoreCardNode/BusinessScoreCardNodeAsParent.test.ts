import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import type { BusinessScoreCardNodeAsParent } from "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import type { BusinessScoreCardNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function makeVm(
  value: BusinessScoreCardNodeViewModel["value"],
  dateIso?: string,
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
});
