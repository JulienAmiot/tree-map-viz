import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsChild.js";
import type { BusinessScoreCardNodeAsChild } from "../../../../../../adapters/ui/views/BusinessScoreCardNode/BusinessScoreCardNodeAsChild.js";
import type { BusinessScoreCardNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function makeVm(value: BusinessScoreCardNodeViewModel["value"]): BusinessScoreCardNodeViewModel {
  return {
    kind: "BusinessScoreCardNode",
    id: "bsc-c",
    title: "Sales",
    description: "Region",
    value,
  };
}

describe("<business-score-card-as-child>", () => {
  it("renders Σ for computed values, same as AsParent (\u00a75 — uniform fields across roles)", async () => {
    const vm = makeVm({ kind: "computedMean", mean: 50, unit: "%" });
    const el = await mountLitElement<BusinessScoreCardNodeAsChild>(
      "business-score-card-as-child",
      (e) => {
        e.vm = vm;
      },
    );

    expect(
      el.shadowRoot
        ?.querySelector('[data-testid="value"]')
        ?.textContent?.replace(/\s+/g, " ")
        .trim(),
    ).toBe("50.0 %");
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).not.toBeNull();
  });

  it("does not render Σ for recordedValue, but does render the corner timestamp", async () => {
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
});
