import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import "../../../../../adapters/ui/molecules/NodeView.js";
import type { NodeView } from "../../../../../adapters/ui/molecules/NodeView.js";
import type { TextNodeViewModel } from "../../../../../adapters/ui/molecules/NodeViewModel.js";
import { nodeViewRegistry } from "../../../../../adapters/ui/molecules/nodeViewRegistry.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

class MockNodeViewElement extends HTMLElement {
  vm: TextNodeViewModel | null = null;
}

beforeAll(() => {
  if (!customElements.get("mock-text-parent")) {
    customElements.define("mock-text-parent", class extends MockNodeViewElement {});
  }
  if (!customElements.get("mock-text-child")) {
    customElements.define("mock-text-child", class extends MockNodeViewElement {});
  }
});

describe("<node-view> dispatcher", () => {
  beforeEach(() => {
    nodeViewRegistry.__resetForTests();
  });

  afterEach(() => {
    nodeViewRegistry.__resetForTests();
    cleanupLitFixtures();
  });

  it("renders an empty placeholder when vm is null", async () => {
    const el = await mountLitElement<NodeView>("node-view");
    expect(el.shadowRoot?.querySelector('[data-testid="node-view-empty"]')).not.toBeNull();
  });

  it("dispatches asChild to the registered child tag", async () => {
    nodeViewRegistry.register("TextNode", {
      asParent: "mock-text-parent",
      asChild: "mock-text-child",
    });

    const vm: TextNodeViewModel = {
      kind: "TextNode",
      id: "n1",
      title: "Hello",
      value: {
        text: "Hello world",
        dateIso: "2026-04-23T00:00:00.000Z",
        dateColor: "rgb(255, 145, 50)",
      },
    };
    const el = await mountLitElement<NodeView>("node-view", (e) => {
      e.vm = vm;
    });

    const child = el.shadowRoot?.querySelector("mock-text-child") as
      | MockNodeViewElement
      | null;
    expect(child).not.toBeNull();
    expect(child!.vm).toBe(vm);
    expect(el.shadowRoot?.querySelector("mock-text-parent")).toBeNull();
  });

  it("dispatches asParent to the registered parent tag", async () => {
    nodeViewRegistry.register("TextNode", {
      asParent: "mock-text-parent",
      asChild: "mock-text-child",
    });

    const vm: TextNodeViewModel = {
      kind: "TextNode",
      id: "n2",
      title: "T",
      value: { text: "", dateIso: "", dateColor: "" },
    };
    const el = await mountLitElement<NodeView>("node-view", (e) => {
      e.vm = vm;
      e.viewRole = "asParent";
    });

    expect(el.shadowRoot?.querySelector("mock-text-parent")).not.toBeNull();
    expect(el.shadowRoot?.querySelector("mock-text-child")).toBeNull();
  });

  it("reflects view-role to the host attribute", async () => {
    const el = await mountLitElement<NodeView>("node-view", (e) => {
      e.viewRole = "asParent";
    });
    expect(el.getAttribute("view-role")).toBe("asParent");
    expect(el.viewRole).toBe("asParent");
  });

  it("throws on lookup when the dispatched kind is not registered", () => {
    expect(() => nodeViewRegistry.lookup("TextNode", "asChild")).toThrow(
      /no view registered for kind "TextNode"/,
    );
  });
});
