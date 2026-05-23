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

  it("renders all five tier buttons; defaults to atoms with placeholder", async () => {
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
    expect($(el, "ds-placeholder").textContent?.trim()).toMatch(/atoms tier/i);
  });

  it("tapping a tier swaps the active tier + placeholder body", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-molecules") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-tier-molecules").classList.contains("active")).toBe(true);
    expect($(el, "ds-tier-atoms").classList.contains("active")).toBe(false);
    expect($(el, "ds-placeholder").textContent?.trim()).toMatch(
      /molecules tier/i,
    );
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
