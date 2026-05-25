import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/organisms/ComputedNode/ComputedCards.js";
import {
  COMPUTATION_KIND_CHANGE_EVENT, type ComputationKindChangeDetail,
  type ComputedBusinessScoreCard, type ComputedCard,
} from "../../../../../../adapters/ui/organisms/ComputedNode/ComputedCards.js";
import type {
  BusinessScoreCardObjectiveViewModel, ComputationKindName,
  ComputedBusinessScoreNodeViewModel, ComputedNodeViewModel, ComputedValueViewModel,
} from "../../../../../../adapters/ui/molecules/NodeViewModel.js";
import { cleanupLitFixtures, mountLitElement } from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const ALL_KINDS: readonly ComputationKindName[] = ["SUM", "AVERAGE", "MIN", "MAX", "WEIGHTED_AVERAGE", "COUNT"];
const FLAT_OBJ: BusinessScoreCardObjectiveViewModel = {
  targetValue: 100, targetDateIso: "2026-12-31T00:00:00.000Z", unit: "%",
  valueColor: "", warningColor: "", trendArrow: null,
};

function computedVm(value: ComputedValueViewModel, kind: ComputationKindName = "SUM"): ComputedNodeViewModel {
  return { kind: "ComputedNode", id: "c-1", title: "Total revenue", value, computationKind: kind, availableKinds: ALL_KINDS };
}

function cbsnVm(
  value: ComputedValueViewModel, kind: ComputationKindName = "AVERAGE",
  dateIso = "2026-04-23T18:25:43.511Z", objective = FLAT_OBJ,
): ComputedBusinessScoreNodeViewModel {
  return {
    kind: "ComputedBusinessScoreNode", id: "cbsn-1", title: "Avg score", description: "Q",
    value, computationKind: kind, availableKinds: ALL_KINDS,
    dateIso, dateColor: dateIso ? "rgb(255, 145, 50)" : "", objective,
  };
}

