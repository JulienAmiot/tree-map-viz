import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/shell/BurgerMenu.js";
import {
  BURGER_MENU_ACTION_EVENT,
  BurgerMenu,
  type BurgerMenuActionDetail,
} from "../../../../../adapters/ui/shell/BurgerMenu.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function triggerOf(el: BurgerMenu): HTMLButtonElement {
  const btn = el.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-testid="burger-trigger"]',
  );
  if (!btn) throw new Error("expected burger trigger to be rendered");
  return btn;
}

function menuOf(el: BurgerMenu): HTMLElement {
  const m = el.shadowRoot?.querySelector<HTMLElement>(
    '[data-testid="burger-menu"]',
  );
  if (!m) throw new Error("expected burger menu list to be rendered");
  return m;
}

function itemsOf(el: BurgerMenu): HTMLButtonElement[] {
  return Array.from(
    el.shadowRoot?.querySelectorAll<HTMLButtonElement>(
      '[data-testid="burger-item"]',
    ) ?? [],
  );
}

describe("<burger-menu>", () => {
  it("starts closed (menu hidden, aria-expanded=false)", async () => {
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    expect(menuOf(el).hasAttribute("hidden")).toBe(true);
    expect(triggerOf(el).getAttribute("aria-expanded")).toBe("false");
  });

  it("renders the four items in order: import, export, boards, settings (\u00a717.31)", async () => {
    // SPEC §17.31 — Settings… joins Import / Export / Boards as the
    // fourth burger-menu item. It opens `<board-settings-modal>` for
    // the current board (name / fresh-date colour / delete-board).
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    triggerOf(el).click();
    await el.updateComplete;
    const items = itemsOf(el);
    expect(items.map((i) => i.dataset["action"])).toEqual([
      "import",
      "export",
      "boards",
      "settings",
    ]);
    expect(items.map((i) => i.textContent?.trim())).toEqual([
      "Import…",
      "Export…",
      "Boards…",
      "Settings…",
    ]);
  });

  it("clicking the Settings\u2026 item dispatches burger-menu-action with action='settings' (\u00a717.31)", async () => {
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    const handler = vi.fn();
    el.addEventListener(BURGER_MENU_ACTION_EVENT, handler);
    triggerOf(el).click();
    await el.updateComplete;

    const settingsItem = itemsOf(el).find(
      (i) => i.dataset["action"] === "settings",
    )!;
    expect(settingsItem).not.toBeUndefined();
    settingsItem.click();
    await el.updateComplete;

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<BurgerMenuActionDetail>
      | undefined;
    expect(evt?.detail.action).toBe("settings");
    expect(menuOf(el).hasAttribute("hidden")).toBe(true);
  });

  it("clicking the trigger toggles the menu open / closed", async () => {
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    triggerOf(el).click();
    await el.updateComplete;
    expect(menuOf(el).hasAttribute("hidden")).toBe(false);
    expect(triggerOf(el).getAttribute("aria-expanded")).toBe("true");

    triggerOf(el).click();
    await el.updateComplete;
    expect(menuOf(el).hasAttribute("hidden")).toBe(true);
    expect(triggerOf(el).getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking an item dispatches `burger-menu-action` with that action AND closes the menu", async () => {
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    const handler = vi.fn();
    el.addEventListener(BURGER_MENU_ACTION_EVENT, handler);
    triggerOf(el).click();
    await el.updateComplete;

    const exportItem = itemsOf(el).find(
      (i) => i.dataset["action"] === "export",
    )!;
    exportItem.click();
    await el.updateComplete;

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<BurgerMenuActionDetail>
      | undefined;
    expect(evt?.detail.action).toBe("export");
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
    expect(menuOf(el).hasAttribute("hidden")).toBe(true);
  });

  it("a tap outside the burger host while open closes the menu", async () => {
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    triggerOf(el).click();
    await el.updateComplete;
    expect(menuOf(el).hasAttribute("hidden")).toBe(false);

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    try {
      outside.click();
      await el.updateComplete;
      expect(menuOf(el).hasAttribute("hidden")).toBe(true);
    } finally {
      outside.remove();
    }
  });

  it("a tap inside the menu (on an item) does NOT trigger the outside-tap close path (the item handler handles closing)", async () => {
    // Verifies that the outside-click logic correctly identifies clicks within
    // the host's composed path as inside, even when the click target lives in
    // the burger's shadow root.
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    const handler = vi.fn();
    el.addEventListener(BURGER_MENU_ACTION_EVENT, handler);
    triggerOf(el).click();
    await el.updateComplete;

    const importItem = itemsOf(el).find(
      (i) => i.dataset["action"] === "import",
    )!;
    importItem.click();
    await el.updateComplete;

    // Exactly one event fired (from the item handler), not double-fired by an
    // outside-click misclassification.
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as
      | CustomEvent<BurgerMenuActionDetail>
      | undefined;
    expect(evt?.detail.action).toBe("import");
  });

  it("popup uses position: fixed and is anchored to the trigger on open (\u00a717.21)", async () => {
    // SPEC §17.21 — the popup must escape the drawer panel's overflow:
    // hidden, which we achieve by switching from absolute → fixed
    // positioning and computing top/right from the trigger's bbox on
    // open. jsdom doesn't run a layout engine, so getBoundingClientRect
    // returns zeroes by default; we stub it to a realistic position to
    // pin the contract.
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    const trigger = triggerOf(el);
    trigger.getBoundingClientRect = (): DOMRect =>
      ({
        top: 16,
        right: 1264,
        bottom: 56,
        left: 1226,
        width: 38,
        height: 40,
        x: 1226,
        y: 16,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(window, "innerWidth", {
      value: 1280,
      configurable: true,
    });

    trigger.click();
    await el.updateComplete;

    const menu = menuOf(el);
    // jsdom doesn't compute styles from <style> rules inside a shadow
    // root (same constraint §17.17 documented). Pin the position rule
    // at the source: read BurgerMenu.styles.cssText.
    const cssText = String(
      (BurgerMenu.styles as unknown as { cssText?: string }).cssText ??
        BurgerMenu.styles,
    );
    expect(cssText).toMatch(/\.menu\b[\s\S]*position:\s*fixed/);
    // top is the trigger's bottom + the 4 px gap; right is viewport - trigger.right.
    expect(menu.style.top).toBe("60px");
    expect(menu.style.right).toBe("16px");
  });

  it("re-anchors the popup on viewport resize while open (kiosk rotation)", async () => {
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    const trigger = triggerOf(el);
    let rect: DOMRect = {
      top: 16,
      right: 1264,
      bottom: 56,
      left: 1226,
      width: 38,
      height: 40,
      x: 1226,
      y: 16,
      toJSON: () => ({}),
    } as DOMRect;
    trigger.getBoundingClientRect = (): DOMRect => rect;
    Object.defineProperty(window, "innerWidth", {
      value: 1280,
      configurable: true,
    });
    trigger.click();
    await el.updateComplete;
    expect(menuOf(el).style.right).toBe("16px");

    // Simulate the kiosk rotating to portrait — the trigger now sits at
    // a different screen X.
    rect = {
      top: 16,
      right: 700,
      bottom: 56,
      left: 662,
      width: 38,
      height: 40,
      x: 662,
      y: 16,
      toJSON: () => ({}),
    } as DOMRect;
    Object.defineProperty(window, "innerWidth", {
      value: 720,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));
    await el.updateComplete;
    expect(menuOf(el).style.right).toBe("20px");
  });

  it("Escape closes the menu when open and is a no-op when closed", async () => {
    const el = await mountLitElement<BurgerMenu>("burger-menu");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect(menuOf(el).hasAttribute("hidden")).toBe(true);

    triggerOf(el).click();
    await el.updateComplete;
    expect(menuOf(el).hasAttribute("hidden")).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect(menuOf(el).hasAttribute("hidden")).toBe(true);
  });
});
