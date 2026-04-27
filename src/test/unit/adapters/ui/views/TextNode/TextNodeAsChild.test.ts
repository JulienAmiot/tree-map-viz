import { afterEach, describe, expect, it } from "vitest";

import "../../../../../../adapters/ui/views/TextNode/TextNodeAsChild.js";
import type { TextNodeAsChild } from "../../../../../../adapters/ui/views/TextNode/TextNodeAsChild.js";
import type { TextNodeViewModel } from "../../../../../../adapters/ui/views/NodeViewModel.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../../fixtures/litElementFixture.js";

afterEach(cleanupLitFixtures);

describe("<text-node-as-child>", () => {
  it("renders the same Title + Description fields as AsParent (§5 — uniform fields)", async () => {
    const vm: TextNodeViewModel = {
      kind: "TextNode",
      id: "c1",
      title: "Region",
      description: "North-east",
    };
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vm;
    });

    const title = el.shadowRoot?.querySelector('[data-testid="title"]');
    const description = el.shadowRoot?.querySelector('[data-testid="description"]');
    expect(title?.textContent?.trim()).toBe("Region");
    expect(description?.textContent?.trim()).toBe("North-east");
  });

  it("does not render a value or a Σ badge", async () => {
    const vm: TextNodeViewModel = {
      kind: "TextNode",
      id: "c2",
      title: "T",
      description: "D",
    };
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vm;
    });

    expect(el.shadowRoot?.querySelector('[data-testid="value"]')).toBeNull();
    expect(el.shadowRoot?.querySelector('[data-testid="computed-badge"]')).toBeNull();
  });

  it("hides description when empty", async () => {
    const vm: TextNodeViewModel = {
      kind: "TextNode",
      id: "c3",
      title: "Bare",
      description: "",
    };
    const el = await mountLitElement<TextNodeAsChild>("text-node-as-child", (e) => {
      e.vm = vm;
    });

    const description = el.shadowRoot?.querySelector('[data-testid="description"]');
    expect(description?.classList.contains("empty")).toBe(true);
  });
});