describe("<computed-card> (\u00a717.104 + \u00a717.116)", () => {
  it("\u00a717.121i \u2014 the enable/disable switch renders ONLY in the AsParent role (AsChild tree-map tiles never surface the write affordance) and lives at the LEFT of the title", async () => {
    const asParent = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "EUR" });
      e.viewRole = "asParent";
    });
    // \u00a717.136 S3 -- the disabled switch moved out of the title's
    // first-child slot into card-frame's `icons` slot. Look it up by
    // data-testid; on AsParent it still exists, on AsChild it must
    // not (the §17.121i role-gating contract is unchanged).
    const parentSwitch = asParent.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-testid="disabled-switch"]');
    expect(parentSwitch?.getAttribute("role")).toBe("switch");
    const asChild = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "EUR" });
      e.viewRole = "asChild";
    });
    expect(asChild.shadowRoot?.querySelector('[data-testid="disabled-switch"]')).toBeNull();
    // Enabled VM => no AsChild indicator either.
    expect(asChild.shadowRoot?.querySelector('[data-testid="disabled-indicator"]')).toBeNull();
  });

  it("\u00a717.121i / \u00a717.122a \u2014 a disabled VM surfaces the forbidden-sign glyph in the AsChild role (`.disabled-indicator` prepended to the title); the AsParent role keeps the same switch but its aria-checked flips to false (knob LEFT, red pill, cross glyph)", async () => {
    const vm = { ...computedVm({ kind: "numeric", value: 42, unit: "EUR" }), disabled: true };
    const asChild = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = vm;
      e.viewRole = "asChild";
    });
    // \u00a717.136 S4 -- disabled indicator moved into card-frame's
    // `icons` slot, no longer a title descendant. Same data-testid.
    expect(asChild.shadowRoot?.querySelector('[data-testid="disabled-indicator"]')).not.toBeNull();
    expect(asChild.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
    const asParent = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = vm;
      e.viewRole = "asParent";
    });
    // \u00a717.136 S3 -- switch lives in card-frame's `icons` slot now,
    // not as a title firstElementChild. Same aria-checked contract.
    const parentSwitch = asParent.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-testid="disabled-switch"]');
    expect(parentSwitch?.getAttribute("aria-checked")).toBe("false");
    expect(asParent.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
  });

  it("\u00a717.125 \u2014 \u03a3 prefixes the title; numeric value renders without inline unit; (unit) chip rides the title row; no .unit-below block; AsChild kind-label sits in the shared `.subtitle` slot directly under the title", async () => {
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "EUR" }, "WEIGHTED_AVERAGE");
    });
    const sr = el.shadowRoot!;
    const title = sr.querySelector('[data-testid="title"]');
    expect(title?.getAttribute("data-view-kind")).toBe("ComputedNode");
    // \u00a717.136 S4 -- badge + chip + title text now live in
    // sibling slots (icons / unit / title), not as descendants of
    // the title element. Look each up directly. Σ badge stays a
    // `<ds-icon name="sigma">` Lucide SVG per \u00a717.132.
    expect(sr.querySelector('[data-testid="computed-badge"] ds-icon')?.getAttribute("name")).toBe("sigma");
    const chip = sr.querySelector('[data-testid="unit-chip"]');
    expect(chip?.textContent?.trim()).toBe("EUR");
    expect(title?.textContent?.trim()).toBe("Total revenue");
    // Value text is the bare number with max 2 decimals (no trailing zero, no inline unit).
    expect(sr.querySelector('[data-testid="value"]')?.getAttribute("data-value-kind")).toBe("numeric");
    expect(sr.querySelector('[data-testid="value"]')?.textContent?.trim()).toBe("42");
    // §17.125: the .unit-below block sibling under the value is retired.
    expect(sr.querySelector(".unit-below")).toBeNull();
    // SPEC §17.121e — the kind-label is back (the §17.116-followup-2
    // retirement was reversed in §17.121e), now living inside the
    // shared `.subtitle` slot directly under the title. AsChild role
    // shows a static `<span>` with the short noun-phrase descriptor
    // ("Weighted average") rather than a `<select>` (the picker is
    // AsParent-only).
    const subtitle = sr.querySelector<HTMLElement>('[data-testid="subtitle"]');
    expect(subtitle).not.toBeNull();
    const kindLabel = sr.querySelector<HTMLElement>('[data-testid="kind-label"]');
    expect(kindLabel?.textContent?.trim()).toBe("Weighted average");
    expect(subtitle?.contains(kindLabel!)).toBe(true);
    expect(sr.querySelector('[data-testid="strategy-picker"]')).toBeNull();
    expect(sr.querySelector('[data-testid="kind-dropdown"]')).toBeNull();
  });

  it("\u00a717.116 + \u00a717.121e \u2014 empty branch renders a full-tile .warning-fill (no value/computed-badge spans); the `.subtitle` row still surfaces the active kind so the operator sees what strategy failed", async () => {
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "empty", reason: "SUM produced a non-finite result" });
    });
    const sr = el.shadowRoot!;
    const warning = sr.querySelector('[data-testid="warning-fill"]');
    expect(warning).not.toBeNull();
    expect(warning?.getAttribute("data-reason")).toBe("SUM produced a non-finite result");
    expect(warning?.getAttribute("role")).toBe("img");
    expect(warning?.getAttribute("aria-label")).toBe("Cannot compute value");
    expect(sr.querySelector('[data-testid="value"]')).toBeNull();
    expect(sr.querySelector('[data-testid="computed-badge"]')).toBeNull();
    // §17.125: warning-fill branches have no unit, so the title's
    // unit chip is also absent (renderUnitChip returns nothing).
    expect(sr.querySelector('[data-testid="unit-chip"]')).toBeNull();
    expect(sr.querySelector('[data-testid="title"]')).not.toBeNull();
    // SPEC §17.121e — the `.subtitle` slot is rendered on every
    // branch (numeric AND warning-fill) so the operator still sees
    // the active computation kind on a non-computable tile. The
    // computedVm helper defaults to "SUM" when no kind is passed.
    expect(sr.querySelector('[data-testid="subtitle"]')).not.toBeNull();
    expect(sr.querySelector('[data-testid="kind-label"]')?.textContent?.trim()).toBe("Sum");
  });

  it("\u00a717.116 — childrenCount n>0 ALSO renders the .warning-fill (cannot compute = warning regardless of n)", async () => {
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "childrenCount", n: 4 });
    });
    const sr = el.shadowRoot!;
    const warning = sr.querySelector('[data-testid="warning-fill"]');
    expect(warning).not.toBeNull();
    expect(warning?.getAttribute("data-reason")).toBe("4 ineligible children");
    expect(sr.querySelector('[data-testid="value"]')).toBeNull();
    expect(sr.querySelector('[data-testid="computed-badge"]')).toBeNull();
  });

  it("\u00a717.116 — childrenCount n=0 ALSO renders the .warning-fill (parity with the empty branch)", async () => {
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "childrenCount", n: 0 });
    });
    const warning = el.shadowRoot!.querySelector('[data-testid="warning-fill"]');
    expect(warning).not.toBeNull();
    expect(warning?.getAttribute("data-reason")).toBe("0 ineligible children");
  });

  it("\u00a717.116 — numeric value formatting strips trailing zeros (42.0 → \"42\", 42.55 → \"42.55\", 42.556 → \"42.56\")", async () => {
    const probes: Array<[number, string]> = [
      [42, "42"], [42.0, "42"], [42.5, "42.5"], [42.55, "42.55"],
      [42.556, "42.56"], [-0, "0"], [0.001, "0"],
    ];
    for (const [n, expected] of probes) {
      const el = await mountLitElement<ComputedCard>("computed-card", (e) => {
        e.vm = computedVm({ kind: "numeric", value: n, unit: "" });
      });
      expect(el.shadowRoot!.querySelector('[data-testid="value"]')?.textContent?.trim()).toBe(expected);
    }
  });

  it("\u00a7\u00a717.104 + 17.116 — COMPUTATION_KIND_CHANGE_EVENT + ComputationKindChangeDetail exports survive the inline-dropdown retirement (used by the §17.116-followup modal wiring in main.ts)", () => {
    expect(COMPUTATION_KIND_CHANGE_EVENT).toBe("computation-kind-change");
    const detail: ComputationKindChangeDetail = { nodeId: "c-1", newKind: "MAX" };
    expect(detail.nodeId).toBe("c-1");
    expect(detail.newKind).toBe("MAX");
  });

  it("\u00a717.116-followup-3 — .value stamps --char-count equal to the rendered text length so the shared font-size cap can shrink long values to fit the tile width", async () => {
    // Probe pairs: numeric value → expected rendered text → expected
    // --char-count. The shared `.value` clamp reads var(--char-count, 2)
    // and caps the font-size at 160cqi / max(2, --char-count); we
    // assert the plumbing (the inline style stamps the right N for the
    // rendered text). The CSS cap itself is exercised by the e2e
    // suite (the unit tests run in jsdom, where layout = 0 px).
    const probes: Array<[number, string]> = [
      [42, "42"],            // 2 chars
      [1234, "1234"],        // 4 chars
      [12345.6789, "12345.68"], // 8 chars after formatValue's 2-decimal clamp
      [-100.5, "-100.5"],    // 6 chars (sign + digits + decimal)
    ];
    for (const [n, expected] of probes) {
      const el = await mountLitElement<ComputedCard>("computed-card", (e) => {
        e.vm = computedVm({ kind: "numeric", value: n, unit: "" });
      });
      const value = el.shadowRoot!.querySelector('[data-testid="value"]');
      expect(value?.textContent?.trim()).toBe(expected);
      expect(value?.getAttribute("style") ?? "").toContain(`--char-count: ${expected.length}`);
    }
  });
});

