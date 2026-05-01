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
    // SPEC §17.21 — see sibling AsChild test for rationale.
    value: { text: "On track for Q2", dateIso, dateColor: "rgb(255, 145, 50)" },
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
    expect(cssText).toMatch(/\.timestamp\s*\{[\s\S]*?bottom:\s*0\.4rem/);
    expect(cssText).not.toMatch(/\.timestamp\s*\{[\s\S]*?top:\s*0\.4rem/);
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
});
