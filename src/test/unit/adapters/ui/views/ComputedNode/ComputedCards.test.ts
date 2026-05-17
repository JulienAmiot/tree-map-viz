import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/ComputedNode/ComputedCards.js";
import {
  COMPUTATION_KIND_CHANGE_EVENT, type ComputationKindChangeDetail,
  type ComputedBusinessScoreCard, type ComputedCard,
} from "../../../../../../adapters/ui/views/ComputedNode/ComputedCards.js";
import type {
  BusinessScoreCardObjectiveViewModel, ComputationKindName,
  ComputedBusinessScoreNodeViewModel, ComputedNodeViewModel, ComputedValueViewModel,
} from "../../../../../../adapters/ui/views/NodeViewModel.js";
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
  it("\u00a717.116 — \u03a3 prefixes the title; numeric value renders without inline unit; unit appears in a .unit-below block (\u00a717.116-followup-2 retires the kind-label)", async () => {
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "EUR" }, "WEIGHTED_AVERAGE");
    });
    const sr = el.shadowRoot!;
    const title = sr.querySelector('[data-testid="title"]');
    expect(title?.getAttribute("data-view-kind")).toBe("ComputedNode");
    // SPEC §17.116 — Σ is now a prefix INSIDE the title row, not a chip next to the value.
    expect(title?.querySelector('[data-testid="computed-badge"]')?.textContent).toBe("\u03a3");
    expect(title?.textContent?.trim()).toBe("\u03a3Total revenue");
    // Value text is the bare number with max 2 decimals (no trailing zero, no inline unit).
    expect(sr.querySelector('[data-testid="value"]')?.getAttribute("data-value-kind")).toBe("numeric");
    expect(sr.querySelector('[data-testid="value"]')?.textContent?.trim()).toBe("42");
    // Unit sits in its own block-level sibling under the value.
    expect(sr.querySelector('[data-testid="unit"]')?.textContent?.trim()).toBe("EUR");
    // SPEC §17.116-followup-2 — the static kind-label sibling is retired (was a
    // §17.116c addition replacing the §17.104 inline dropdown). Neither variant
    // renders on the tile any more.
    expect(sr.querySelector('[data-testid="kind-label"]')).toBeNull();
    expect(sr.querySelector('[data-testid="kind-dropdown"]')).toBeNull();
  });

  it("\u00a717.116 — empty branch renders a full-tile .warning-fill (no value/computed-badge spans)", async () => {
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
    expect(sr.querySelector('[data-testid="unit"]')).toBeNull();
    // Title still renders as the tile's identity. SPEC §17.116-followup-2
    // retired the kind-label entirely.
    expect(sr.querySelector('[data-testid="title"]')).not.toBeNull();
    expect(sr.querySelector('[data-testid="kind-label"]')).toBeNull();
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
});

describe("<computed-business-score-card> (\u00a717.104 + \u00a717.116)", () => {
  it("\u00a717.116 — full surface: \u03a3 title prefix, value (no inline unit, no trailing zero), unit-below, target row, age timestamp, metric-pane wrapper (\u00a717.116-followup-2 retires the kind-label)", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card", (e) => { e.vm = cbsnVm({ kind: "numeric", value: 75, unit: "%" }); },
    );
    const sr = el.shadowRoot!;
    const title = sr.querySelector('[data-testid="title"]');
    expect(title?.getAttribute("data-view-kind")).toBe("ComputedBusinessScoreNode");
    expect(title?.querySelector('[data-testid="computed-badge"]')?.textContent).toBe("\u03a3");
    expect(title?.textContent?.trim()).toBe("\u03a3Avg score");
    expect(sr.querySelector('[data-testid="value"]')?.textContent?.trim()).toBe("75");
    expect(sr.querySelector('[data-testid="unit"]')?.textContent?.trim()).toBe("%");
    const time = sr.querySelector<HTMLTimeElement>('[data-testid="value-date"]');
    expect(time?.getAttribute("datetime")).toBe("2026-04-23T18:25:43.511Z");
    expect(time?.getAttribute("style")).toContain("--age-color: rgb(255, 145, 50)");
    // Timestamp text is now an age phrase, NOT a locale date — the exact age depends on `new Date()`,
    // but the rendered label must NOT match any "YYYY"-style locale date string.
    expect(time?.textContent ?? "").not.toMatch(/\d{4}/);
    expect(sr.querySelector('[data-testid="target-text"]')?.textContent?.replace(/\s+/g, " ").trim()).toBe("100 %");
    const pane = sr.querySelector('[data-testid="metric-pane"]');
    expect(pane).not.toBeNull();
    expect(pane?.contains(time!)).toBe(true);
    // SPEC §17.116-followup-2 — neither the inline kind-dropdown
    // (pre-§17.116c) nor the static kind-label (§17.116c → followup-2)
    // surfaces on the CBSN tile any more.
    expect(sr.querySelector('[data-testid="kind-label"]')).toBeNull();
    expect(sr.querySelector('[data-testid="kind-dropdown"]')).toBeNull();
  });

  it("\u00a717.116 — CBSN childrenCount (any n) and empty branches all render the .warning-fill (no value, no timestamp, no target row)", async () => {
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
      // Title survives across all non-numeric branches; the
      // kind-label was retired entirely in §17.116-followup-2.
      expect(sr.querySelector('[data-testid="title"]')).not.toBeNull();
      expect(sr.querySelector('[data-testid="kind-label"]')).toBeNull();
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
    expect(arrow?.textContent).toBe("\u2197");
  });
});