describe("<computed-business-score-card> (\u00a717.104 + \u00a717.116)", () => {
  it("\u00a717.121i / \u00a717.122a \u2014 a disabled VM surfaces the forbidden-sign glyph at the left of the title (AsChild: `.disabled-indicator`, AsParent: `.disabled-switch` with aria-checked=false \u2014 knob LEFT, red pill, cross glyph); mirror of the ComputedCard role-gating rule", async () => {
    const vm = { ...cbsnVm({ kind: "numeric", value: 42, unit: "EUR" }), disabled: true };
    const asChild = await mountLitElement<ComputedBusinessScoreCard>("computed-business-score-card", (e) => {
      e.vm = vm;
      e.viewRole = "asChild";
    });
    // \u00a717.136 S4 -- disabled indicator moved into card-frame's
    // `icons` slot, no longer a title descendant. Same data-testid.
    expect(asChild.shadowRoot?.querySelector('[data-testid="disabled-indicator"]')).not.toBeNull();
    expect(asChild.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
    const asParent = await mountLitElement<ComputedBusinessScoreCard>("computed-business-score-card", (e) => {
      e.vm = vm;
      e.viewRole = "asParent";
    });
    // \u00a717.136 S3 -- switch lives in card-frame's `icons` slot now,
    // not as a title firstElementChild. Same aria-checked contract.
    const parentSwitch = asParent.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-testid="disabled-switch"]');
    expect(parentSwitch?.getAttribute("aria-checked")).toBe("false");
    expect(asParent.shadowRoot?.querySelector('[data-testid="value-row"]')?.hasAttribute("data-disabled")).toBe(false);
  });

  it("\u00a717.125 \u2014 CBSN full surface: \u03a3 title prefix, (unit) chip in the title row, AsChild kind-label in the `.subtitle` slot, value (no inline unit, no trailing zero), no .unit-below, target row, age timestamp, metric-pane wrapper", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card", (e) => { e.vm = cbsnVm({ kind: "numeric", value: 75, unit: "%" }); },
    );
    const sr = el.shadowRoot!;
    const title = sr.querySelector('[data-testid="title"]');
    expect(title?.getAttribute("data-view-kind")).toBe("ComputedBusinessScoreNode");
    // \u00a717.136 S4 -- badge + chip moved into sibling slots
    // (icons / unit), no longer descendants of title. Same data-
    // testids. Σ badge stays a `<ds-icon name="sigma">` per \u00a717.132.
    expect(sr.querySelector('[data-testid="computed-badge"] ds-icon')?.getAttribute("name")).toBe("sigma");
    const chip = sr.querySelector('[data-testid="unit-chip"]');
    expect(chip?.textContent?.trim()).toBe("%");
    expect(title?.textContent?.trim()).toBe("Avg score");
    expect(sr.querySelector('[data-testid="value"]')?.textContent?.trim()).toBe("75");
    expect(sr.querySelector(".unit-below")).toBeNull();
    const time = sr.querySelector<HTMLTimeElement>('[data-testid="value-date"]');
    expect(time?.getAttribute("datetime")).toBe("2026-04-23T18:25:43.511Z");
    expect(time?.getAttribute("style")).toContain("--age-color: rgb(255, 145, 50)");
    // Timestamp text is now an age phrase, NOT a locale date.
    expect(time?.textContent ?? "").not.toMatch(/\d{4}/);
    // SPEC §17.137 A1 — target-text moved into <objective-cell>'s
    // shadow root (the molecule's render output); reach into it.
    expect(
      sr
        .querySelector("objective-cell")
        ?.shadowRoot?.querySelector('[data-testid="target-text"]')
        ?.textContent?.replace(/\s+/g, " ")
        .trim(),
    ).toBe("100 %");
    // \u00a717.136 S4 -- timestamp moved to card-frame's footer-right
    // slot (was inside .metric-pane pre-§17.136). The .metric-pane
    // still renders (now as the body slot's content) but no longer
    // contains the timestamp.
    expect(time?.getAttribute("slot")).toBe("footer-right");
    const pane = sr.querySelector('[data-testid="metric-pane"]');
    expect(pane).not.toBeNull();
    expect(pane?.contains(time!)).toBe(false);
    // SPEC §17.121e — the kind-label is back, now living inside the
    // shared `.subtitle` slot directly under the title (mirror of
    // the ComputedCard layout). The cbsnVm helper defaults to
    // "AVERAGE" when no kind is passed; the short label reads "Average".
    expect(sr.querySelector('[data-testid="subtitle"]')).not.toBeNull();
    expect(sr.querySelector('[data-testid="kind-label"]')?.textContent?.trim()).toBe("Average");
    expect(sr.querySelector('[data-testid="kind-dropdown"]')).toBeNull();
  });

  it("\u00a717.116 + \u00a717.121e \u2014 CBSN childrenCount (any n) and empty branches all render the .warning-fill (no value, no timestamp, no target row); the `.subtitle` row still surfaces the active kind so the operator sees which strategy failed", async () => {
    for (const value of [
      { kind: "childrenCount", n: 3 } as const,
      { kind: "childrenCount", n: 0 } as const,
      { kind: "empty", reason: "SUM produced a non-finite result" } as const,
    ]) {
      const el = await mountLitElement<ComputedBusinessScoreCard>(
        "computed-business-score-card",
        (e) => { e.vm = cbsnVm(value, "AVERAGE", "2026-04-23T18:25:43.511Z"); },
      );
      const sr = el.shadowRoot!;
      expect(sr.querySelector('[data-testid="warning-fill"]')).not.toBeNull();
      expect(sr.querySelector('[data-testid="value"]')).toBeNull();
      expect(sr.querySelector('[data-testid="value-date"]')).toBeNull();
      expect(sr.querySelector('[data-testid="target-row"]')).toBeNull();
      expect(sr.querySelector('[data-testid="computed-badge"]')).toBeNull();
      expect(sr.querySelector('[data-testid="title"]')).not.toBeNull();
      // SPEC §17.121e — the `.subtitle` slot is rendered on every
      // branch (numeric AND warning-fill) so the operator still sees
      // the active computation kind on a non-computable tile.
      expect(sr.querySelector('[data-testid="subtitle"]')).not.toBeNull();
      expect(sr.querySelector('[data-testid="kind-label"]')?.textContent?.trim()).toBe("Average");
    }
  });

  it("\u00a717.116 — trend arrow still renders on the numeric branch; timestamp absent when dateIso is empty", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => { e.vm = cbsnVm({ kind: "numeric", value: 50, unit: "%" }, "COUNT", "", { ...FLAT_OBJ, trendArrow: "up-right" }); },
    );
    const sr = el.shadowRoot!;
    expect(sr.querySelector('[data-testid="value-date"]')).toBeNull();
    const arrow = sr.querySelector('[data-testid="trend-arrow"]');
    expect(arrow?.getAttribute("data-direction")).toBe("up-right");
    // §17.132 -- glyph is now a Lucide `<ds-icon>` (was U+2197 pre-§17.132).
    expect(arrow?.querySelector("ds-icon")?.getAttribute("name")).toBe(
      "arrow-up-right",
    );
  });

  it("\u00a717.116-followup-3 — CBSN .value stamps --char-count and the host injects a .value-area { height: 100% } override so the value-area matches the standard BSC vertical alignment", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => { e.vm = cbsnVm({ kind: "numeric", value: 1234.56, unit: "kg" }); },
    );
    const sr = el.shadowRoot!;
    const value = sr.querySelector('[data-testid="value"]');
    // formatValue(1234.56) → "1234.56" (7 chars).
    expect(value?.textContent?.trim()).toBe("1234.56");
    expect(value?.getAttribute("style") ?? "").toContain("--char-count: 7");
    // The cbsnHostStyles sheet declares `.value-area { height: 100%; }`
    // (overriding the shared tileLayoutStyles `calc(100% - 3vh)`); the
    // override is what makes the CBSN value-area span the metric-pane
    // in full so the value+target column centres at the same vertical
    // position as the standard BSC. We assert the rule is present on
    // the element's host stylesheet — jsdom does not resolve the cqi /
    // vh units, but the rule presence is the contract that lands the
    // value-area on the right height envelope. Lit can inject styles
    // either via constructible `adoptedStyleSheets` or via inline
    // `<style>` elements depending on the runtime; we collect both.
    const adopted = (el.shadowRoot as ShadowRoot & {
      adoptedStyleSheets?: ReadonlyArray<CSSStyleSheet>;
    }).adoptedStyleSheets ?? [];
    const inlineSheets = Array.from(sr.querySelectorAll("style")).map((s) => s.textContent ?? "");
    const cssText = [
      ...adopted.map((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n")),
      ...inlineSheets,
    ].join("\n");
    expect(cssText).toMatch(/\.value-area\s*\{\s*height:\s*100%\s*;?\s*\}/);
  });
});

