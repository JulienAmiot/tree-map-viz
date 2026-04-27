import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/TextNode/TextNodeAsParent.js";
import type { TextNodeAsParent } from "../../../../../../adapters/ui/views/TextNode/TextNodeAsParent.js";
import type { TextNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

describe("<text-node-as-parent>", () => {
  it("renders Title + Description (§5 row 3)", async () => {
    const vm: TextNodeViewModel = {
      kind: "TextNode",
      id: "p1",
      title: "Quarterly review",
      description: "Top-level scorecard",
    };
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vm;
    });

    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    const description = el.shadowRoot?.querySelector('[data-testid="description"]');
    expect(title?.textContent?.trim()).toBe("Quarterly review");
    expect(description?.textContent?.trim()).toBe("Top-level scorecard");
  });

  it("does not render a value or a Σ badge (§5 — TextNode has no value)", async () => {
    const vm: TextNodeViewModel = {
      kind: "TextNode",
      id: "p2",
      title: "T",
      description: "D",
    };
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vm;
    });

    expect(el.shadowRoot?.querySelector('[data-testid="value"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="value-row"]')).toBeNull();
  });

  it("hides the description block when description is empty", async () => {
    const vm: TextNodeViewModel = {
      kind: "TextNode",
      id: "p3",
      title: "Bare",
      description: "",
    };
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vm;
    });

    const description = el.shadowRoot?.querySelector('[data-testid="description"]');
    expect(description?.classList.contains("empty")).toBe(true);
  });

  it("tags the rendered title with view-kind metadata for e2e selectors", async () => {
    const vm: TextNodeViewModel = {
      kind: "TextNode",
      id: "p4",
      title: "T",
      description: "",
    };
    const el = await mountLitElement<TextNodeAsParent>("text-node-as-parent", (e) => {
      e.vm = vm;
    });

    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    expect(title?.getAttribute("data-view-kind")).toBe("TextNode");
    expect(title?.getAttribute("data-id")).toBe("p4");
  });
});
