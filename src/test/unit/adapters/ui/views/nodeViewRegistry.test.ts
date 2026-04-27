import { beforeEach, describe, expect, it } from "vitest";

import {
  nodeViewRegistry,
  NodeViewRegistryError,
} from "../../../../../adapters/ui/views/nodeViewRegistry.js";

describe("nodeViewRegistry", () => {
  beforeEach(() => {
    nodeViewRegistry.__resetForTests();
  });

  it("starts empty and unfrozen", () => {
    expect(nodeViewRegistry.isFrozen()).toBe(false);
    expect(() => nodeViewRegistry.lookup("TextNode", "asParent")).toThrow(
      NodeViewRegistryError,
    );
  });

  it("returns the registered tag for the right (kind, role)", () => {
    nodeViewRegistry.register("TextNode", {
      asParent: "tag-parent",
      asChild: "tag-child",
    });

    expect(nodeViewRegistry.lookup("TextNode", "asParent")).toBe("tag-parent");
    expect(nodeViewRegistry.lookup("TextNode", "asChild")).toBe("tag-child");
  });

  it("throws on lookup for a kind that was never registered", () => {
    expect(() =>
      nodeViewRegistry.lookup("BusinessScoreCardNode", "asParent"),
    ).toThrow(NodeViewRegistryError);
  });

  it("rejects re-registering the same kind (single-source-of-truth invariant)", () => {
    nodeViewRegistry.register("TextNode", {
      asParent: "x",
      asChild: "y",
    });
    expect(() =>
      nodeViewRegistry.register("TextNode", { asParent: "x2", asChild: "y2" }),
    ).toThrow(/already registered/);
  });

  it("freeze() blocks further register() calls", () => {
    nodeViewRegistry.register("TextNode", {
      asParent: "tag-parent",
      asChild: "tag-child",
    });
    nodeViewRegistry.freeze();

    expect(nodeViewRegistry.isFrozen()).toBe(true);
    expect(() =>
      nodeViewRegistry.register("BusinessScoreCardNode", {
        asParent: "p",
        asChild: "c",
      }),
    ).toThrow(/cannot register .* after freeze/);
  });

  it("__resetForTests clears entries and unfreezes (test-only escape hatch)", () => {
    nodeViewRegistry.register("TextNode", {
      asParent: "p",
      asChild: "c",
    });
    nodeViewRegistry.freeze();

    nodeViewRegistry.__resetForTests();

    expect(nodeViewRegistry.isFrozen()).toBe(false);
    expect(() => nodeViewRegistry.lookup("TextNode", "asParent")).toThrow(
      NodeViewRegistryError,
    );
  });
});