/**
 * Inline strategy picker (SPEC §17.104 / §17.116-followup).
 *
 * The picker is the operator's one-tap surface for swapping the
 * `ComputationKind` of a focused-panel Computed* tile. It re-instates
 * the `computation-kind-change` dispatcher that was retired at
 * §17.116-followup-2 (when no UI fired the event any more); main.ts's
 * existing handler already routes the event to `EditNodeService
 * .editFields`. Visibility is gated on `viewRole === "asParent"` so
 * the picker only appears on the focused parent strip and never on
 * the grid-of-children tiles.
 */
describe("<computed-card> + <computed-business-score-card> inline strategy picker (§17.104 / §17.116-followup)", () => {
  it("renders the picker only when viewRole === 'asParent'; defaults to hidden (asChild)", async () => {
    const childEl = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "" }, "SUM");
    });
    expect(
      childEl.shadowRoot?.querySelector('[data-testid="strategy-picker"]'),
    ).toBeNull();
    const parentEl = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "" }, "SUM");
      e.viewRole = "asParent";
    });
    expect(
      parentEl.shadowRoot?.querySelector('[data-testid="strategy-picker"]'),
    ).not.toBeNull();
  });

  it("the parent-mode picker pre-selects the VM's current strategy and lists every ComputationKind.ALL inhabitant", async () => {
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "" }, "WEIGHTED_AVERAGE");
      e.viewRole = "asParent";
    });
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>(
      '[data-testid="strategy-select"]',
    );
    if (!select) throw new Error("expected strategy-select");
    expect(select.value).toBe("WEIGHTED_AVERAGE");
    const names = Array.from(select.options).map((o) => o.value);
    expect(names).toEqual([
      "SUM",
      "AVERAGE",
      "MIN",
      "MAX",
      "WEIGHTED_AVERAGE",
      "COUNT",
    ]);
  });

  it("a change on the picker dispatches a bubbling, composed COMPUTATION_KIND_CHANGE_EVENT with { nodeId, newKind }", async () => {
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "" }, "SUM");
      e.viewRole = "asParent";
    });
    const received: ComputationKindChangeDetail[] = [];
    el.addEventListener(COMPUTATION_KIND_CHANGE_EVENT, (ev) => {
      received.push((ev as CustomEvent<ComputationKindChangeDetail>).detail);
    });
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>(
      '[data-testid="strategy-select"]',
    );
    if (!select) throw new Error("expected strategy-select");
    select.value = "MAX";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await el.updateComplete;
    expect(received).toEqual([{ nodeId: "c-1", newKind: "MAX" }]);
  });

  it("the ComputedBusinessScoreCard parent-mode picker fires the same event with the CBSN's id", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => {
        e.vm = cbsnVm({ kind: "numeric", value: 42, unit: "" }, "MIN");
        e.viewRole = "asParent";
      },
    );
    const received: ComputationKindChangeDetail[] = [];
    el.addEventListener(COMPUTATION_KIND_CHANGE_EVENT, (ev) => {
      received.push((ev as CustomEvent<ComputationKindChangeDetail>).detail);
    });
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>(
      '[data-testid="strategy-select"]',
    );
    if (!select) throw new Error("expected strategy-select");
    select.value = "AVERAGE";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await el.updateComplete;
    expect(received).toEqual([{ nodeId: "cbsn-1", newKind: "AVERAGE" }]);
  });
});

