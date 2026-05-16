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

async function captureKindChange(el: HTMLElement, newKind: ComputationKindName): Promise<ComputationKindChangeDetail[]> {
  const events: ComputationKindChangeDetail[] = [];
  const listener = ((ev: CustomEvent<ComputationKindChangeDetail>): void => { events.push(ev.detail); }) as EventListener;
  document.addEventListener(COMPUTATION_KIND_CHANGE_EVENT, listener);
  const dropdown = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-testid="kind-dropdown"]')!;
  dropdown.value = newKind;
  dropdown.dispatchEvent(new Event("change"));
  document.removeEventListener(COMPUTATION_KIND_CHANGE_EVENT, listener);
  return events;
}

describe("<computed-card> (\u00a717.104)", () => {
  it("renders title + \u03a3 + numeric value + dropdown preselected, AND empty-reason variant omits the unit slot, AND dispatches computation-kind-change on dropdown change", async () => {
    const okEl = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "numeric", value: 42, unit: "EUR" }, "WEIGHTED_AVERAGE");
    });
    const okSr = okEl.shadowRoot!;
    expect(okSr.querySelector('[data-testid="title"]')?.getAttribute("data-view-kind")).toBe("ComputedNode");
    expect(okSr.querySelector('[data-testid="computed-badge"]')?.textContent).toBe("\u03a3");
    expect(okSr.querySelector('[data-testid="value"]')?.getAttribute("data-value-kind")).toBe("numeric");
    expect(okSr.querySelector('[data-testid="value"]')?.textContent?.replace(/\s+/g, " ").trim()).toBe("42 EUR");
    const dropdown = okSr.querySelector<HTMLSelectElement>('[data-testid="kind-dropdown"]')!;
    expect(dropdown.options.length).toBe(ALL_KINDS.length);
    expect(dropdown.value).toBe("WEIGHTED_AVERAGE");
    expect(await captureKindChange(okEl, "MAX")).toEqual([{ nodeId: "c-1", newKind: "MAX" }]);

    const emptyEl = await mountLitElement<ComputedCard>("computed-card", (e) => {
      e.vm = computedVm({ kind: "empty", reason: "no contributing children" });
    });
    const emptyValue = emptyEl.shadowRoot!.querySelector('[data-testid="value"]');
    expect(emptyValue?.getAttribute("data-value-kind")).toBe("empty");
    expect(emptyValue?.textContent?.trim()).toBe("no contributing children");
    expect(emptyEl.shadowRoot!.querySelector(".unit")).toBeNull();
  });
});

describe("<computed-business-score-card> (\u00a717.104)", () => {
  it("renders the full surface (title + \u03a3 + value + objective row + timestamp + dropdown) when a dateIso is present", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card", (e) => { e.vm = cbsnVm({ kind: "numeric", value: 75, unit: "%" }); },
    );
    const sr = el.shadowRoot!;
    expect(sr.querySelector('[data-testid="title"]')?.getAttribute("data-view-kind")).toBe("ComputedBusinessScoreNode");
    expect(sr.querySelector('[data-testid="computed-badge"]')?.textContent).toBe("\u03a3");
    expect(sr.querySelector('[data-testid="value"]')?.textContent?.replace(/\s+/g, " ").trim()).toBe("75 %");
    const time = sr.querySelector<HTMLTimeElement>('[data-testid="value-date"]');
    expect(time?.getAttribute("datetime")).toBe("2026-04-23T18:25:43.511Z");
    expect(time?.getAttribute("style")).toContain("--age-color: rgb(255, 145, 50)");
    expect(sr.querySelector('[data-testid="target-text"]')?.textContent?.replace(/\s+/g, " ").trim()).toBe("100 %");
    expect(sr.querySelector<HTMLSelectElement>('[data-testid="kind-dropdown"]')!.value).toBe("AVERAGE");
  });

  it("omits the timestamp on empty dateIso, renders the trend arrow, and dispatches computation-kind-change from the BSC variant", async () => {
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card",
      (e) => { e.vm = cbsnVm({ kind: "numeric", value: 50, unit: "%" }, "COUNT", "", { ...FLAT_OBJ, trendArrow: "up-right" }); },
    );
    const sr = el.shadowRoot!;
    expect(sr.querySelector('[data-testid="value-date"]')).toBeNull();
    const arrow = sr.querySelector('[data-testid="trend-arrow"]');
    expect(arrow?.getAttribute("data-direction")).toBe("up-right");
    expect(arrow?.textContent).toBe("\u2197");
    expect(await captureKindChange(el, "WEIGHTED_AVERAGE")).toEqual([{ nodeId: "cbsn-1", newKind: "WEIGHTED_AVERAGE" }]);
  });
});
