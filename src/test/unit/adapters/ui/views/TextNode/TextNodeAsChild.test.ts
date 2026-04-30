import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/TextNode/TextNodeAsChild.js";
import { TextNodeAsChild } from "../../../../../../adapters/ui/views/TextNode/TextNodeAsChild.js";
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
    id: "c1",
    title: "Region",
    value: { text: "North-east region", dateIso },
    ...opts,
  } as TextNodeViewModel;
}

describe("<text-node-as-child>", () => {
  it("renders Title + the latest text value (uniform with AsParent, \u00a75 + \u00a717.14)", async () => {
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vmWith();
    });

    expect(
      el.shadowRoot?.querySelector('[data-testid="title"]')?.textContent?.trim(),
    ).toBe("Region");
    expect(
      el.shadowRoot?.querySelector('[data-testid="value"]')?.textContent?.trim(),
    ).toBe("North-east region");
    expect(el.shadowRoot?.querySelector('[data-testid="description"]')).toBeNull();
  });

  it("renders the timestamp in the bottom-right corner (\u00a717.18)", async () => {
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vmWith();
    });

    const ts = el.shadowRoot?.querySelector<HTMLElement>('[data-testid="value-date"]');
    expect(ts).not.toBeNull();
    expect(ts?.getAttribute("datetime")).toBe(dateIso);
    // §17.18 — the .timestamp rule lives in the shared `tileLayoutStyles`
    // CSSResult; jsdom doesn't compute shadow-scoped CSS, so we read the
    // static CSS text directly (same pattern as ChildrenGrid.test.ts).
    const cssText = (TextNodeAsChild.styles as readonly { cssText?: string }[])
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    expect(cssText).toMatch(/\.timestamp\s*\{[\s\S]*?bottom:\s*0\.4rem/);
    expect(cssText).toMatch(/\.timestamp\s*\{[\s\S]*?right:\s*0\.6rem/);
    expect(cssText).not.toMatch(/\.timestamp\s*\{[\s\S]*?top:\s*0\.4rem/);
  });

  it("does not render a Σ badge", async () => {
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vmWith();
    });
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
  });

  it("renders an empty value and omits the timestamp when the history is empty", async () => {
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vmWith({ value: { text: "", dateIso: "" } });
    });

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    expect(value?.textContent?.trim()).toBe("");
    expect(value?.classList.contains("empty")).toBe(true);
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });
});