/**
 * SPEC §17.124 — inline title editing on the focused panel for both
 * Computed card classes. Operator-requested parity: every parent-
 * strip tile already lets the operator click the title to inline-
 * edit; pre-§17.124 the Computed cards were the lone outliers with
 * a static read-only title. The new behaviour mirrors the §17.28 /
 * §17.50 pattern (click swaps to input, Enter/blur commits via
 * `INLINE_EDIT_TITLE_EVENT`, Escape cancels). AsChild tiles keep
 * the static title so the grid's click-to-drill gesture is
 * preserved (single-click drills into focus, NOT edit).
 */
async function mountComputedAsParent(): Promise<ComputedCard> {
  return mountLitElement<ComputedCard>("computed-card", (e) => {
    e.vm = computedVm({ kind: "numeric", value: 42, unit: "" }, "SUM");
    e.viewRole = "asParent";
  });
}

async function enterTitleEdit(el: HTMLElement): Promise<HTMLInputElement> {
  el.shadowRoot
    ?.querySelector<HTMLElement>('[data-testid="title"]')
    ?.click();
  await (el as ComputedCard | ComputedBusinessScoreCard).updateComplete;
  return el.shadowRoot!.querySelector<HTMLInputElement>(
    '[data-testid="title-edit"]',
  )!;
}

