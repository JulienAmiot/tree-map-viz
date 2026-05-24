import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/molecules/objective/Objective.js";
import type { ObjectiveCell } from "../../../../../../adapters/ui/molecules/objective/Objective.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

async function mount(targetValue: number, unit: string): Promise<ObjectiveCell> {
  return mountLitElement<ObjectiveCell>("objective-cell", (e) => {
    e.targetValue = targetValue;
    e.unit = unit;
  });
}

function targetText(el: ObjectiveCell): string {
  return (
    el.shadowRoot
      ?.querySelector('[data-testid="target-text"]')
      ?.textContent?.replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

describe("<objective-cell> (\u00a717.137 A1 + A2a)", () => {
  it("renders the bullseye + target value + unit with the testids the per-role CSS expects", async () => {
    const el = await mount(12.5, "%");
    const icon = el.shadowRoot?.querySelector('[data-testid="target-icon"]');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.querySelector("ds-icon")?.getAttribute("name")).toBe("target");
    expect(targetText(el)).toBe("12.5 %");
    expect(
      el.shadowRoot?.querySelector(".target-unit")?.textContent?.endsWith("%"),
    ).toBe(true);
  });

  it("omits the warning glyph when `warningColor` is empty (on-track \u2192 silent, \u00a717.137 A2a)", async () => {
    const el = await mount(80, "EUR");
    expect(
      el.shadowRoot?.querySelector('[data-testid="off-track-warning"]'),
    ).toBeNull();
  });

  it("renders the \u00a717.44 warning glyph tinted by `warningColor` when the trajectory predicts missing the deadline (\u00a717.137 A2a)", async () => {
    const el = await mountLitElement<ObjectiveCell>(
      "objective-cell",
      (e) => {
        e.targetValue = 80;
        e.unit = "EUR";
        e.warningColor = "rgb(255, 80, 80)";
      },
    );
    const warning = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="off-track-warning"]',
    );
    expect(warning).not.toBeNull();
    expect(warning?.getAttribute("role")).toBe("img");
    expect(warning?.getAttribute("aria-label")).toBe(
      "Trajectory predicts missing the deadline",
    );
    expect(warning?.getAttribute("style")).toBe("color: rgb(255, 80, 80)");
    expect(warning?.querySelector("ds-icon")?.getAttribute("name")).toBe(
      "triangle-alert",
    );
  });

  it("re-renders the warning glyph when `warningColor` flips from empty to non-empty (reactive @property, \u00a717.137 A2a)", async () => {
    const el = await mount(50, "%");
    expect(
      el.shadowRoot?.querySelector('[data-testid="off-track-warning"]'),
    ).toBeNull();
    el.warningColor = "rgb(255, 165, 0)";
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector('[data-testid="off-track-warning"]'),
    ).not.toBeNull();
  });

  it("re-renders when `targetValue` is updated (reactive @property)", async () => {
    const el = await mount(10, "EUR");
    expect(targetText(el)).toBe("10 EUR");
    el.targetValue = 42;
    await el.updateComplete;
    expect(targetText(el)).toBe("42 EUR");
  });

  it("supports a unit-less metric (empty unit \u2192 value-only visible label)", async () => {
    const el = await mount(7, "");
    const raw =
      el.shadowRoot?.querySelector('[data-testid="target-text"]')?.textContent ??
      "";
    expect(raw.replace(/\u00a0/g, " ").trim()).toBe("7");
  });

  it("routes the numeric value through the shared `formatValue` atom (2-decimal compact display)", async () => {
    const el = await mount(42.556, "%");
    expect(targetText(el)).toBe("42.56 %");
  });
});
