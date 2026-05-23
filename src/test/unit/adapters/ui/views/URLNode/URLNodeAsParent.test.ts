import type { LitElement } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/views/URLNode/URLNodeAsParent.js";
import { URLNodeAsParent } from "../../../../../../adapters/ui/views/URLNode/URLNodeAsParent.js";
import type { URLNodeViewModel } from "../../../../../../adapters/ui/molecules/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function vmWith(opts: Partial<URLNodeViewModel> = {}): URLNodeViewModel {
  return {
    kind: "URLNode",
    id: "url-p",
    title: "Docs",
    url: "https://example.com/docs",
    ...opts,
  } as URLNodeViewModel;
}

async function waitForQRSettled(el: LitElement, maxTicks = 8): Promise<void> {
  for (let i = 0; i < maxTicks; i++) {
    await el.updateComplete;
    const sr = el.shadowRoot;
    if (
      sr?.querySelector('[data-testid="qr-image"]') ||
      sr?.querySelector('[data-testid="warning-fill"]')
    ) {
      return;
    }
    await Promise.resolve();
  }
}

const OVERSIZED_URL = "a".repeat(10000);

/**
 * SPEC §17.120 — `<url-node-as-parent>` unit tests.
 *
 * The parent role adds a single inline-edit affordance over the
 * shared QR-fills-value-area layout: clicking the title swaps it
 * for an input and Enter / blur commits via
 * `INLINE_EDIT_TITLE_EVENT` (parity with `TextNodeAsParent` /
 * `PictureNodeAsParent`). Changing the URL itself is a structural
 * edit routed through the `EditNodeModal` — there is no inline
 * value editor on this view.
 */
