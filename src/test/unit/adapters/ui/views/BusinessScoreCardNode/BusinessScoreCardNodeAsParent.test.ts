import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import type { BusinessScoreCardNodeAsParent } from "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsParent.js";
import type { BusinessScoreCardNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function makeVm(value: BusinessScoreCardNodeViewModel["value"]): BusinessScoreCardNodeViewModel {
  return {
    kind: "BusinessScoreCardNode",
    id: "bsc-1",
    title: "Revenue",
    description: "Revenue vs plan",
    value,
  };
}

describe("<business-score-card-as-parent>", () => {
  it("renders Title + Description (always)", async () => {
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
    expect(
      el.shadowRoot?.querySelector('[data-testid="description"]')?.textContent?.trim(),
    ).toBe("Revenue vs plan");
  });

  it("renders the computed mean (1-decimal) + Σ badge for kind=computedMean", async () => {
    const vm = makeVm({ kind: "computedMean", mean: 87.42, unit: "%" });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    const badge = el.shadowRoot?.querySelector('[data-testid="computed-badge"]');
    expect(value?.textContent?.trim()).toBe("87.4 %");
    expect(value?.getAttribute("data-value-kind")).toBe("computedMean");
    expect(badge).not.toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  it("renders value + date (no Σ) for kind=recordedValue", async () => {
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
    const date = el.shadowRoot?.querySelector('[data-testid="value-date"]');
    expect(value?.textContent?.trim()).toBe("100 %");
    expect(value?.getAttribute("data-value-kind")).toBe("recordedValue");
    expect(date?.getAttribute("datetime")).toBe("2026-04-23T18:25:43.511Z");
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
  });

  it('renders "n children" plain text (no Σ, no Unit) for kind=childrenCount, n>0', async () => {
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
  });
});