describe("<computed-card> + <computed-business-score-card> inline title editing (§17.124)", () => {
  it("AsParent: clicking the title swaps it for an input pre-filled with the current title (<computed-card>)", async () => {
    const el = await mountComputedAsParent();
    const input = await enterTitleEdit(el);
    expect(input).not.toBeNull();
    expect(input.value).toBe("Total revenue");
  });

  it("AsParent: Enter on the title input dispatches inline-edit-title with the new value (<computed-card>)", async () => {
    const el = await mountComputedAsParent();
    const input = await enterTitleEdit(el);
    const handler = vi.fn();
    el.addEventListener("inline-edit-title", handler);
    input.value = "Renamed total";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0]![0] as CustomEvent<{ nodeId: string; title: string }>;
    expect(ev.detail).toEqual({ nodeId: "c-1", title: "Renamed total" });
    expect(ev.bubbles).toBe(true);
    expect(ev.composed).toBe(true);
  });

  // Escape-cancels + blank-is-no-op are the InlineTitleEditController's
  // own contract; they're already exhaustively covered on the
  // TextNodeAsParent test surface (every §17.28-pattern view shares
  // one controller). ComputedCards.test.ts asserts the §17.124-
  // specific wiring only: click-swap, dispatch, role gate, prefix
  // composition (Σ badge hidden while editing), CBSN parity.

  it("AsChild: clicking the title does NOT enter inline edit on either Computed card class", async () => {
    const cc = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "" }, "SUM");
      e.viewRole = "asChild";
    });
    cc.shadowRoot?.querySelector<HTMLElement>('[data-testid="title"]')?.click();
    await cc.updateComplete;
    expect(cc.shadowRoot?.querySelector('[data-testid="title-edit"]')).toBeNull();
    const cbsc = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => {
        e.vm = cbsnVm({ kind: "numeric", value: 75, unit: "%" });
        e.viewRole = "asChild";
      },
    );
    cbsc.shadowRoot?.querySelector<HTMLElement>('[data-testid="title"]')?.click();
    await cbsc.updateComplete;
    expect(cbsc.shadowRoot?.querySelector('[data-testid="title-edit"]')).toBeNull();
  });

  it("AsParent: the \u03a3 aggregation badge sits in the icons slot and stays visible while the title input is open (\u00a717.136 S3) (<computed-card>)", async () => {
    // \u00a717.136 S3 -- pre-\u00a717.136 the badge was inside the title's
    // prefix slot and the inline-edit input replaced the whole title's
    // content, which hid the badge during edit. Card-frame's split
    // layout puts the badge in the `icons` slot (sibling to `title`),
    // so the badge stays visible regardless of edit state. The
    // operator now sees the aggregation glyph + editing input
    // simultaneously.
    const el = await mountComputedAsParent();
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).not.toBeNull();
    const input = await enterTitleEdit(el);
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).not.toBeNull();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).not.toBeNull();
  });

  it("AsParent: Enter on the CBSN title input dispatches inline-edit-title with the CBSN's id (<computed-business-score-card>)", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => {
        e.vm = cbsnVm({ kind: "numeric", value: 75, unit: "%" });
        e.viewRole = "asParent";
      },
    );
    const input = await enterTitleEdit(el);
    expect(input.value).toBe("Avg score");
    const handler = vi.fn();
    el.addEventListener("inline-edit-title", handler);
    input.value = "Health score";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const ev = handler.mock.calls[0]![0] as CustomEvent<{ nodeId: string; title: string }>;
    expect(ev.detail).toEqual({ nodeId: "cbsn-1", title: "Health score" });
    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    expect(title?.getAttribute("data-view-kind")).toBe("ComputedBusinessScoreNode");
  });
});