describe("<url-node-as-parent>", () => {
  it("renders title + QR image with object-fit: contain (same body contract as the child role)", async () => {
    const el = await mountLitElement<URLNodeAsParent>(
      "url-node-as-parent",
      (e) => {
        e.vm = vmWith({ title: "Region map", url: "https://e.com/r" });
      },
    );
    await waitForQRSettled(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="title"]')?.textContent?.trim(),
    ).toBe("Region map");
    const img = el.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="qr-image"]',
    );
    expect(img?.getAttribute("src")?.startsWith("data:image/svg+xml")).toBe(
      true,
    );

    const cssText = (URLNodeAsParent.styles as readonly { cssText?: string }[])
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    expect(cssText).toMatch(/\.qr-img\s*\{[\s\S]*?object-fit:\s*contain/);
    // SPEC §17.120 — strand divergence vs §17.119 PictureNode (cover).
    expect(cssText).not.toMatch(/object-fit:\s*cover/);
  });

  it("title uses the focused-panel off-white colour + 2.4vh font-size (§17.42 + §17.14)", () => {
    const cssText = (URLNodeAsParent.styles as readonly { cssText?: string }[])
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    expect(cssText).toMatch(/\.title\s*\{[\s\S]*?font-size:\s*2\.4vh/);
    expect(cssText).toMatch(
      /\.title\s*\{[\s\S]*?color:\s*rgb\(245,\s*245,\s*245\)/,
    );
  });

  it("falls back to the §17.116 warning-fill glyph when QR generation rejects (oversized payload)", async () => {
    const el = await mountLitElement<URLNodeAsParent>(
      "url-node-as-parent",
      (e) => {
        e.vm = vmWith({ url: OVERSIZED_URL });
      },
    );
    await waitForQRSettled(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="qr-image"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).not.toBeNull();
  });

  it("swapping vm.url after a failure clears the warning and retries the QR encoding", async () => {
    const el = await mountLitElement<URLNodeAsParent>(
      "url-node-as-parent",
      (e) => {
        e.vm = vmWith({ url: OVERSIZED_URL });
      },
    );
    await waitForQRSettled(el);
    el.vm = vmWith({ url: "https://example.com/ok" });
    await waitForQRSettled(el);
    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).toBeNull();
    expect(
      el.shadowRoot
        ?.querySelector<HTMLImageElement>('[data-testid="qr-image"]')
        ?.getAttribute("src")
        ?.startsWith("data:image/svg+xml"),
    ).toBe(true);
  });

  describe("inline title editing (§17.28 parity)", () => {
    it("clicking the title swaps it for an input pre-filled with the current value", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith({ title: "Original" });
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="title"]')
        ?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-testid="title-edit"]',
      );
      expect(input).not.toBeNull();
      expect(input?.value).toBe("Original");
    });

    it("Enter on the title input dispatches inline-edit-title with the new value", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith({ id: "uuid-u", title: "Old" });
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="title"]')
        ?.click();
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector<HTMLInputElement>(
        '[data-testid="title-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-title", handler);
      input.value = "Renamed";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]![0] as CustomEvent<{
        nodeId: string;
        title: string;
      }>;
      expect(ev.detail).toEqual({ nodeId: "uuid-u", title: "Renamed" });
      expect(ev.bubbles).toBe(true);
      expect(ev.composed).toBe(true);
    });

    it("Escape on the title input cancels without dispatching", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith();
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="title"]')
        ?.click();
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector<HTMLInputElement>(
        '[data-testid="title-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-title", handler);
      input.value = "Cancelled";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await el.updateComplete;
      expect(handler).not.toHaveBeenCalled();
      expect(
        el.shadowRoot?.querySelector('[data-testid="title-edit"]'),
      ).toBeNull();
    });

    it("blanking the title commits as a no-op (Title.of would reject empty)", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith();
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="title"]')
        ?.click();
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector<HTMLInputElement>(
        '[data-testid="title-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-title", handler);
      input.value = "   ";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it("clicking the QR image (data-testid=qr-image) does NOT enter inline edit mode (URL edits go through the modal)", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith();
        },
      );
      await waitForQRSettled(el);
      const img = el.shadowRoot?.querySelector<HTMLImageElement>(
        '[data-testid="qr-image"]',
      );
      img?.click();
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="title-edit"]'),
      ).toBeNull();
      // SPEC §17.120 — no URL-edit field exists on this view by
      // design (parity with §17.119 PictureNode parent-role).
      expect(
        el.shadowRoot?.querySelector('[data-testid="value-edit"]'),
      ).toBeNull();
    });

    it("editing the title while the QR is still generating does NOT clobber the QR rendering once it resolves", async () => {
      // SPEC §17.120 — title editing toggles `editingField`, which
      // does NOT touch `lastUrl`. Race-free interaction guarantee:
      // an operator who clicks the title BEFORE the QR resolves
      // should still see the QR appear underneath the input once
      // generation completes (no spurious regeneration triggered
      // by the title-edit state flip).
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith({ title: "Original", url: "https://example.com/x" });
        },
      );
      el.shadowRoot
        ?.querySelector<HTMLElement>('[data-testid="title"]')
        ?.click();
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="title-edit"]'),
      ).not.toBeNull();
      await waitForQRSettled(el);
      // QR rendered alongside the title-edit input.
      expect(
        el.shadowRoot?.querySelector('[data-testid="qr-image"]'),
      ).not.toBeNull();
    });
  });

  it("renders nothing meaningful when vm is null", async () => {
    const el = await mountLitElement<URLNodeAsParent>(
      "url-node-as-parent",
    );
    expect(el.shadowRoot?.querySelector('[data-testid="title"]')).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="qr-image"]'),
    ).toBeNull();
  });

  describe("\u00a717.121j \u2014 description aside (QR + URL split body)", () => {
    it("renders a `.body` row with both `.metric-pane` (QR) and `.description` (URL text) when the URL is non-empty", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith({ url: "https://example.com/region/north-east" });
        },
      );
      await waitForQRSettled(el);
      const body = el.shadowRoot?.querySelector<HTMLElement>(".body");
      expect(body).not.toBeNull();
      expect(body?.getAttribute("data-has-description")).toBe("true");
      const pane = body?.querySelector<HTMLElement>('[data-testid="metric-pane"]');
      expect(pane).not.toBeNull();
      expect(pane?.querySelector('[data-testid="qr-image"]')).not.toBeNull();
      const aside = body?.querySelector<HTMLElement>('[data-testid="description"]');
      expect(aside).not.toBeNull();
      expect(aside?.textContent?.trim()).toBe(
        "https://example.com/region/north-east",
      );
    });

    it("§17.123 — renders the URL as a clickable <a target=\"_blank\" rel=\"noopener noreferrer\"> inside the description aside", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith({ url: "https://example.com/region/north-east" });
        },
      );
      await waitForQRSettled(el);
      const aside = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="description"]',
      );
      expect(aside).not.toBeNull();
      const link = aside?.querySelector<HTMLAnchorElement>(
        '[data-testid="description-link"]',
      );
      expect(link).not.toBeNull();
      expect(link?.tagName).toBe("A");
      expect(link?.getAttribute("href")).toBe(
        "https://example.com/region/north-east",
      );
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link?.textContent?.trim()).toBe(
        "https://example.com/region/north-east",
      );
    });

    it("§17.123 — the description-link href tracks vm.url updates", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith({ url: "https://example.com/one" });
        },
      );
      await waitForQRSettled(el);
      el.vm = vmWith({ url: "https://example.com/two" });
      await el.updateComplete;
      const link = el.shadowRoot?.querySelector<HTMLAnchorElement>(
        '[data-testid="description-link"]',
      );
      expect(link?.getAttribute("href")).toBe("https://example.com/two");
      expect(link?.textContent?.trim()).toBe("https://example.com/two");
    });

    it("§17.123 — clicking the description-link does NOT enter inline title edit", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith({ url: "https://example.com/click-test" });
        },
      );
      await waitForQRSettled(el);
      const link = el.shadowRoot?.querySelector<HTMLAnchorElement>(
        '[data-testid="description-link"]',
      );
      const titleHandler = vi.fn();
      el.addEventListener("inline-edit-title", titleHandler);
      // Prevent the browser default so the test runner doesn't try to
      // open a new tab; the assertion is purely DOM-shape.
      link?.addEventListener("click", (e) => e.preventDefault());
      link?.click();
      await el.updateComplete;
      expect(titleHandler).not.toHaveBeenCalled();
      expect(
        el.shadowRoot?.querySelector('[data-testid="title-edit"]'),
      ).toBeNull();
    });

    it("omits the `.description` aside (and flags the body data-has-description=\"false\") when the URL is empty", async () => {
      const el = await mountLitElement<URLNodeAsParent>(
        "url-node-as-parent",
        (e) => {
          e.vm = vmWith({ url: "" });
        },
      );
      await el.updateComplete;
      const body = el.shadowRoot?.querySelector<HTMLElement>(".body");
      expect(body).not.toBeNull();
      expect(body?.getAttribute("data-has-description")).toBe("false");
      expect(
        el.shadowRoot?.querySelector('[data-testid="description"]'),
      ).toBeNull();
      // The metric-pane still renders so the QR fallback (warning or
      // empty) keeps the strip well-formed.
      expect(
        el.shadowRoot?.querySelector('[data-testid="metric-pane"]'),
      ).not.toBeNull();
    });
  });

  it("\u00a717.121j \u2014 reserves the shared `.subtitle` slot even though URLNode has no per-property content for it (operator-requested alignment contract: every kiosk tile reserves the row)", async () => {
    const el = await mountLitElement<URLNodeAsParent>(
      "url-node-as-parent",
      (e) => {
        e.vm = vmWith();
      },
    );
    await waitForQRSettled(el);
    const subtitle = el.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="subtitle"]',
    );
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent?.trim()).toBe("");
  });
});
