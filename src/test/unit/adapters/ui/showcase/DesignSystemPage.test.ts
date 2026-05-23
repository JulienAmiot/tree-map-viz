import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/showcase/DesignSystemPage.js";
import {
  DESIGN_SYSTEM_CLOSE_EVENT,
  type DesignSystemPage,
} from "../../../../../adapters/ui/showcase/DesignSystemPage.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function $(el: DesignSystemPage, testid: string): HTMLElement {
  const f = el.shadowRoot?.querySelector<HTMLElement>(
    `[data-testid="${testid}"]`,
  );
  if (!f) throw new Error(`expected element [${testid}]`);
  return f;
}

describe("<design-system-page> (\u00a717.127 A1 \u2014 foundation)", () => {
  it("renders nothing when closed", async () => {
    const el = await mountLitElement<DesignSystemPage>("design-system-page");
    expect(el.shadowRoot?.querySelector("[data-testid='ds-main']")).toBeNull();
  });

  it("renders all five tier buttons and defaults to atoms (active)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    for (const id of ["atoms", "molecules", "organisms", "templates", "pages"]) {
      expect($(el, `ds-tier-${id}`)).toBeTruthy();
    }
    expect($(el, "ds-tier-atoms").classList.contains("active")).toBe(true);
  });

  it("tapping a non-implemented tier swaps the body to the coming-soon placeholder", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-tier-organisms").classList.contains("active")).toBe(true);
    expect($(el, "ds-tier-atoms").classList.contains("active")).toBe(false);
    expect($(el, "ds-placeholder").textContent?.trim()).toMatch(
      /organisms tier/i,
    );
  });

  it("Atoms tier renders four section headers + the 5 colour tokens", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    expect($(el, "ds-atoms-colors")).toBeTruthy();
    expect($(el, "ds-atoms-arrows")).toBeTruthy();
    expect($(el, "ds-atoms-glyphs")).toBeTruthy();
    expect($(el, "ds-atoms-pdca")).toBeTruthy();
    for (const t of ["bg", "panel", "text", "muted", "accent"]) {
      expect($(el, `ds-token-${t}`)).toBeTruthy();
    }
  });

  it("Atoms tier renders all 5 trend arrows + the 4 PDCA badges (\u00a717.127 A2)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const arrowCells = el.shadowRoot!.querySelectorAll(
      "[data-testid^='ds-arrow-']",
    );
    expect(arrowCells.length).toBe(5);
    const arrowGlyphs = Array.from(arrowCells).map(
      (c) => c.querySelector(".big")?.textContent?.trim(),
    );
    expect(arrowGlyphs).toEqual([
      "\u2191",
      "\u2197",
      "\u2192",
      "\u2198",
      "\u2193",
    ]);
    for (const id of ["plan", "do", "check", "act"]) {
      expect($(el, `ds-pdca-${id}`)).toBeTruthy();
    }
  });

  it("Molecules tier renders unit chips, status badges, and disabled affordances (\u00a717.127 A3)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-molecules") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-mol-units")).toBeTruthy();
    expect($(el, "ds-mol-badges")).toBeTruthy();
    expect($(el, "ds-mol-disabled")).toBeTruthy();
    expect(
      $(el, "ds-mol-unit-usd").querySelector("[data-testid='unit-chip']"),
    ).toBeTruthy();
    expect(
      $(el, "ds-mol-unit-empty").querySelector("[data-testid='unit-chip']"),
    ).toBeNull();
    for (const id of ["plan", "do", "check", "act"]) {
      const cell = $(el, `ds-mol-badge-${id}`);
      const badge = cell.querySelector("[data-testid='status-badge']");
      expect(badge?.getAttribute("data-status-id")).toBe(id);
    }
    expect(
      $(el, "ds-mol-disabled-switch-off").querySelector(
        "[data-testid='disabled-switch']",
      ),
    ).toBeTruthy();
  });

  it("Molecules tier silences bubbled `value-node-disabled-change` at the host (\u00a717.127 A3)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-molecules") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped = vi.fn();
    document.addEventListener("value-node-disabled-change", escaped);
    const switchBtn = $(el, "ds-mol-disabled-switch-off").querySelector(
      "[data-testid='disabled-switch']",
    ) as HTMLButtonElement;
    switchBtn.click();
    expect(escaped).not.toHaveBeenCalled();
    document.removeEventListener("value-node-disabled-change", escaped);
  });

  it('"Back to kiosk" dispatches `design-system-close` (bubbles+composed)', async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(DESIGN_SYSTEM_CLOSE_EVENT, handler);
    ($(el, "design-system-close") as HTMLButtonElement).click();
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as CustomEvent | undefined;
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
  });

  it("Escape dispatches when open, no-op when closed", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    const handler = vi.fn();
    el.addEventListener(DESIGN_SYSTEM_CLOSE_EVENT, handler);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
    el.open = false;
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
