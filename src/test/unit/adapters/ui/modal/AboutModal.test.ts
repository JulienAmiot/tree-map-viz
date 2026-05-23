import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/modal/AboutModal.js";
import {
  ABOUT_CANCEL_EVENT,
  ABOUT_OPEN_DESIGN_SYSTEM_EVENT,
  type AboutModal,
} from "../../../../../adapters/ui/modal/AboutModal.js";
import { APP_VERSION, BUILD_DATE } from "../../../../../version.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function fieldOf(el: AboutModal, testid: string): HTMLElement {
  const f = el.shadowRoot?.querySelector<HTMLElement>(
    `[data-testid="${testid}"]`,
  );
  if (!f) throw new Error(`expected element [${testid}]`);
  return f;
}

describe("<about-modal> (\u00a717.84)", () => {
  it("renders nothing when closed", async () => {
    const el = await mountLitElement<AboutModal>("about-modal");
    expect(el.shadowRoot?.querySelector("[data-testid='about-modal']")).toBeNull();
  });

  it("renders version + build date + safe repo link when open", async () => {
    const el = await mountLitElement<AboutModal>("about-modal", (e) => {
      e.open = true;
    });
    expect(fieldOf(el, "about-version").textContent?.trim()).toBe(`v${APP_VERSION}`);
    expect(fieldOf(el, "about-build-date").textContent?.trim()).toBe(BUILD_DATE);
    const link = fieldOf(el, "about-repo-link") as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(
      "https://github.com/JulienAmiot/tree-map-viz",
    );
    expect(link.target).toBe("_blank");
    const rel = link.getAttribute("rel") ?? "";
    expect(rel).toMatch(/\bnoopener\b/);
    expect(rel).toMatch(/\bnoreferrer\b/);
  });

  it("renders a safe Changelog link to CHANGELOG.md on master (\u00a717.87)", async () => {
    const el = await mountLitElement<AboutModal>("about-modal", (e) => {
      e.open = true;
    });
    const link = fieldOf(el, "about-changelog-link") as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(
      "https://github.com/JulienAmiot/tree-map-viz/blob/master/CHANGELOG.md",
    );
    expect(link.target).toBe("_blank");
    const rel = link.getAttribute("rel") ?? "";
    expect(rel).toMatch(/\bnoopener\b/);
    expect(rel).toMatch(/\bnoreferrer\b/);
  });

  it("Close / close-X / backdrop dispatch `about-cancel` (bubbles+composed)", async () => {
    const el = await mountLitElement<AboutModal>("about-modal", (e) => {
      e.open = true;
    });
    const handler = vi.fn();
    el.addEventListener(ABOUT_CANCEL_EVENT, handler);
    (fieldOf(el, "modal-cancel") as HTMLButtonElement).click();
    (fieldOf(el, "modal-close-x") as HTMLButtonElement).click();
    (fieldOf(el, "modal-backdrop") as HTMLElement).click();
    expect(handler).toHaveBeenCalledTimes(3);
    const evt = handler.mock.calls[0]?.[0] as CustomEvent | undefined;
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
  });

  it("Open design system\u2026 button dispatches `about-open-design-system` (\u00a717.127)", async () => {
    const el = await mountLitElement<AboutModal>("about-modal", (e) => {
      e.open = true;
    });
    const handler = vi.fn();
    el.addEventListener(ABOUT_OPEN_DESIGN_SYSTEM_EVENT, handler);
    (fieldOf(el, "about-open-design-system") as HTMLButtonElement).click();
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0]?.[0] as CustomEvent | undefined;
    expect(evt?.bubbles).toBe(true);
    expect(evt?.composed).toBe(true);
  });

  it("Escape dispatches when open, no-op when closed", async () => {
    const el = await mountLitElement<AboutModal>("about-modal", (e) => {
      e.open = true;
    });
    const handler = vi.fn();
    el.addEventListener(ABOUT_CANCEL_EVENT, handler);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
    el.open = false;
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
