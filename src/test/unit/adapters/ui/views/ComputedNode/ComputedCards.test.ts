import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/ComputedNode/ComputedCards.js";
import {
  COMPUTATION_KIND_CHANGE_EVENT,
  type ComputationKindChangeDetail,
  type ComputedBusinessScoreCard,
  type ComputedCard,
} from "../../../../../../adapters/ui/views/ComputedNode/ComputedCards.js";
import type {
  BusinessScoreCardObjectiveViewModel,
  ComputationKindName,
  ComputedBusinessScoreNodeViewModel,
  ComputedNodeViewModel,
  ComputedValueViewModel,
} from "../../../../../../adapters/ui/views/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const ALL_KINDS: readonly ComputationKindName[] = [
  "SUM", "AVERAGE", "MIN", "MAX", "WEIGHTED_AVERAGE", "COUNT",
];

const FLAT_OBJECTIVE: BusinessScoreCardObjectiveViewModel = {
  targetValue: 100,
  targetDateIso: "2026-12-31T00:00:00.000Z",
  unit: "%",
  valueColor: "",
  warningColor: "",
  trendArrow: null,
};

function makeComputedVm(
  value: ComputedValueViewModel,
  kind: ComputationKindName = "SUM",
): ComputedNodeViewModel {
  return {
    kind: "ComputedNode",
    id: "c-1",
    title: "Total revenue",
    value,
    computationKind: kind,
    availableKinds: ALL_KINDS,
  };
}

function makeCbsnVm(
  value: ComputedValueViewModel,
  kind: ComputationKindName = "AVERAGE",
  dateIso = "2026-04-23T18:25:43.511Z",
  objective: BusinessScoreCardObjectiveViewModel = FLAT_OBJECTIVE,
): ComputedBusinessScoreNodeViewModel {
  return {
    kind: "ComputedBusinessScoreNode",
    id: "cbsn-1",
    title: "Avg score",
    description: "Quarter rollup",
    value,
    computationKind: kind,
    availableKinds: ALL_KINDS,
    dateIso,
    dateColor: dateIso ? "rgb(255, 145, 50)" : "",
    objective,
  };
}

describe("<computed-card> (\u00a717.104)", () => {
  it("renders title + \u03a3 badge + numeric value + kind dropdown with the current kind preselected", async () => {
    const vm = makeComputedVm({ kind: "numeric", value: 42, unit: "EUR" }, "WEIGHTED_AVERAGE");
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => { e.vm = vm; });
    const sr = el.shadowRoot!;

    const title = sr.querySelector('[data-testid="title"]');
    expect(title?.textContent?.trim()).toBe("Total revenue");
    expect(title?.getAttribute("data-view-kind")).toBe("ComputedNode");
    expect(sr.querySelector('[data-testid="computed-badge"]')?.textContent).toBe("\u03a3");
    const value = sr.querySelector('[data-testid="value"]');
    expect(value?.getAttribute("data-value-kind")).toBe("numeric");
    expect(value?.textContent?.replace(/\s+/g, " ").trim()).toBe("42 EUR");
    const dropdown = sr.querySelector<HTMLSelectElement>('[data-testid="kind-dropdown"]');
    expect(dropdown).not.toBeNull();
    expect(dropdown!.options.length).toBe(ALL_KINDS.length);
    expect(dropdown!.value).toBe("WEIGHTED_AVERAGE");
  });

  it("renders the empty-reason text on an empty value (no children) and omits the unit slot", async () => {
    const vm = makeComputedVm({ kind: "empty", reason: "no contributing children" });
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => { e.vm = vm; });
    const value = el.shadowRoot!.querySelector('[data-testid="value"]');

    expect(value?.getAttribute("data-value-kind")).toBe("empty");
    expect(value?.textContent?.trim()).toBe("no contributing children");
    expect(el.shadowRoot!.querySelector(".unit")).toBeNull();
  });

  it("dispatches a bubbling+composed computation-kind-change event with the new kind when the dropdown changes", async () => {
    const vm = makeComputedVm({ kind: "numeric", value: 1, unit: "" }, "SUM");
    const el = await mountLitElement<ComputedCard>("computed-card", (e) => { e.vm = vm; });
    const events: ComputationKindChangeDetail[] = [];
    const listener = ((ev: CustomEvent<ComputationKindChangeDetail>): void => {
      events.push(ev.detail);
    }) as EventListener;
    document.addEventListener(COMPUTATION_KIND_CHANGE_EVENT, listener);

    const dropdown = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-testid="kind-dropdown"]')!;
    dropdown.value = "MAX";
    dropdown.dispatchEvent(new Event("change"));

    document.removeEventListener(COMPUTATION_KIND_CHANGE_EVENT, listener);
    expect(events).toEqual([{ nodeId: "c-1", newKind: "MAX" }]);
  });
});

