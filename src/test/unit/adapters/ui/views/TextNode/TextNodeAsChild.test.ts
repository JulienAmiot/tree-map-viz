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
    // §17.18 / §17.46 — the timestamp sits in the bottom-right corner;
    // §17.46 trimmed the literals from `0.4rem / 0.6rem` to
    // `0.2rem / 0.35rem` (matching the reduced host padding) so the
    // date hugs the same padded inner edge as the §17.46 bigger
    // value's growth envelope. The regression guard is "bottom-right
    // corner, not top-right" (the §17.18 contract) -- the literal is
    // pinned to the post-§17.46 values for the same reason
    // (a future tweak that sets bottom: 0 or moves it back to the
    // top fails fast).
    expect(cssText).toMatch(/\.timestamp\s*\{[\s\S]*?bottom:\s*0\.2rem/);
    expect(cssText).toMatch(/\.timestamp\s*\{[\s\S]*?right:\s*0\.35rem/);
    expect(cssText).not.toMatch(/\.timestamp\s*\{[\s\S]*?top:\s*0\.2rem/);
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

  it("\u00a717.46 \u2014 the shared tileLayoutStyles bumps the value's cqmin coefficient and trims the host padding + timestamp font-size", () => {
    // \u00a717.46 -- tile typography refresh (operator feedback:
    // "the figure should be bigger and the date smaller; less
    // padding"). Pin the new literals at the CSS-text level so a
    // future tweak that inadvertently reverts one of the three
    // related properties out of sync (host padding, timestamp size,
    // value coefficient) fails fast at test-time. The TextNode child
    // role inherits the shared rules; pinning here covers every
    // per-view that imports tileLayoutStyles (the sibling tests in
    // the BSC suite + TextNodeAsParent suite all read the same
    // CSSResult chain).
    const cssText = (TextNodeAsChild.styles as readonly { cssText?: string }[])
      .map((s) => String(s.cssText ?? s))
      .join("\n");
    // Host padding trimmed from 0.4rem 0.6rem to 0.2rem 0.35rem.
    expect(cssText).toMatch(/:host\s*\{[\s\S]*?padding:\s*0\.2rem\s+0\.35rem/);
    // Timestamp font-size shrunk from 1.4vh to 1.15vh.
    expect(cssText).toMatch(
      /\.timestamp\s*\{[\s\S]*?font-size:\s*1\.15vh/,
    );
    // Value cqmin coefficient bumped from 36cqmin to 42cqmin.
    expect(cssText).toMatch(
      /\.value\s*\{[\s\S]*?font-size:\s*clamp\(\s*1\.5rem\s*,\s*42cqmin\s*,\s*22rem\s*\)/,
    );
  });
});
