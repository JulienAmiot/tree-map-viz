import { afterEach, describe, expect, it } from "vitest";

import {
  PLUS_TILE_ACTIVATE_EVENT,
  PlusTile,
  type PlusTileActivateDetail,
} from "../../../../../../adapters/ui/molecules/plus/PlusTile.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

describe("<plus-tile>", () => {
  it("renders a single button with data-testid=plus-tile (§4 — exactly one)", async () => {
    const el = await mountLitElement<PlusTile>("plus-tile", (e) => {
      e.parentId = "parent-x";
    });

    const buttons = el.shadowRoot?.querySelectorAll('[data-testid="plus-tile"]');
    expect(buttons?.length).toBe(1);
    const button = buttons![0] as HTMLElement;
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("never renders title / value / date (§12.3 — `views/plus_tile.feature`)", async () => {
    const el = await mountLitElement<PlusTile>("plus-tile");

    expect(el.shadowRoot?.querySelector('[data-testid="title"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="value"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  it("centres a '+' glyph", async () => {
    const el = await mountLitElement<PlusTile>("plus-tile");

    const plus = el.shadowRoot?.querySelector(".plus");
    expect(plus?.textContent?.trim()).toBe("+");
  });

  it("emits a bubbling, composed plus-tile-activate event with parentId on click", async () => {
    const el = await mountLitElement<PlusTile>("plus-tile", (e) => {
      e.parentId = "parent-7";
    });

    const detailPromise = new Promise<PlusTileActivateDetail>((resolve) => {
      el.addEventListener(
        PLUS_TILE_ACTIVATE_EVENT,
        (ev) => {
          const custom = ev as CustomEvent<PlusTileActivateDetail>;
          resolve(custom.detail);
        },
        { once: true },
      );
    });

    const button = el.shadowRoot?.querySelector(
      '[data-testid="plus-tile"]',
    ) as HTMLButtonElement;
    button.click();

    const detail = await detailPromise;
    expect(detail.parentId).toBe("parent-7");
  });

  it("emits an event that bubbles + composed (so the shell can listen on its host)", async () => {
    const el = await mountLitElement<PlusTile>("plus-tile", (e) => {
      e.parentId = "parent-bubble";
    });

    const evPromise = new Promise<CustomEvent<PlusTileActivateDetail>>((resolve) => {
      document.addEventListener(
        PLUS_TILE_ACTIVATE_EVENT,
        (ev) => resolve(ev as CustomEvent<PlusTileActivateDetail>),
        { once: true },
      );
    });

    const button = el.shadowRoot?.querySelector(
      '[data-testid="plus-tile"]',
    ) as HTMLButtonElement;
    button.click();

    const ev = await evPromise;
    expect(ev.bubbles).toBe(true);
    expect(ev.composed).toBe(true);
    expect(ev.detail.parentId).toBe("parent-bubble");
  });

  it("reflects parentId to the parent-id attribute", async () => {
    const el = await mountLitElement<PlusTile>("plus-tile", (e) => {
      e.parentId = "abc";
    });
    expect(el.parentId).toBe("abc");
    expect(el.getAttribute("parent-id")).toBe("abc");
  });
});