/**
 * SPEC §17.126 — inline `(unit)` chip edit on the focused-panel
 * Computed card classes. Mirror of the §17.28 / §17.124 click-to-
 * edit affordance. AsChild grid tiles keep the chip read-only so
 * the click-to-drill gesture in the grid stays intact; AsParent
 * focused-panel tiles render the chip with click-to-edit + an
 * inline `<input class="unit-chip-edit">`.
 */
describe("<computed-card> + <computed-business-score-card> inline unit-chip edit (§17.126)", () => {
  it("AsParent CBSN: clicking the (unit) chip swaps it for an input pre-filled with the unit", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => {
        e.vm = cbsnVm({ kind: "numeric", value: 75, unit: "%" });
        e.viewRole = "asParent";
      },
    );
    el.shadowRoot?.querySelector<HTMLElement>('[data-testid="unit-chip"]')?.click();
    await el.updateComplete;
    const input = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="unit-chip-edit"]',
    );
    expect(input).not.toBeNull();
    expect(input?.value).toBe("%");
  });

  it("AsParent CBSN: Enter on the unit input dispatches inline-edit-unit with the trimmed value + CBSN id", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => {
        e.vm = cbsnVm({ kind: "numeric", value: 75, unit: "%" });
        e.viewRole = "asParent";
      },
    );
    el.shadowRoot?.querySelector<HTMLElement>('[data-testid="unit-chip"]')?.click();
    await el.updateComplete;
    const input = el.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="unit-chip-edit"]',
    )!;
    const handler = vi.fn();
    el.addEventListener("inline-edit-unit", handler);
    input.value = "  pts  ";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0]![0] as CustomEvent<{ nodeId: string; unit: string }>;
    expect(ev.detail).toEqual({ nodeId: "cbsn-1", unit: "pts" });
    expect(ev.bubbles).toBe(true);
    expect(ev.composed).toBe(true);
  });

  it("AsChild: the chip stays static (read-only) on both Computed card classes — no click-to-edit affordance", async () => {
    const cc = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "EUR" }, "SUM");
      e.viewRole = "asChild";
    });
    const ccChip = cc.shadowRoot?.querySelector<HTMLElement>('[data-testid="unit-chip"]');
    expect(ccChip).not.toBeNull();
    expect(ccChip?.classList.contains("is-editable")).toBe(false);
    ccChip?.click();
    await cc.updateComplete;
    expect(cc.shadowRoot?.querySelector('[data-testid="unit-chip-edit"]')).toBeNull();

    const cbsc = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => {
        e.vm = cbsnVm({ kind: "numeric", value: 75, unit: "%" });
        e.viewRole = "asChild";
      },
    );
    const cbscChip = cbsc.shadowRoot?.querySelector<HTMLElement>('[data-testid="unit-chip"]');
    expect(cbscChip?.classList.contains("is-editable")).toBe(false);
    cbscChip?.click();
    await cbsc.updateComplete;
    expect(cbsc.shadowRoot?.querySelector('[data-testid="unit-chip-edit"]')).toBeNull();
  });

  it("\u00a717.136 S13b \u2014 both Computed card classes stamp a `<weight-edit-button slot=\"footer-left\">` carrying the vm.id + the forwarded weight property on the AsChild render branch (AsParent ignores `weight` -- a parent node has no parent-relative weight until the operator drills back out)", async () => {
    const cc = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "EUR" }, "SUM");
      e.viewRole = "asChild";
      e.weight = 1.5;
    });
    const ccBtn = cc.shadowRoot?.querySelector<HTMLElement & { weight: number }>(
      "weight-edit-button",
    );
    expect(ccBtn).not.toBeNull();
    expect(ccBtn?.getAttribute("slot")).toBe("footer-left");
    expect(ccBtn?.getAttribute("node-id")).toBe("c-1");
    expect(ccBtn?.weight).toBe(1.5);

    const cbsc = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => {
        e.vm = cbsnVm({ kind: "numeric", value: 75, unit: "%" });
        e.viewRole = "asChild";
        e.weight = 2.25;
      },
    );
    const cbscBtn = cbsc.shadowRoot?.querySelector<
      HTMLElement & { weight: number }
    >("weight-edit-button");
    expect(cbscBtn).not.toBeNull();
    expect(cbscBtn?.getAttribute("slot")).toBe("footer-left");
    expect(cbscBtn?.getAttribute("node-id")).toBe("cbsn-1");
    expect(cbscBtn?.weight).toBe(2.25);

    // AsParent ignores the weight prop -- no <weight-edit-button>
    // is stamped on the focused-panel render branch.
    const ccParent = await mountLitElement<ComputedCard>(
      "computed-card",
      (e) => {
        e.vm = computedVm({ kind: "numeric", value: 42, unit: "EUR" }, "SUM");
        e.viewRole = "asParent";
        e.weight = 1.5;
      },
    );
    expect(
      ccParent.shadowRoot?.querySelector("weight-edit-button"),
    ).toBeNull();
  });

  it("\u00a717.137 A2b \u2014 CBSN's renderObjectiveRow omits the <target-date-cell> branch when `objective.targetDateIso` is empty; <objective-cell> still renders alongside (mirror of BSC's silent-on-empty-date contract)", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => {
        e.vm = cbsnVm(
          { kind: "numeric", value: 75, unit: "%" },
          "AVERAGE",
          "2026-04-23T18:25:43.511Z",
          { ...FLAT_OBJ, targetDateIso: "" },
        );
      },
    );
    const row = el.shadowRoot?.querySelector('[data-testid="target-row"]');
    expect(row).not.toBeNull();
    expect(row?.querySelector("target-date-cell")).toBeNull();
    expect(row?.querySelector("objective-cell")).not.toBeNull();
  });
});
