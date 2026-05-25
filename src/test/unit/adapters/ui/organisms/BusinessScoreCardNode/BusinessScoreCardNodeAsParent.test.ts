import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/organisms/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import { BusinessScoreCardNodeAsParent } from "../../../../../../adapters/ui/organisms/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import type { BusinessScoreCardNodeViewModel } from "../../../../../../adapters/ui/molecules/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

// SPEC §17.51 -- jsdom (the Vitest default DOM implementation) does
// not expose a `PointerEvent` constructor (it is a relatively new
// addition to the WHATWG spec and jsdom currently dispatches pointer
// events as plain Events). The §17.51 stepper tests need to dispatch
// `pointerdown` / `pointerup` so the per-view's `@pointerdown` /
// `@pointerup` listeners fire; we shim a minimal subclass of Event
// that carries the `pointerId` field the production code reads. The
// shim only kicks in when `PointerEvent` is genuinely absent so a
// future jsdom upgrade (or running these tests under a real-browser
// runner like Playwright Test) keeps using the spec class.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventShim extends Event {
    pointerId: number;
    constructor(
      type: string,
      init: EventInit & { pointerId?: number } = {},
    ) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  // Cast through `unknown` because TS's PointerEvent is broader
  // than what we ever read at runtime; the production handler
  // touches `pointerId`, `currentTarget`, and `preventDefault`
  // only -- all covered by the shim.
  (globalThis as unknown as { PointerEvent: typeof PointerEvent }).PointerEvent =
    PointerEventShim as unknown as typeof PointerEvent;
}

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
  it("\u00a717.121j \u2014 reserves the shared `.subtitle` slot (empty) between the title and the body so the metric pane aligns with workflow / computed parent strips", async () => {
    const vm = makeVm({ kind: "recordedValue", value: 50, unit: "%", dateIso: "2026-04-23T18:25:43.511Z" });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => { e.vm = vm; },
    );
    const subtitle = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="subtitle"]');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent?.trim()).toBe("");
  });

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

    // SPEC §17.116 — the `computedMean` branch's title is prefixed by
    // a Σ glyph (the pre-§17.116 inline chip moved to the title row).
    // SPEC §17.125 / §17.140 — the unit rides the title row as a
    // bare-unit chip (§17.140 dropped the parens); strip both Σ and
    // `%` from the textContent to read the bare title text "Revenue".
    expect(
      el.shadowRoot
        ?.querySelector('[data-testid="title"]')
        ?.textContent?.replace(/\u03a3|%/g, "")
        .trim(),
    ).toBe("Revenue");
    // §17.132 -- Σ badge is now a `<ds-icon name="sigma">` Lucide SVG
    // wrapped in the same `<span data-testid="computed-badge">`.
    expect(
      el.shadowRoot?.querySelector('[data-testid="computed-badge"] ds-icon')?.getAttribute("name"),
    ).toBe("sigma");
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

  it("\u00a717.125 — renders the computed mean (max 2 decimals, trailing zeros stripped) with the \u03a3 badge in the title and the (unit) chip in the title prefix (no timestamp when no children-derived date)", async () => {
    const vm = makeVm({ kind: "computedMean", mean: 87.42, unit: "%" });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    const badge = el.shadowRoot?.querySelector('[data-testid="computed-badge"]');
    // §17.116: value text is the bare number, max 2 decimals, no inline unit.
    expect(value?.textContent?.trim()).toBe("87.42");
    expect(value?.getAttribute("data-value-kind")).toBe("computedMean");
    // §17.116: Σ moved to the title prefix (still present, different parent).
    expect(badge).not.toBeNull();
    // §17.125 + §17.140: unit reads as a bare-unit chip in the title prefix.
    const chip = el.shadowRoot?.querySelector('[data-testid="unit-chip"]');
    expect(chip?.textContent?.trim()).toBe("%");
    expect(el.shadowRoot?.querySelector(".unit-below")).toBeNull();
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

  it("\u00a717.125 / \u00a717.140 — the unit reads as the bare-unit chip in the title prefix; the value span carries only the bare number with no inline .unit and no .unit-below sibling", async () => {
    const vm = makeVm({ kind: "recordedValue", value: 100, unit: "%", dateIso: "2026-04-23T18:25:43.511Z" });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value"]');
    expect(value).not.toBeNull();
    // §17.116: no inline .unit child inside the value span anymore.
    expect(value?.querySelector(".unit")).toBeNull();
    expect(value?.textContent?.trim()).toBe("100");
    // §17.125: the unit chip rides the title row; the .unit-below
    // block sibling is retired.
    const chip = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="unit-chip"]');
    expect(chip).not.toBeNull();
    expect(chip?.classList.contains("unit-chip")).toBe(true);
    expect(chip?.textContent?.trim()).toBe("%");
    expect(el.shadowRoot?.querySelector(".unit-below")).toBeNull();
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
    // §17.125 + §17.140: value is the bare number; the unit reads
    // as the bare-unit chip in the title prefix.
    expect(value?.textContent?.trim()).toBe("100");
    expect(
      el.shadowRoot?.querySelector('[data-testid="unit-chip"]')?.textContent?.trim(),
    ).toBe("%");
    expect(value?.getAttribute("data-value-kind")).toBe("recordedValue");
    expect(date?.getAttribute("datetime")).toBe("2026-04-23T18:25:43.511Z");
    // §17.116: visible label is the age, not a locale calendar date.
    expect(date?.textContent ?? "").not.toMatch(/\d{4}/);
    // recordedValue branch shows NO Σ badge in the title.
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
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

    // -- SPEC §17.126 -- inline unit-chip edit -----------------------

    describe("\u00a717.126 \u2014 inline unit-chip edit on the title prefix", () => {
      async function openUnitEditor(): Promise<{
        el: BusinessScoreCardNodeAsParent;
        input: HTMLInputElement;
      }> {
        const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
          "business-score-card-as-parent",
          (e) => { e.vm = recordedVm; },
        );
        el.shadowRoot
          ?.querySelector<HTMLElement>('[data-testid="unit-chip"]')
          ?.click();
        await el.updateComplete;
        const input = el.shadowRoot!.querySelector<HTMLInputElement>(
          '[data-testid="unit-chip-edit"]',
        )!;
        return { el, input };
      }

      function pressKey(input: HTMLInputElement, key: string): void {
        input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      }

      it("clicking the chip swaps it for an input pre-filled with the unit", async () => {
        const { input } = await openUnitEditor();
        expect(input).not.toBeNull();
        expect(input.value).toBe("%");
      });

      it("clicking the chip does NOT enter title edit mode", async () => {
        const { el } = await openUnitEditor();
        expect(
          el.shadowRoot?.querySelector('[data-testid="title-edit"]'),
        ).toBeNull();
      });

      it("Enter dispatches inline-edit-unit with the trimmed new value", async () => {
        const { el, input } = await openUnitEditor();
        const handler = vi.fn();
        el.addEventListener("inline-edit-unit", handler);
        input.value = "  USD  ";
        pressKey(input, "Enter");
        expect(handler).toHaveBeenCalledTimes(1);
        const ev = handler.mock.calls[0]![0] as CustomEvent<{
          nodeId: string;
          unit: string;
        }>;
        expect(ev.detail).toEqual({ nodeId: "bsc-1", unit: "USD" });
      });

      it("Enter on an unchanged unit does NOT dispatch", async () => {
        const { el, input } = await openUnitEditor();
        const handler = vi.fn();
        el.addEventListener("inline-edit-unit", handler);
        input.value = "%";
        pressKey(input, "Enter");
        expect(handler).not.toHaveBeenCalled();
      });

      it("Enter on a blank unit dispatches with an empty string", async () => {
        const { el, input } = await openUnitEditor();
        const handler = vi.fn();
        el.addEventListener("inline-edit-unit", handler);
        input.value = "   ";
        pressKey(input, "Enter");
        expect(handler).toHaveBeenCalledTimes(1);
        const ev = handler.mock.calls[0]![0] as CustomEvent<{
          nodeId: string;
          unit: string;
        }>;
        expect(ev.detail.unit).toBe("");
      });

      it("Escape cancels edit without dispatching", async () => {
        const { el, input } = await openUnitEditor();
        const handler = vi.fn();
        el.addEventListener("inline-edit-unit", handler);
        input.value = "USD";
        pressKey(input, "Escape");
        await el.updateComplete;
        expect(handler).not.toHaveBeenCalled();
        expect(
          el.shadowRoot?.querySelector('[data-testid="unit-chip-edit"]'),
        ).toBeNull();
        expect(
          el.shadowRoot
            ?.querySelector('[data-testid="unit-chip"]')
            ?.textContent?.trim(),
        ).toBe("%");
      });
    });

    // -- SPEC §17.51 -- inline value-edit ± stepper buttons ------------

    describe("\u00a717.51 \u2014 inline value-edit \u00b1 stepper buttons", () => {
      it("renders \u2212 / + buttons flanking the value-edit input", async () => {
        // SPEC §17.51 — operator-facing requirement: the buttons that
        // increase / decrease a recorded value need to be bigger /
        // discoverable than the native browser spinners (which are
        // ~12 px on Chromium and entirely hidden on most mobile
        // browsers). Two custom buttons appear when the value-edit
        // is open; both carry stable data-testids so e2e tests can
        // tap them.
        // SPEC §17.52-polish-2 -- the visible glyph is drawn via
        // CSS pseudo-elements (::before / .value-stepper--plus::after);
        // the buttons themselves are empty in the markup. The
        // `value-stepper--minus` / `value-stepper--plus` modifier
        // class is the canonical "which kind of button is this?"
        // marker (replaces the pre-§17.52-polish-2 textContent
        // glyph assertion).
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
        const minus = el.shadowRoot?.querySelector<HTMLButtonElement>(
          '[data-testid="value-step-down"]',
        );
        const plus = el.shadowRoot?.querySelector<HTMLButtonElement>(
          '[data-testid="value-step-up"]',
        );
        expect(minus).not.toBeNull();
        expect(plus).not.toBeNull();
        // The modifier class is the marker for "which glyph the
        // CSS pseudo-element draws on this button"; pin both so a
        // future refactor that drops the modifier (and breaks the
        // plus button's vertical bar) fails fast.
        expect(minus?.classList.contains("value-stepper--minus")).toBe(true);
        expect(plus?.classList.contains("value-stepper--plus")).toBe(true);
        // The buttons are empty in the markup -- the visible glyph
        // is the pseudo-element bar drawn at the geometric centre
        // of the button (operator's *"\u2212 / + symbol [...] not
        // vertically aligned with their circle"* fix lives here).
        expect(minus?.textContent?.trim()).toBe("");
        expect(plus?.textContent?.trim()).toBe("");
        // aria-label / title live in tandem so a hover-tooltip on
        // desktop AND a screen reader on accessible kiosks both
        // pick up the same English label.
        expect(minus?.getAttribute("aria-label")).toBe("Decrement value");
        expect(plus?.getAttribute("aria-label")).toBe("Increment value");
      });

      it("draws the glyph via geometrically-centered CSS pseudo-element bars (\u00a717.52-polish-2)", async () => {
        // SPEC §17.52-polish-2 -- operator follow-up: *"the \u2212
        // and + symbol in the buttons to edit the numeral value of
        // a parent node are not vertically aligned with their
        // circle, fix that"*. Pre-§17.52-polish-2 the buttons
        // rendered the \u2212 / + glyph as inline text and relied
        // on inline-flex's align-items: center to centre the line
        // box -- which placed the glyph's math axis ~5 % above the
        // line-box centre because of asymmetric font ascender /
        // descender space. The fix mirrors the §17.47 close-X /
        // edit-pencil approach: the glyph is drawn via ::before
        // (horizontal bar, both buttons) + ::after (vertical bar,
        // plus only) positioned absolutely at top: 50 % / left:
        // 50 % with transform: translate(-50 %, -50 %), so the
        // bars sit at the exact geometric centre of the circle
        // regardless of font metrics. Pin via a CSS-source regex
        // so a future refactor that drops the centering trick
        // (e.g. a CSS reset that removes top/left or a transform
        // override) fails fast.
        const css = (
          BusinessScoreCardNodeAsParent.styles as unknown as {
            cssText?: string;
          }
        )?.cssText
          ?? String(BusinessScoreCardNodeAsParent.styles);
        // ::before bar -- shared between both buttons.
        expect(css).toMatch(
          /\.value-stepper::before\s*\{[\s\S]*?top:\s*50%[\s\S]*?left:\s*50%[\s\S]*?transform:\s*translate\(-50%,\s*-50%\)/,
        );
        // ::after bar -- only on the plus modifier.
        expect(css).toMatch(
          /\.value-stepper--plus::after\s*\{[\s\S]*?top:\s*50%[\s\S]*?left:\s*50%[\s\S]*?transform:\s*translate\(-50%,\s*-50%\)/,
        );
      });

      it("renders the stepper buttons as circles (border-radius 50 %, \u00a717.52-polish)", async () => {
        // SPEC §17.52-polish -- operator follow-up: *"the +
        // and \u2212 button when we edit the value of a parent
        // node should be circles"*. The shape revision flips
        // the §17.51 rounded-square (`border-radius: 6px`) to
        // a perfect disc. The width / height clamp is identical
        // on both axes, so a 50 % radius reads as a circle at
        // every viewport size. Pin the contract via a CSS-source
        // regex so a future restyle that loses the disc shape
        // (e.g. a global reset that lowers `border-radius`)
        // fails fast.
        const css = (
          BusinessScoreCardNodeAsParent.styles as unknown as {
            cssText?: string;
          }
        )?.cssText
          ?? String(BusinessScoreCardNodeAsParent.styles);
        expect(css).toMatch(
          /\.value-stepper\s*\{[^}]*border-radius:\s*50%/,
        );
      });

      it("hides the native browser spinner on the value-edit input (\u00a717.51)", async () => {
        // SPEC §17.51 — pin the appearance suppression so a future
        // refactor that drops the rule (e.g. a global `appearance:
        // auto` reset, or a CSS-in-JS migration that loses the
        // ::-webkit-* pseudo-elements) gets caught. Both the WebKit
        // pseudo-element rule and the Firefox / standard
        // appearance: textfield rule are required because each
        // browser engine reads only its own.
        const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
          "business-score-card-as-parent",
          (e) => {
            e.vm = recordedVm;
          },
        );
        const css = (
          el.constructor as typeof BusinessScoreCardNodeAsParent
        ).styles
          ?.toString()
          ?? "";
        expect(css).toMatch(
          /\.value-edit::-webkit-(inner|outer)-spin-button[\s\S]*?-webkit-appearance:\s*none/,
        );
        expect(css).toMatch(/\.value-edit\s*\{[^}]*appearance:\s*textfield/);
      });

      it("tapping + once steps the input value up by 1", async () => {
        // SPEC §17.51 — the step amount is fixed at 1 (operator can
        // still type fractional values manually). A single tap fires
        // exactly one step; the press-and-hold repeat starts only
        // after the 200 ms initial delay (tested separately).
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
        const plus = el.shadowRoot?.querySelector<HTMLButtonElement>(
          '[data-testid="value-step-up"]',
        )!;
        expect(input.value).toBe("42");
        plus.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }),
        );
        plus.dispatchEvent(
          new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
        );
        expect(input.value).toBe("43");
      });

      it("tapping \u2212 once steps the input value down by 1", async () => {
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
        const minus = el.shadowRoot?.querySelector<HTMLButtonElement>(
          '[data-testid="value-step-down"]',
        )!;
        minus.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, pointerId: 2 }),
        );
        minus.dispatchEvent(
          new PointerEvent("pointerup", { bubbles: true, pointerId: 2 }),
        );
        expect(input.value).toBe("41");
      });

      it("multiple taps accumulate (3 taps on +) without committing until Enter", async () => {
        // SPEC §17.51 — stepping does NOT auto-commit. The operator
        // can step several times then press Enter once; the
        // inline-edit-value event fires exactly once, with the
        // accumulated value. Without this contract the operator
        // would emit a stream of intermediate edits (every step =
        // one persisted history entry), which breaks the §17.32
        // history-row snapshot semantics.
        const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
          "business-score-card-as-parent",
          (e) => {
            e.vm = recordedVm;
          },
        );
        const handler = vi.fn();
        el.addEventListener("inline-edit-value", handler);
        el.shadowRoot
          ?.querySelector<HTMLElement>('[data-testid="value"]')
          ?.click();
        await el.updateComplete;
        const input = el.shadowRoot?.querySelector<HTMLInputElement>(
          '[data-testid="value-edit"]',
        )!;
        const plus = el.shadowRoot?.querySelector<HTMLButtonElement>(
          '[data-testid="value-step-up"]',
        )!;
        for (let i = 0; i < 3; i++) {
          plus.dispatchEvent(
            new PointerEvent("pointerdown", {
              bubbles: true,
              pointerId: 100 + i,
            }),
          );
          plus.dispatchEvent(
            new PointerEvent("pointerup", {
              bubbles: true,
              pointerId: 100 + i,
            }),
          );
        }
        expect(input.value).toBe("45");
        expect(handler).not.toHaveBeenCalled();
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(handler).toHaveBeenCalledTimes(1);
        const ev = handler.mock.calls[0]![0] as CustomEvent<{
          nodeId: string;
          value: number | string;
        }>;
        expect(ev.detail.value).toBe(45);
      });

      it("seeds at 0 then steps when the input has been cleared", async () => {
        // SPEC §17.51 — defensive path: an empty input + a step
        // press writes "1" / "-1" instead of "NaN". Without this
        // seed the operator would have to type "0" before the
        // buttons start working.
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
        const plus = el.shadowRoot?.querySelector<HTMLButtonElement>(
          '[data-testid="value-step-up"]',
        )!;
        input.value = "";
        plus.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, pointerId: 7 }),
        );
        plus.dispatchEvent(
          new PointerEvent("pointerup", { bubbles: true, pointerId: 7 }),
        );
        expect(input.value).toBe("1");
      });

      it("press-and-hold keeps stepping at 200 ms cadence (\u00a717.51)", async () => {
        // SPEC §17.51 — press-and-hold contract: tap = 1 step;
        // hold past 200 ms = repeat at 200 ms cadence. After the
        // initial step + 220 ms wait we expect exactly one
        // additional step (= "44"); after another 200 ms we
        // expect a second additional step (= "45"). Releasing the
        // pointer halts the timer.
        vi.useFakeTimers();
        try {
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
          const plus = el.shadowRoot?.querySelector<HTMLButtonElement>(
            '[data-testid="value-step-up"]',
          )!;
          plus.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true, pointerId: 9 }),
          );
          // Initial tap fires synchronously: 42 -> 43.
          expect(input.value).toBe("43");
          // After 200 ms (the initial wait) the first repeat fires.
          vi.advanceTimersByTime(200);
          expect(input.value).toBe("44");
          // After another 200 ms cadence tick the second repeat fires.
          vi.advanceTimersByTime(200);
          expect(input.value).toBe("45");
          // Pointer up halts the timer; further time advances do
          // NOT keep stepping.
          plus.dispatchEvent(
            new PointerEvent("pointerup", { bubbles: true, pointerId: 9 }),
          );
          vi.advanceTimersByTime(1000);
          expect(input.value).toBe("45");
        } finally {
          vi.useRealTimers();
        }
      });
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
      const row = el.shadowRoot?.querySelector('[data-testid="target-row"]');
      expect(row).not.toBeNull();
      // SPEC §17.142b -- AsParent migrates off the <objective-cell> +
      // <target-date-cell> molecules onto the §17.142 <card-body>
      // skeleton. The target value renders as a direct SVG-mono
      // child of `.target-value` (which IS the `data-testid="target-
      // row"` element, slotted into card-body's `aux` cell); the
      // date lives in the `meta` cell as a sibling. §17.141 also
      // dropped the unit suffix on the target text -- "80", not
      // "80 %".
      expect(row?.querySelector("objective-cell")).toBeNull();
      expect(row?.querySelector("target-date-cell")).toBeNull();
      expect(row?.textContent?.replace(/\s+/g, " ").trim()).toBe("80");
      const date = el.shadowRoot?.querySelector('[data-testid="target-date"]');
      expect(date).not.toBeNull();
      expect(date?.getAttribute("datetime")).toBe("2026-12-31T00:00:00.000Z");
      expect(date?.getAttribute("slot")).toBe("meta");
      expect(date?.textContent?.trim()).toBe("31 Dec 2026");
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
      // SPEC §17.142b -- AsParent retires the <objective-cell>
      // molecule (kept alive for Computed* AsParent until §17.142c).
      // The warning lives directly inside `.target-value` (which IS
      // the `data-testid="target-row"` element) -- no nested shadow
      // root to traverse here, mirrors the §17.142a AsChild shape.
      const warn = row?.querySelector<HTMLElement>(
        '[data-testid="off-track-warning"]',
      );
      expect(warn).not.toBeNull();
      expect(warn?.getAttribute("style") ?? "").toMatch(
        /\bcolor:\s*rgb\(220,\s*38,\s*38\)/,
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
      // SPEC §17.142b -- pre-§17.142b the trend arrow was a `<ds-
      // icon>` DOM child carrying `data-testid="trend-arrow"` +
      // `data-direction`. §17.142b folds the arrow into a CSS
      // background-image on `.current-value` (mirrors the §17.139c
      // AsChild migration). The `data-direction` attribute moves
      // onto `.current-value` itself; the aria-label moves with
      // it. No DOM child carries the glyph any more (the CSS data-
      // URI content is covered by `trendArrowBg.test.ts`).
      expect(el.shadowRoot?.querySelector('[data-testid="trend-arrow"]')).toBeNull();
      const value = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value"]');
      expect(value).not.toBeNull();
      expect(value!.getAttribute("data-direction")).toBe("up");
      expect(value!.getAttribute("aria-label")?.toLowerCase()).toContain("well ahead");
      expect(value!.querySelector("ds-icon[name='arrow-up']")).toBeNull();
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

    it("\u00a717.142b \u2014 hides the trend-arrow background while inline-editing the value (the editor input replaces the static value cell entirely, so the `data-direction` attribute is unreachable: no .current-value in the DOM)", async () => {
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
        (e) => { e.vm = vm; },
      );
      // Static value cell carries the trend background pre-edit.
      const valueBefore = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value"]');
      expect(valueBefore?.classList.contains("current-value")).toBe(true);
      expect(valueBefore?.getAttribute("data-direction")).toBe("up-right");
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="value"]')
        ?.click();
      await el.updateComplete;
      // Edit mode: the lead slot now hosts the .value-edit-wrapper
      // (the stepper input shell). It still carries data-testid=
      // "value" but is NOT a .current-value cell -- the trend
      // background CSS rule no longer applies because the
      // attribute selector .current-value[data-direction=...]
      // does not match.
      const valueAfter = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value"]');
      expect(valueAfter?.classList.contains("current-value")).toBe(false);
      expect(valueAfter?.classList.contains("value-edit-wrapper")).toBe(true);
    });
  });

  // -- SPEC §17.45 ----------------------------------------------------

  describe("\u00a717.45 \u2014 horizontal split: metric-pane (left) + description (right) when description is present", () => {
    it("renders a `.body` row with both `.metric-pane` and `.description` as siblings when description is non-empty", async () => {
      const vm = makeVm({ kind: "computedMean", mean: 87.42, unit: "%" });
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => {
          e.vm = vm;
        },
      );
      const body = el.shadowRoot?.querySelector<HTMLElement>(".body");
      expect(body).not.toBeNull();
      expect(body?.getAttribute("data-has-description")).toBe("true");
      const pane = body?.querySelector<HTMLElement>(
        '[data-testid="metric-pane"]',
      );
      expect(pane).not.toBeNull();
      const desc = body?.querySelector<HTMLElement>(
        '[data-testid="description"]',
      );
      expect(desc).not.toBeNull();
      // \u00a717.45 \u2014 description sits AFTER the metric-pane in the
      // body row, so DOM order matches reading order (left -> right).
      expect(
        pane!.compareDocumentPosition(desc!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("renders a `.body` row with only `.metric-pane` (no description sibling) when description is empty", async () => {
      const vm: BusinessScoreCardNodeViewModel = {
        kind: "BusinessScoreCardNode",
        id: "bsc-1",
        title: "Revenue",
        description: "",
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
      const body = el.shadowRoot?.querySelector<HTMLElement>(".body");
      expect(body).not.toBeNull();
      expect(body?.getAttribute("data-has-description")).toBe("false");
      expect(
        body?.querySelector('[data-testid="metric-pane"]'),
      ).not.toBeNull();
      expect(
        body?.querySelector('[data-testid="description"]'),
      ).toBeNull();
    });

    it("hosts the corner timestamp INSIDE the metric-pane (\u00a717.45 \u2014 metric-pane is the absolute-positioned timestamp's containing block)", async () => {
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
      // \u00a717.136 S1 -- the timestamp moved out of the metric-pane
      // and into card-frame's footer-right slot. The contract pinned
      // here flips from "INSIDE the metric-pane" to "INSIDE
      // card-frame's footer-right slot": the timestamp must declare
      // slot="footer-right", NOT live inside the metric-pane, and
      // there must still be exactly ONE timestamp in the shadow
      // root (regression guard against duplicate renders).
      const date = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="value-date"]',
      );
      expect(date).not.toBeNull();
      expect(date?.getAttribute("slot")).toBe("footer-right");
      const pane = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="metric-pane"]',
      );
      expect(pane?.querySelector('[data-testid="value-date"]')).toBeNull();
      const allDates = el.shadowRoot?.querySelectorAll(
        '[data-testid="value-date"]',
      );
      expect(allDates?.length).toBe(1);
    });

    it("\u00a717.142b \u2014 the metric-pane IS the <card-body> molecule, with `.current-value` / `.target-value` / `.target-date` as direct slot children (`lead` / `aux` / `meta`); the pre-\u00a717.142b `.value-area` host div + `data-testid=\"value-row\"` hook retire", async () => {
      const vm = makeVm({
        kind: "recordedValue",
        value: 50,
        unit: "%",
        dateIso: "2026-04-23T00:00:00.000Z",
      });
      const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
        "business-score-card-as-parent",
        (e) => { e.vm = vm; },
      );
      const pane = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="metric-pane"]',
      );
      expect(pane).not.toBeNull();
      expect(pane?.tagName.toLowerCase()).toBe("card-body");
      // Pre-§17.142b `.value-area` host div + `data-testid="value-
      // row"` hook retired -- callers reach for the slot children
      // directly via their own testids.
      expect(pane?.querySelector(".value-area")).toBeNull();
      expect(pane?.querySelector('[data-testid="value-row"]')).toBeNull();
      const value = pane?.querySelector<HTMLElement>('[data-testid="value"]');
      expect(value?.getAttribute("slot")).toBe("lead");
      const targetValue = pane?.querySelector<HTMLElement>(".target-value");
      expect(targetValue?.getAttribute("slot")).toBe("aux");
      const targetDate = pane?.querySelector<HTMLElement>(".target-date");
      expect(targetDate?.getAttribute("slot")).toBe("meta");
    });

    it("the reduced-motion sentinel (`test-no-anim` on <html>) holds the body at `data-entering=\"false\"` from the first paint", async () => {
      // \u00a717.45 \u2014 reduced-motion contract: the per-view honours
      // the same `test-no-anim` sentinel that drillTransitions reads,
      // so a Vitest run under `dismissAnimations()` lands the body
      // directly at the final 50 / 50 split without staging the
      // entering animation. Without this the body would render with
      // `data-entering=\"true\"` and the description would be hidden
      // (flex-basis: 0%, opacity: 0) for the duration of the test.
      document.documentElement.classList.add("test-no-anim");
      try {
        const vm = makeVm({ kind: "computedMean", mean: 50, unit: "%" });
        const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
          "business-score-card-as-parent",
          (e) => {
            e.vm = vm;
          },
        );
        const body = el.shadowRoot?.querySelector<HTMLElement>(".body");
        expect(body).not.toBeNull();
        expect(body?.getAttribute("data-entering")).toBe("false");
      } finally {
        document.documentElement.classList.remove("test-no-anim");
      }
    });

    it("\u00a717.46 \u2014 a portrait-orientation container query flips the body to flex-direction: column so the metric-pane lands on TOP 50 % and the description on BOTTOM 50 % when the per-view's host is taller than wide", () => {
      // \u00a717.46 -- when the parent strip is rendered as the LEFT
      // 25 % rail in landscape (TreeMapScreen's
      // .layout[data-orientation="landscape"] rule), the per-view's
      // host is taller than wide. The shared tileLayoutStyles makes
      // the per-view a `container-type: size` size container, so a
      // `@container (orientation: portrait)` block matches when the
      // per-view's height > width. The BSC parent uses that hook to
      // flip the body's flex-direction from row to column. The
      // existing flex-basis transitions (\u00a717.45) work along the
      // new main axis without code changes.
      const cssText = (
        BusinessScoreCardNodeAsParent.styles as readonly { cssText?: string }[]
      )
        .map((s) => String(s.cssText ?? s))
        .join("\n");
      expect(cssText).toMatch(
        /@container \(orientation:\s*portrait\)\s*\{[\s\S]*?\.body\s*\{[\s\S]*?flex-direction:\s*column/,
      );
      // The description's left-padding (which separates it from the
      // metric-pane in row flex) flips to a top-padding so it
      // separates from the metric-pane along the new main axis.
      expect(cssText).toMatch(
        /@container \(orientation:\s*portrait\)\s*\{[\s\S]*?\.description\s*\{[\s\S]*?padding-top:\s*0\.4rem/,
      );
      // \u00a717.47 -- the pre-\u00a717.47 contract pinned a
      // margin-right: 0 reset inside the portrait container query
      // (cancelling the \u00a717.39 negative gutter-escape margin in
      // column flex). \u00a717.47 retires the gutter end-to-end (the
      // strip no longer reserves padding-right; the buttons overlay
      // the title row) so neither the negative margin nor its reset
      // is needed any more -- both are gone from the styles.
    });

    it("the CSS pins the post-commit transitions on `.metric-pane` (flex-basis) and `.description` (flex-basis + opacity) so the entering animation is registered (\u00a717.45)", () => {
      // The drill-into morph hand-off relies on these transitions to
      // animate the metric-pane shrinking from 100 % \u2192 50 % and
      // the description fading in on the right. Pin the rules at the
      // CSS level so a future style refactor that drops them fails
      // fast \u2014 jsdom doesn't fully resolve shadow-scoped computed
      // styles for visual regression checks (the e2e suite covers the
      // real-browser timing).
      const cssText = (
        BusinessScoreCardNodeAsParent.styles as readonly { cssText?: string }[]
      )
        .map((s) => String(s.cssText ?? s))
        .join("\n");
      // \u00a717.45 / \u00a717.48 / \u00a717.49 -- both panes carry
      // a 320 ms flex-basis transition (= DRILL_SETTLE_MS, preserves
      // the morph contract); the description also carries an
      // opacity + transform transition so the text fades in + slides
      // in over an (almost-)stable layout. \u00a717.49 extended the
      // opacity duration to 480 ms (was 240 ms in \u00a717.48) and
      // the transform duration to 560 ms (was 320 ms in
      // \u00a717.48); both keep the 80 ms opacity start-delay and
      // the cubic-bezier(0.22, 1, 0.36, 1) curve. Decoupling the
      // slide + fade from the layout settle means the description
      // continues sliding + fading in for ~240 ms after the layout
      // is stable, which is exactly the "appearing progressively"
      // contract the operator asked for. Pin all four extras here
      // so a future curve refactor that drops or shortens them
      // fails fast.
      expect(cssText).toMatch(
        /\.metric-pane\s*\{[\s\S]*?transition:[\s\S]*?flex-basis\s+320ms/,
      );
      expect(cssText).toMatch(
        /\.description\s*\{[\s\S]*?transition:[\s\S]*?flex-basis\s+320ms/,
      );
      expect(cssText).toMatch(
        /\.description\s*\{[\s\S]*?transition:[\s\S]*?opacity\s+480ms\s+ease-out\s+80ms/,
      );
      expect(cssText).toMatch(
        /\.description\s*\{[\s\S]*?transition:[\s\S]*?transform\s+560ms/,
      );
      // \u00a717.49 -- the entering state pins translateX(50cqw)
      // for row flex (= half the host's width = the description's
      // own final width, so the entering state places the
      // description fully beyond the host's right edge); the
      // portrait container query swaps to translateY(50cqh) for
      // column flex (= half the host's height = the description's
      // final height in column flex, so the entering state places
      // it fully beyond the host's bottom edge). Both rely on the
      // host's overflow: hidden (from tileLayoutStyles) to clip the
      // off-edge content. The pre-\u00a717.49 8 % literals collapsed
      // to ~0 px effective offset because % resolves against the
      // element's own width and that width was itself transitioning
      // from 0 -- the cqw / cqh units sidestep that entirely.
      expect(cssText).toMatch(
        /\.body\[data-entering="true"\]\s+\.description\s*\{[\s\S]*?transform:\s*translateX\(50cqw\)/,
      );
      expect(cssText).toMatch(
        /@container \(orientation:\s*portrait\)\s*\{[\s\S]*?\.body\[data-entering="true"\]\s+\.description\s*\{[\s\S]*?transform:\s*translateY\(50cqh\)/,
      );
      // \u00a717.47 -- the pre-\u00a717.47 contract pinned a
      // .body[data-has-description="false"] .metric-pane rule with
      // `margin-right: calc(0px - var(--strip-gutter-right, 0px))`
      // (the \u00a717.39 escape of the strip's right-side gutter so
      // the centered BSC value lands at the strip's full center).
      // \u00a717.47 drops the strip's gutter (the buttons now match
      // the title row's height and overlay the right end of the
      // title row instead of dangling below into the body), so the
      // metric-pane fills the strip's full inner width by default
      // and no escape is needed. The negative margin-right rule is
      // therefore gone from the styles. Negation guard so a future
      // refactor that re-introduces the negative-margin escape on
      // the metric-pane fails fast.
      //
      // \u00a717.136 S1 -- the pre-\u00a717.136 `--strip-gutter-right`
      // machinery is retired end-to-end on AsParent. The title now
      // lives in card-frame's `title` slot, sibling to the
      // `header-actions` slot in card-frame's title-row -- the grid
      // layout keeps the title cell separate from the affordances,
      // so the title-edit input no longer needs to escape any
      // published gutter. Negation pins so a future refactor that
      // reintroduces the gutter machinery on AsParent fails fast.
      expect(cssText).not.toMatch(/--strip-gutter-right/);
      expect(cssText).toMatch(/\.title-edit\s*\{[^}]*max-width:\s*100%/);
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
