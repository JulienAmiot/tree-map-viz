import { afterEach, describe, expect, it, vi } from "vitest";

import "../../../../../../adapters/ui/views/TextNode/TextNodeAsParent.js";
import { TextNodeAsParent } from "../../../../../../adapters/ui/views/TextNode/TextNodeAsParent.js";
import type { TextNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
import { VALUE_NODE_DISABLED_CHANGE_EVENT, type ValueNodeDisabledChangeDetail } from "../../../../../../adapters/ui/views/disabledToggle.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

const dateIso = "2026-04-23T18:25:43.511Z";

function vmWith(opts: Partial<TextNodeViewModel> = {}): TextNodeViewModel {
  return {
    kind: "TextNode",
    id: "p1",
    title: "Quarterly review",
    // SPEC §17.21 — see sibling AsChild test for rationale.
    value: { text: "On track for Q2", dateIso, dateColor: "rgb(255, 145, 50)" },
    ...opts,
  } as TextNodeViewModel;
}

describe("<text-node-as-parent>", () => {
  it("\u00a717.121i \u2014 renders a `.disabled-switch` toggle button as the FIRST child of the title row, reflecting vm.disabled via aria-checked", async () => {
    const active = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => { e.vm = vmWith(); });
    const activeTitle = active.shadowRoot?.querySelector('[data-testid="title"]');
    const activeSwitch = activeTitle?.firstElementChild as HTMLButtonElement | null;
    expect(activeSwitch?.getAttribute("data-testid")).toBe("disabled-switch");
    expect(activeSwitch?.getAttribute("role")).toBe("switch");
    expect(activeSwitch?.getAttribute("aria-checked")).toBe("false");
    const off = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => { e.vm = vmWith({ disabled: true }); });
    const offTitle = off.shadowRoot?.querySelector('[data-testid="title"]');
    const offSwitch = offTitle?.firstElementChild as HTMLButtonElement | null;
    expect(offSwitch?.getAttribute("data-testid")).toBe("disabled-switch");
    expect(offSwitch?.getAttribute("aria-checked")).toBe("true");
  });

  it("\u00a717.121i \u2014 click on the switch flips the boolean and dispatches a bubbling, composed VALUE_NODE_DISABLED_CHANGE_EVENT", async () => {
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => { e.vm = vmWith({ id: "node-x" }); });
    const received: ValueNodeDisabledChangeDetail[] = [];
    el.addEventListener(VALUE_NODE_DISABLED_CHANGE_EVENT, (ev) => {
      received.push((ev as CustomEvent<ValueNodeDisabledChangeDetail>).detail);
    });
    el.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="disabled-switch"]')?.click();
    expect(received).toEqual([{ nodeId: "node-x", disabled: true }]);
    const off = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => { e.vm = vmWith({ id: "node-y", disabled: true }); });
    off.addEventListener(VALUE_NODE_DISABLED_CHANGE_EVENT, (ev) => {
      received.push((ev as CustomEvent<ValueNodeDisabledChangeDetail>).detail);
    });
    off.shadowRoot?.querySelector<HTMLButtonElement>('[data-testid="disabled-switch"]')?.click();
    expect(received).toEqual([{ nodeId: "node-x", disabled: true }, { nodeId: "node-y", disabled: false }]);
  });

  it("renders Title + the latest text value (\u00a717.14 — no description in the tile)", async () => {
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vmWith();
    });

    expect(
      el.shadowRoot?.querySelector('[data-testid="title"]')?.textContent?.trim(),
    ).toBe("Quarterly review");
    expect(
      el.shadowRoot?.querySelector('[data-testid="value"]')?.textContent?.trim(),
    ).toBe("On track for Q2");
    expect(
      el.shadowRoot?.querySelector('[data-testid="value"]')?.getAttribute("data-value-kind"),
    ).toBe("textValue");
    expect(el.shadowRoot?.querySelector('[data-testid="description"]')).toBeNull();
  });

  it("renders the timestamp in the bottom-right corner with an age-based --age-color (\u00a717.18)", async () => {
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vmWith();
    });

    const ts = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value-date"]');
    expect(ts).not.toBeNull();
    expect(ts?.getAttribute("datetime")).toBe(dateIso);
    expect(ts?.classList.contains("timestamp")).toBe(true);
    // §17.18 — read the static CSS text directly (jsdom can't compute
    // shadow-scoped CSS); same pattern as ChildrenGrid.test.ts.
    const cssText = (TextNodeAsParent.styles as readonly { cssText?: string }[])
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    // §17.18 / §17.46 — bottom-right corner, post-§17.46 trimmed
    // literals (was 0.4rem; see TextNodeAsChild.test.ts for the
    // rationale).
    expect(cssText).toMatch(/\.timestamp\s*\{[\s\S]*?bottom:\s*0\.2rem/);
    expect(cssText).not.toMatch(/\.timestamp\s*\{[\s\S]*?top:\s*0\.2rem/);
    // §17.18 — inline `--age-color` carries the lerped colour.
    expect(ts?.getAttribute("style") ?? "").toMatch(/--age-color:\s*rgb\(/);
  });

  it("does not render a Σ badge (TextNode has no computed flag, \u00a75)", async () => {
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vmWith();
    });
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
  });

  it("renders an empty value (no text) and omits the timestamp when the history is empty", async () => {
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vmWith({ value: { text: "", dateIso: "", dateColor: "" } });
    });

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    expect(value?.textContent?.trim()).toBe("");
    expect(value?.classList.contains("empty")).toBe(true);
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  it("tags the rendered title with view-kind metadata for e2e selectors", async () => {
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vmWith({ id: "p4" });
    });

    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    expect(title?.getAttribute("data-view-kind")).toBe("TextNode");
    expect(title?.getAttribute("data-id")).toBe("p4");
  });

  // SPEC §17.27 — markdown rendering on the parent strip mirrors the
  // child tile's contract. We test heading + list because the parent
  // strip's bigger value-area is where the operator is most likely to
  // author a multi-section note.
  it("parses ## heading + ordered list into <h4>/<ol>/<li> elements", async () => {
    const el = await mountLitElement<TextNodeAsParent>(
      "text-node-as-parent",
      (e) => {
        e.vm = vmWith({
          value: {
            text: "## Status\n\n1. Ship v2\n2. Migrate cache",
            dateIso,
            dateColor: "rgb(255, 145, 50)",
          },
        });
      },
    );
    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    expect(value?.querySelector("h4")?.textContent).toBe("Status");
    expect(value?.querySelectorAll("ol > li")).toHaveLength(2);
  });

  it("renders [label](url) as a sandboxed external link", async () => {
    const el = await mountLitElement<TextNodeAsParent>(
      "text-node-as-parent",
      (e) => {
        e.vm = vmWith({
          value: {
            text: "see [docs](https://example.com)",
            dateIso,
            dateColor: "rgb(255, 145, 50)",
          },
        });
      },
    );
    const a = el.shadowRoot?.querySelector<HTMLAnchorElement>(
      '[data-testid="value"] a',
    );
    expect(a).not.toBeNull();
    expect(a?.getAttribute("href")).toBe("https://example.com");
    // §17.27 — every external link is forced to open in a new tab
    // and is hardened against tab-nabbing via rel=noopener noreferrer.
    expect(a?.getAttribute("target")).toBe("_blank");
    const rel = a?.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
  });

  // -- §17.28 inline editing ------------------------------------------

  describe("inline editing (\u00a717.28)", () => {
    it("clicking the title swaps it for an input pre-filled with the current value", async () => {
      const el = await mountLitElement<TextNodeAsParent>(
        "text-node-as-parent",
        (e) => {
          e.vm = vmWith();
        },
      );
      const titleEl = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="title"]',
      );
      titleEl?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-testid="title-edit"]',
      );
      expect(input).not.toBeNull();
      expect(input?.value).toBe("Quarterly review");
    });

    it("Enter on the title input dispatches inline-edit-title with the new value", async () => {
      const el = await mountLitElement<TextNodeAsParent>(
        "text-node-as-parent",
        (e) => {
          e.vm = vmWith({ id: "uuid-x" });
        },
      );
      el.shadowRoot?.querySelector<HTMLElement>('[data-testid="title"]')?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
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
      expect(ev.detail).toEqual({ nodeId: "uuid-x", title: "Renamed" });
      expect(ev.bubbles).toBe(true);
      expect(ev.composed).toBe(true);
    });

    it("Escape on the title input cancels without dispatching", async () => {
      const el = await mountLitElement<TextNodeAsParent>(
        "text-node-as-parent",
        (e) => {
          e.vm = vmWith();
        },
      );
      el.shadowRoot?.querySelector<HTMLElement>('[data-testid="title"]')?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
        '[data-testid="title-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-title", handler);
      input.value = "Will Cancel";
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
      const el = await mountLitElement<TextNodeAsParent>(
        "text-node-as-parent",
        (e) => {
          e.vm = vmWith();
        },
      );
      el.shadowRoot?.querySelector<HTMLElement>('[data-testid="title"]')?.click();
      await el.updateComplete;
      const input = el.shadowRoot?.querySelector<HTMLInputElement>(
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

    it("clicking the value swaps it for a textarea with the raw markdown source", async () => {
      const el = await mountLitElement<TextNodeAsParent>(
        "text-node-as-parent",
        (e) => {
          e.vm = vmWith({
            value: {
              text: "## Heading\n\nbody",
              dateIso,
              dateColor: "rgb(255, 145, 50)",
            },
          });
        },
      );
      const valueEl = el.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="value"]',
      );
      valueEl?.click();
      await el.updateComplete;
      const ta = el.shadowRoot?.querySelector<HTMLTextAreaElement>(
        '[data-testid="value-edit"]',
      );
      expect(ta).not.toBeNull();
      expect(ta?.value).toBe("## Heading\n\nbody");
    });

    it("Ctrl+Enter on the value textarea dispatches inline-edit-value", async () => {
      const el = await mountLitElement<TextNodeAsParent>(
        "text-node-as-parent",
        (e) => {
          e.vm = vmWith({ id: "uuid-tx" });
        },
      );
      el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value"]')?.click();
      await el.updateComplete;
      const ta = el.shadowRoot?.querySelector<HTMLTextAreaElement>(
        '[data-testid="value-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-value", handler);
      ta.value = "**Updated** value";
      ta.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          bubbles: true,
        }),
      );
      expect(handler).toHaveBeenCalledTimes(1);
      const ev = handler.mock.calls[0]![0] as CustomEvent<{
        nodeId: string;
        value: string | number;
      }>;
      expect(ev.detail.nodeId).toBe("uuid-tx");
      expect(ev.detail.value).toBe("**Updated** value");
    });

    it("plain Enter inside the value textarea does NOT commit (multiline)", async () => {
      const el = await mountLitElement<TextNodeAsParent>(
        "text-node-as-parent",
        (e) => {
          e.vm = vmWith();
        },
      );
      el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value"]')?.click();
      await el.updateComplete;
      const ta = el.shadowRoot?.querySelector<HTMLTextAreaElement>(
        '[data-testid="value-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-value", handler);
      ta.value = "first line\nsecond";
      ta.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it("blur on the value textarea commits the current value", async () => {
      const el = await mountLitElement<TextNodeAsParent>(
        "text-node-as-parent",
        (e) => {
          e.vm = vmWith({ id: "uuid-tb" });
        },
      );
      el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value"]')?.click();
      await el.updateComplete;
      const ta = el.shadowRoot?.querySelector<HTMLTextAreaElement>(
        '[data-testid="value-edit"]',
      )!;
      const handler = vi.fn();
      el.addEventListener("inline-edit-value", handler);
      ta.value = "Blur commit";
      ta.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("title colour (\u00a717.31, simplified by \u00a717.42)", () => {
    // §17.31 painted the focused-panel title with the per-board
    // fresh-date colour through `var(--board-fresh, currentColor)`.
    // §17.42 retired the per-board colour design (no more
    // `Board.freshDateColor`, no more `--board-fresh`) and pinned a
    // single bright off-white `rgb(245, 245, 245)` for every parent
    // title regardless of board. Children-tile titles
    // (TextNodeAsChild + BSC AsChild) intentionally do NOT carry
    // this rule \u2014 only the focused panel.
    //
    // jsdom can't compute shadow-scoped CSS, so we read the static
    // CSS text directly (same pattern \u00a717.18 uses for the
    // timestamp).
    it("the .title carries the bright off-white literal", () => {
      const cssText = (TextNodeAsParent.styles as readonly { cssText?: string }[])
        .map((s) => String(s.cssText ?? s))
        .join("\n");
      expect(cssText).toMatch(
        /\.title\s*\{[\s\S]*?color:\s*rgb\(245,\s*245,\s*245\)/,
      );
      // §17.42 \u2014 the prior `var(--board-fresh, ...)` look-up MUST
      // be gone so a future regression that reintroduces the
      // per-board accent fails fast here. The bare `--board-fresh`
      // string still appears in narrative comments by design;
      // the regex only flags actual `var()` consumers.
      expect(cssText).not.toMatch(/var\(--board-fresh/);
    });
  });
});
