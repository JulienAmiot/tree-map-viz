import { afterEach, describe, expect, it, vi } from "vitest";

import {
  modalFrameStyles,
  renderModalCloseX,
} from "../../../../../adapters/ui/atoms/modalFrameStyles.js";
import "../../../../../adapters/ui/organisms/modal/AddChildModal.js";
import "../../../../../adapters/ui/organisms/modal/EditNodeModal.js";
import type { AddChildModal } from "../../../../../adapters/ui/organisms/modal/AddChildModal.js";
import type { EditNodeModal } from "../../../../../adapters/ui/organisms/modal/EditNodeModal.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

/**
 * SPEC §17.29 — the shared modal frame is the source of truth for
 * "what every modal in the app looks like". These tests pin the
 * contract at the module boundary so a future third modal that
 * imports `modalFrameStyles` can rely on the same shape:
 *
 *   - The shared stylesheet declares the panel's viewport-cap rule
 *     (`max-width: calc(100vw - 4rem)` / `max-height: calc(100vh -
 *     4rem)`) and the content-driven sizing (`width: max-content`
 *     / `height: max-content`).
 *   - `renderModalCloseX(onClose)` returns a `<button
 *     data-testid="modal-close-x">` whose click invokes the supplied
 *     handler. Same testid across modals.
 *   - Both shipping modals (`<add-child-modal>`, `<edit-node-modal>`)
 *     consume the shared frame: their close-X carries the shared
 *     testid and lives at the panel's top-right corner.
 */
describe("modalFrameStyles (SPEC §17.29 — shared modal frame)", () => {
  it("declares the viewport-cap sizing contract on `.panel`", () => {
    const text = modalFrameStyles.cssText;
    // Shrink-to-content + viewport cap so a small modal collapses
    // and a large one stays inside the screen.
    expect(text).toMatch(/\.panel\s*\{[\s\S]*width:\s*max-content/);
    expect(text).toMatch(/\.panel\s*\{[\s\S]*height:\s*max-content/);
    expect(text).toMatch(/max-width:\s*calc\(100vw\s*-\s*4rem\)/);
    expect(text).toMatch(/max-height:\s*calc\(100vh\s*-\s*4rem\)/);
  });

  it("declares the close-X glyph (top-right corner, currentColor bars)", () => {
    const text = modalFrameStyles.cssText;
    expect(text).toMatch(/\.modal-close-x\s*\{/);
    // Pseudo-element bars rotated 45deg / -45deg form the X glyph.
    expect(text).toMatch(/\.modal-close-x::before/);
    expect(text).toMatch(/\.modal-close-x::after/);
    expect(text).toMatch(/rotate\(45deg\)/);
    expect(text).toMatch(/rotate\(-45deg\)/);
  });
});

describe("renderModalCloseX(onClose)", () => {
  it("returns a button with the shared `modal-close-x` testid", async () => {
    // Renders inside a host div so we can assert the resulting DOM.
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { render } = await import("lit");
    render(renderModalCloseX(() => undefined), host);
    const btn = host.querySelector<HTMLButtonElement>(
      '[data-testid="modal-close-x"]',
    );
    expect(btn).not.toBeNull();
    expect(btn?.tagName).toBe("BUTTON");
    expect(btn?.getAttribute("aria-label")).toBe("Close modal");
    expect(btn?.getAttribute("title")).toBe("Close modal");
    host.remove();
  });

  it("invokes the handler exactly once on click", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { render } = await import("lit");
    const handler = vi.fn();
    render(renderModalCloseX(handler), host);
    host
      .querySelector<HTMLButtonElement>('[data-testid="modal-close-x"]')
      ?.click();
    expect(handler).toHaveBeenCalledTimes(1);
    host.remove();
  });
});

describe("every shipping modal honours SPEC §17.29 (close-X presence)", () => {
  // §17.29 — the shared frame is the source of truth, but the
  // shipping modals are what the kiosk operator sees. These two
  // tests pin that EVERY modal in the app exposes the shared
  // close-X testid. A future third modal that forgets to call
  // `renderModalCloseX` (or uses a different testid) breaks here.

  it("<add-child-modal> exposes data-testid=\"modal-close-x\" when open", async () => {
    const el = await mountLitElement<AddChildModal>(
      "add-child-modal",
      (e) => {
        e.open = true;
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="modal-close-x"]'),
    ).not.toBeNull();
  });

  it("<edit-node-modal> exposes data-testid=\"modal-close-x\" when open", async () => {
    const el = await mountLitElement<EditNodeModal>("edit-node-modal", (e) => {
      e.editTarget = {
        nodeId: "uuid",
        kind: "TextNode",
        title: "x",
        weight: 1,
      };
      e.open = true;
    });
    expect(
      el.shadowRoot?.querySelector('[data-testid="modal-close-x"]'),
    ).not.toBeNull();
  });
});
