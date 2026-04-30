import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/TextNode/TextNodeAsParent.js";
import { TextNodeAsParent } from "../../../../../../adapters/ui/views/TextNode/TextNodeAsParent.js";
import type { TextNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
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
    value: { text: "On track for Q2", dateIso },
    ...opts,
  } as TextNodeViewModel;
}

describe("<text-node-as-parent>", () => {
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

  it("renders the timestamp in the bottom-right corner (\u00a717.18)", async () => {
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
    expect(cssText).toMatch(/\.timestamp\s*\{[\s\S]*?bottom:\s*0\.4rem/);
    expect(cssText).not.toMatch(/\.timestamp\s*\{[\s\S]*?top:\s*0\.4rem/);
  });

  it("does not render a Σ badge (TextNode has no computed flag, \u00a75)", async () => {
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vmWith();
    });
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
  });

  it("renders an empty value (no text) and omits the timestamp when the history is empty", async () => {
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vmWith({ value: { text: "", dateIso: "" } });
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
});
