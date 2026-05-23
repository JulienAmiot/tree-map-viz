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
    ($(el, "ds-tier-templates") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-tier-templates").classList.contains("active")).toBe(true);
    expect($(el, "ds-tier-atoms").classList.contains("active")).toBe(false);
    expect($(el, "ds-placeholder").textContent?.trim()).toMatch(
      /templates tier/i,
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

  it("Organisms tier mounts the real burger / breadcrumb / plus elements (\u00a717.127 A4a)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    expect($(el, "ds-org-burger-cell").querySelector("burger-menu")).toBeTruthy();
    const crumb = $(el, "ds-org-breadcrumb-cell").querySelector(
      "focus-breadcrumb",
    ) as { path?: ReadonlyArray<{ id: string; title: string }> } | null;
    expect(crumb?.path?.length).toBe(3);
    expect(crumb?.path?.[2].title).toBe("Pager fatigue");
    const plus = $(el, "ds-org-plus-cell").querySelector(
      "plus-tile",
    ) as HTMLElement | null;
    expect(plus?.getAttribute("parent-id")).toBe("ds-demo-parent");
  });

  it("Organisms tier silences burger / breadcrumb / plus events at the host (\u00a717.127 A4a)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped: string[] = [];
    const listener = (ev: Event) => escaped.push(ev.type);
    for (const t of [
      "burger-menu-action",
      "breadcrumb-navigate",
      "plus-tile-activate",
    ]) {
      document.addEventListener(t, listener);
    }
    el.shadowRoot
      ?.querySelector("burger-menu")
      ?.dispatchEvent(
        new CustomEvent("burger-menu-action", {
          bubbles: true,
          composed: true,
          detail: { action: "about" },
        }),
      );
    el.shadowRoot
      ?.querySelector("focus-breadcrumb")
      ?.dispatchEvent(
        new CustomEvent("breadcrumb-navigate", {
          bubbles: true,
          composed: true,
          detail: { nodeId: "ds-root" },
        }),
      );
    el.shadowRoot
      ?.querySelector("plus-tile")
      ?.dispatchEvent(
        new CustomEvent("plus-tile-activate", {
          bubbles: true,
          composed: true,
          detail: { parentId: "ds-demo-parent" },
        }),
      );
    expect(escaped).toEqual([]);
    for (const t of [
      "burger-menu-action",
      "breadcrumb-navigate",
      "plus-tile-activate",
    ]) {
      document.removeEventListener(t, listener);
    }
  });

  it("Organisms tier mounts BSC AsParent + AsChild with sample VMs (\u00a717.127 A4b-1)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const asParent = $(el, "ds-org-bsc-asparent-cell").querySelector(
      "business-score-card-as-parent",
    ) as { vm?: { id: string; title: string } | null } | null;
    expect(asParent?.vm?.id).toBe("ds-bsc-on-track");
    expect(asParent?.vm?.title).toBe("Quarterly revenue");
    const asChild = $(el, "ds-org-bsc-aschild-cell").querySelector(
      "business-score-card-as-child",
    ) as { vm?: { id: string; value: { kind: string } } | null } | null;
    expect(asChild?.vm?.id).toBe("ds-bsc-off-track");
    expect(asChild?.vm?.value.kind).toBe("computedMean");
  });

  it("Organisms tier silences inline-edit-* bubbles dispatched from BSC tiles (\u00a717.127 A4b-1)", async () => {
    const el = await mountLitElement<DesignSystemPage>(
      "design-system-page",
      (e) => {
        e.open = true;
      },
    );
    ($(el, "ds-tier-organisms") as HTMLButtonElement).click();
    await el.updateComplete;
    const escaped: string[] = [];
    const listener = (ev: Event) => escaped.push(ev.type);
    for (const t of [
      "inline-edit-title",
      "inline-edit-value",
      "inline-edit-unit",
    ]) {
      document.addEventListener(t, listener);
    }
    const tile = el.shadowRoot?.querySelector("business-score-card-as-parent");
    for (const t of [
      "inline-edit-title",
      "inline-edit-value",
      "inline-edit-unit",
    ]) {
      tile?.dispatchEvent(
        new CustomEvent(t, {
          bubbles: true,
          composed: true,
          detail: { nodeId: "ds-bsc-on-track", trimmed: "demo" },
        }),
      );
    }
    expect(escaped).toEqual([]);
    for (const t of [
      "inline-edit-title",
      "inline-edit-value",
      "inline-edit-unit",
    ]) {
      document.removeEventListener(t, listener);
    }
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