describe("<computed-business-score-card> (\u00a717.104)", () => {
  it("renders title + \u03a3 + numeric value + objective row + timestamp + dropdown when a dateIso is present", async () => {
    const vm = makeCbsnVm({ kind: "numeric", value: 75, unit: "%" });
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card", (e) => { e.vm = vm; },
    );
    const sr = el.shadowRoot!;

    expect(sr.querySelector('[data-testid="title"]')?.getAttribute("data-view-kind"))
      .toBe("ComputedBusinessScoreNode");
    expect(sr.querySelector('[data-testid="computed-badge"]')?.textContent).toBe("\u03a3");
    expect(sr.querySelector('[data-testid="value"]')?.textContent?.replace(/\s+/g, " ").trim())
      .toBe("75 %");
    const time = sr.querySelector<HTMLTimeElement>('[data-testid="value-date"]');
    expect(time?.getAttribute("datetime")).toBe("2026-04-23T18:25:43.511Z");
    expect(time?.getAttribute("style")).toContain("--age-color: rgb(255, 145, 50)");
    expect(sr.querySelector('[data-testid="target-row"]')).not.toBeNull();
    expect(sr.querySelector('[data-testid="target-text"]')?.textContent?.replace(/\s+/g, " ").trim())
      .toBe("100 %");
    expect(sr.querySelector<HTMLSelectElement>('[data-testid="kind-dropdown"]')!.value).toBe("AVERAGE");
  });

  it("omits the corner timestamp on empty dateIso and renders the trend arrow with the given direction", async () => {
    const vm = makeCbsnVm(
      { kind: "numeric", value: 50, unit: "%" }, "MIN", "",
      { ...FLAT_OBJECTIVE, trendArrow: "up-right" },
    );
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card", (e) => { e.vm = vm; },
    );
    const sr = el.shadowRoot!;

    expect(sr.querySelector('[data-testid="value-date"]')).toBeNull();
    const arrow = sr.querySelector('[data-testid="trend-arrow"]');
    expect(arrow?.getAttribute("data-direction")).toBe("up-right");
    expect(arrow?.textContent).toBe("\u2197");
  });

  it("dispatches computation-kind-change from the BSC variant too — same event contract as <computed-card>", async () => {
    const vm = makeCbsnVm({ kind: "numeric", value: 1, unit: "%" }, "COUNT");
    const el = await mountLitElement<ComputedBusinessScoreCard>(
      "computed-business-score-card", (e) => { e.vm = vm; },
    );
    const events: ComputationKindChangeDetail[] = [];
    const listener = ((ev: CustomEvent<ComputationKindChangeDetail>): void => {
      events.push(ev.detail);
    }) as EventListener;
    document.addEventListener(COMPUTATION_KIND_CHANGE_EVENT, listener);

    const dropdown = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-testid="kind-dropdown"]')!;
    dropdown.value = "WEIGHTED_AVERAGE";
    dropdown.dispatchEvent(new Event("change"));

    document.removeEventListener(COMPUTATION_KIND_CHANGE_EVENT, listener);
    expect(events).toEqual([{ nodeId: "cbsn-1", newKind: "WEIGHTED_AVERAGE" }]);
  });
});
