import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/shell/Drawer.js";
import {
  type AppDrawer,
  DRAWER_TOGGLE_EVENT,
  type DrawerToggleDetail,
} from "../../../../../adapters/ui/shell/Drawer.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function handleOf(el: AppDrawer): HTMLButtonElement {
  const handle = el.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-testid="drawer-handle"]',
  );
  if (!handle) throw new Error("expected drawer handle to be rendered");
  return handle;
}

function panelOf(el: AppDrawer): HTMLElement {
  const panel = el.shadowRoot?.querySelector<HTMLElement>(
    '[data-testid="drawer-panel"]',
  );
  if (!panel) throw new Error("expected drawer panel to be rendered");
  return panel;
}

describe("<app-drawer>", () => {
  it("starts closed (open=false, aria-expanded=false, aria-hidden=true)", async () => {
    const el = await mountLitElement<AppDrawer>("app-drawer");
    expect(el.open).toBe(false);
    expect(el.hasAttribute("open")).toBe(false);
    expect(handleOf(el).getAttribute("aria-expanded")).toBe("false");
    expect(panelOf(el).getAttribute("aria-hidden")).toBe("true");
  });

  it("renders slotted content (board-name, breadcrumb, burger ride inside the panel)", async () => {
    const el = await mountLitElement<AppDrawer>("app-drawer");
    el.innerHTML = `<span data-testid="probe">hello</span>`;
    await el.updateComplete;
    const probe = el.querySelector('[data-testid="probe"]');
    expect(probe).not.toBeNull();
    // The slot lives inside the panel, so light-DOM children are projected there.
    const slot = el.shadowRoot?.querySelector("slot");
    expect(slot).not.toBeNull();
    expect(slot?.assignedNodes({ flatten: true })).toContain(probe);
  });

  it("tapping the handle opens then closes the drawer", async () => {
    const el = await mountLitElement<AppDrawer>("app-drawer");
    handleOf(el).click();
    await el.updateComplete;
    expect(el.open).toBe(true);
    expect(el.hasAttribute("open")).toBe(true);
    expect(handleOf(el).getAttribute("aria-expanded")).toBe("true");
    expect(panelOf(el).getAttribute("aria-hidden")).toBe("false");

    handleOf(el).click();
    await el.updateComplete;
    expect(el.open).toBe(false);
    expect(el.hasAttribute("open")).toBe(false);
  });

  it("dispatches a bubbling+composed `drawer-toggle` event on every state change", async () => {
    const el = await mountLitElement<AppDrawer>("app-drawer");
    const handler = vi.fn();
    el.addEventListener(DRAWER_TOGGLE_EVENT, handler);

    handleOf(el).click();
    await el.updateComplete;
    handleOf(el).click();
    await el.updateComplete;

    expect(handler).toHaveBeenCalledTimes(2);
    const first = handler.mock.calls[0]?.[0] as
      | CustomEvent<DrawerToggleDetail>
      | undefined;
    const second = handler.mock.calls[1]?.[0] as
      | CustomEvent<DrawerToggleDetail>
      | undefined;
    expect(first?.detail.open).toBe(true);
    expect(second?.detail.open).toBe(false);
    expect(first?.bubbles).toBe(true);
    expect(first?.composed).toBe(true);
  });

  it("does NOT dispatch when explicitly setting open to its current value (idempotent setOpen)", async () => {
    // Public API only exposes `toggle` + the property; the internal setter is
    // protected against no-op events. Verifying via the property is the
    // observable contract.
    const el = await mountLitElement<AppDrawer>("app-drawer");
    const handler = vi.fn();
    el.addEventListener(DRAWER_TOGGLE_EVENT, handler);
    el.open = false;
    await el.updateComplete;
    expect(handler).not.toHaveBeenCalled();
  });

  it("a tap outside the drawer host while open closes it", async () => {
    const el = await mountLitElement<AppDrawer>("app-drawer");
    handleOf(el).click();
    await el.updateComplete;
    expect(el.open).toBe(true);

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    try {
      outside.click();
      await el.updateComplete;
      expect(el.open).toBe(false);
    } finally {
      outside.remove();
    }
  });

  it("a tap inside the slotted content does NOT close the drawer", async () => {
    const el = await mountLitElement<AppDrawer>("app-drawer");
    el.innerHTML = `<button data-testid="inner">x</button>`;
    handleOf(el).click();
    await el.updateComplete;
    expect(el.open).toBe(true);

    const inner = el.querySelector<HTMLButtonElement>(
      '[data-testid="inner"]',
    );
    inner?.click();
    await el.updateComplete;
    expect(el.open).toBe(true);
  });

  it("Escape closes the drawer when open and is a no-op when closed", async () => {
    const el = await mountLitElement<AppDrawer>("app-drawer");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect(el.open).toBe(false);

    handleOf(el).click();
    await el.updateComplete;
    expect(el.open).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await el.updateComplete;
    expect(el.open).toBe(false);
  });

  it("removes its document listeners on disconnect (no leaks across mounts)", async () => {
    const el = await mountLitElement<AppDrawer>("app-drawer");
    handleOf(el).click();
    await el.updateComplete;
    expect(el.open).toBe(true);
    el.remove();

    // Now a body click should not flip the (detached) drawer's state — but more
    // importantly, mounting a fresh drawer should not see the previous
    // listener still firing.
    document.body.click();
    expect(el.open).toBe(true); // detached element retains its last state.
  });
});
