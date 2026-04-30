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
  it("renders Title (\u00a717.14 — description is no longer rendered in the tile)", async () => {
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
    expect(el.shadowRoot?.querySelector('[data-testid="description"]')).toBeNull();
  });

  it("renders the computed mean (1-decimal) + Σ badge for kind=computedMean — no timestamp", async () => {
    const vm = makeVm({ kind: "computedMean", mean: 87.42, unit: "%" });
    const el = await mountLitElement<BusinessScoreCardNodeAsParent>(
      "business-score-card-as-parent",
      (e) => {
        e.vm = vm;
      },
    );

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    const badge = el.shadowRoot?.querySelector('[data-testid="computed-badge"]');
    // The value text now embeds the unit at 1/3 size in a child <span>;
    // .textContent flattens children, so we still see "87.4 %".
    expect(value?.textContent?.replace(/\s+/g, " ").trim()).toBe("87.4 %");
    expect(value?.getAttribute("data-value-kind")).toBe("computedMean");
    expect(badge).not.toBeNull();
    // §17.14 — no timestamp for derived (computed) values.
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
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

  it("renders value + corner timestamp (no Σ) for kind=recordedValue", async () => {
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
    expect(value?.textContent?.replace(/\s+/g, " ").trim()).toBe("100 %");
    expect(value?.getAttribute("data-value-kind")).toBe("recordedValue");
    expect(date?.getAttribute("datetime")).toBe("2026-04-23T18:25:43.511Z");
    expect(date?.classList.contains("timestamp")).toBe(true);
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
});
