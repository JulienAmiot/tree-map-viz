import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/organisms/PictureNode/PictureNodeAsParent.js";
import { PictureNodeAsParent } from "../../../../../../adapters/ui/organisms/PictureNode/PictureNodeAsParent.js";
import type { PictureNodeViewModel } from "../../../../../../adapters/ui/molecules/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

function vmWith(opts: Partial<PictureNodeViewModel> = {}): PictureNodeViewModel {
  return {
    kind: "PictureNode",
    id: "pic-p",
    title: "Office floor plan",
    imageUrl: "https://example.com/floor.jpg",
    ...opts,
  } as PictureNodeViewModel;
}

/**
 * SPEC §17.119 — `<picture-node-as-parent>` unit tests.
 *
 * The parent role adds a single inline-edit affordance over the
 * shared image-fills-value-area layout: clicking the title swaps it
 * for an input and Enter / blur commits via
 * `INLINE_EDIT_TITLE_EVENT` (parity with `TextNodeAsParent`).
 * Changing the image URL itself is a structural edit routed
 * through the `EditNodeModal` — there is no inline value editor on
 * this view.
 */
describe("<picture-node-as-parent>", () => {
  it("\u00a717.121j \u2014 reserves the shared `.subtitle` slot (empty) so the image area aligns with the rest of the focused-panel rotation", async () => {
    const el = await mountLitElement<PictureNodeAsParent>(
      "picture-node-as-parent",
      (e) => { e.vm = vmWith(); },
    );
    const subtitle = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="subtitle"]');
    expect(subtitle).not.toBeNull();
    expect(subtitle?.textContent?.trim()).toBe("");
  });

  it("renders title + image with object-fit: cover (same body contract as the child role)", async () => {
    const el = await mountLitElement<PictureNodeAsParent>(
      "picture-node-as-parent",
      (e) => {
        e.vm = vmWith({ title: "Region map", imageUrl: "https://e.com/r.jpg" });
      },
    );
    expect(
      el.shadowRoot?.querySelector('[data-testid="title"]')?.textContent?.trim(),
    ).toBe("Region map");
    const img = el.shadowRoot?.querySelector<HTMLImageElement>(
      '[data-testid="picture-image"]',
    );
    expect(img?.getAttribute("src")).toBe("https://e.com/r.jpg");

    const cssText = (PictureNodeAsParent.styles as readonly { cssText?: string }[])
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    expect(cssText).toMatch(/\.picture-img\s*\{[\s\S]*?object-fit:\s*cover/);
  });

  it("title uses the focused-panel off-white colour + 2.4vh font-size (§17.42 + §17.14)", () => {
    const cssText = (PictureNodeAsParent.styles as readonly { cssText?: string }[])
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    expect(cssText).toMatch(/\.title\s*\{[\s\S]*?font-size:\s*2\.4vh/);
    expect(cssText).toMatch(
      /\.title\s*\{[\s\S]*?color:\s*rgb\(245,\s*245,\s*245\)/,
    );
  });

  it("falls back to the §17.116 warning-fill glyph when the image errors", async () => {
    const el = await mountLitElement<PictureNodeAsParent>(
      "picture-node-as-parent",
      (e) => {
        e.vm = vmWith({ imageUrl: "https://nope.invalid/x.png" });
      },
    );
    el.shadowRoot
      ?.querySelector<HTMLImageElement>('[data-testid="picture-image"]')
      ?.dispatchEvent(new Event("error"));
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector('[data-testid="picture-image"]'),
    ).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).not.toBeNull();
  });

  it("swapping vm.imageUrl after a failure clears the warning and retries the <img>", async () => {
    const el = await mountLitElement<PictureNodeAsParent>(
      "picture-node-as-parent",
      (e) => {
        e.vm = vmWith({ imageUrl: "https://nope.invalid/x.png" });
      },
    );
    el.shadowRoot
      ?.querySelector<HTMLImageElement>('[data-testid="picture-image"]')
      ?.dispatchEvent(new Event("error"));
    await el.updateComplete;
    el.vm = vmWith({ imageUrl: "https://example.com/ok.jpg" });
    await el.updateComplete;
    expect(
      el.shadowRoot?.querySelector('[data-testid="warning-fill"]'),
    ).toBeNull();
    expect(
      el.shadowRoot
        ?.querySelector<HTMLImageElement>('[data-testid="picture-image"]')
        ?.getAttribute("src"),
    ).toBe("https://example.com/ok.jpg");
  });

  describe("inline title editing (§17.28 parity)", () => {
    it("clicking the title swaps it for an input pre-filled with the current value", async () => {
      const el = await mountLitElement<PictureNodeAsParent>(
        "picture-node-as-parent",
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
      const el = await mountLitElement<PictureNodeAsParent>(
        "picture-node-as-parent",
        (e) => {
          e.vm = vmWith({ id: "uuid-p", title: "Old" });
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
      expect(ev.detail).toEqual({ nodeId: "uuid-p", title: "Renamed" });
      expect(ev.bubbles).toBe(true);
      expect(ev.composed).toBe(true);
    });

    it("Escape on the title input cancels without dispatching", async () => {
      const el = await mountLitElement<PictureNodeAsParent>(
        "picture-node-as-parent",
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
      const el = await mountLitElement<PictureNodeAsParent>(
        "picture-node-as-parent",
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

    it("clicking the image (data-testid=picture-image) does NOT enter inline edit mode (URL edits go through the modal)", async () => {
      const el = await mountLitElement<PictureNodeAsParent>(
        "picture-node-as-parent",
        (e) => {
          e.vm = vmWith();
        },
      );
      const img = el.shadowRoot?.querySelector<HTMLImageElement>(
        '[data-testid="picture-image"]',
      );
      img?.click();
      await el.updateComplete;
      expect(
        el.shadowRoot?.querySelector('[data-testid="title-edit"]'),
      ).toBeNull();
      // No imageUrl-edit field exists on this view by design.
      expect(
        el.shadowRoot?.querySelector('[data-testid="value-edit"]'),
      ).toBeNull();
    });
  });

  it("renders nothing meaningful when vm is null", async () => {
    const el = await mountLitElement<PictureNodeAsParent>(
      "picture-node-as-parent",
    );
    expect(el.shadowRoot?.querySelector('[data-testid="title"]')).toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-testid="picture-image"]'),
    ).toBeNull();
  });
});
