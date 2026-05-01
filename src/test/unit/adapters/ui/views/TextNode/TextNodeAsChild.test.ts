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
    // SPEC §17.21 — `dateColor` is normally baked by the mapper; tests
    // that fabricate a VM directly pin a representative `rgb(...)` so
    // the inline style assertion sees a real colour.
    value: { text: "North-east region", dateIso, dateColor: "rgb(255, 145, 50)" },
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

  it("renders the timestamp in the bottom-right corner with an age-based --age-color (\u00a717.18)", async () => {
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
    // §17.18 — inline `--age-color` custom property carries the
    // age-based gradient colour (warm orange → cold pale blue).
    const inlineStyle = ts?.getAttribute("style") ?? "";
    expect(inlineStyle).toMatch(/--age-color:\s*rgb\(/);
  });

  it("does not render a Σ badge", async () => {
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vmWith();
    });
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
  });

  it("renders an empty value and omits the timestamp when the history is empty", async () => {
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vmWith({ value: { text: "", dateIso: "", dateColor: "" } });
    });

    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    expect(value?.textContent?.trim()).toBe("");
    expect(value?.classList.contains("empty")).toBe(true);
    expect(el.shadowRoot?.querySelector('[data-testid="value-date"]')).toBeNull();
  });

  // SPEC §17.27 — TextNode value strings are rendered through the
  // markdown pipeline. The text content stays the same (markdown
  // markers are stripped), but the DOM gains the corresponding
  // semantic elements (<strong>, <em>, <code>, <ul>/<li>, <p>, ...)
  // so a kiosk operator can compose richer notes than a single line
  // of plain text. Empty values stay empty (no <p> wrapper).
  it("parses **bold** + *italic* markdown into <strong>/<em> elements", async () => {
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vmWith({
        value: {
          text: "On track **for Q2** with *minor* slippage",
          dateIso,
          dateColor: "rgb(255, 145, 50)",
        },
      });
    });
    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    expect(value?.querySelector("strong")?.textContent).toBe("for Q2");
    expect(value?.querySelector("em")?.textContent).toBe("minor");
    // The visible text content keeps the markdown stripped, so e2e
    // `toHaveText` assertions on `[data-testid="value"]` keep working.
    expect(value?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "On track for Q2 with minor slippage",
    );
  });

  it("renders a `-` list as <ul><li> + inline `code`", async () => {
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vmWith({
        value: {
          text: "- Ship `v2`\n- Migrate cache",
          dateIso,
          dateColor: "rgb(255, 145, 50)",
        },
      });
    });
    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    expect(value?.querySelector("ul")).not.toBeNull();
    expect(value?.querySelectorAll("li")).toHaveLength(2);
    expect(value?.querySelector("li code")?.textContent).toBe("v2");
  });

  it("escapes embedded HTML in the source (defence-in-depth XSS gate)", async () => {
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vmWith({
        value: {
          text: "<script>alert(1)</script> ok",
          dateIso,
          dateColor: "rgb(255, 145, 50)",
        },
      });
    });
    const value = el.shadowRoot?.querySelector('[data-testid="value"]');
    // The DOM must not contain a real <script> element (the escape
    // happens in markdownToHtml before unsafeHTML reaches Lit).
    expect(value?.querySelector("script")).toBeNull();
    // The literal characters are still readable as text.
    expect(value?.textContent).toContain("<script>");
  });
});
