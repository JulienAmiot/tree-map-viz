import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "../../../../../adapters/ui/shell/TreeGraphScreen.js";
import type { TreeGraphScreen } from "../../../../../adapters/ui/shell/TreeGraphScreen.js";
import type { ChildrenGrid } from "../../../../../adapters/ui/shell/ChildrenGrid.js";
import type { ParentIdentityStrip } from "../../../../../adapters/ui/shell/ParentIdentityStrip.js";
import type {
  ChildSlotViewModel,
  FocusedTreeViewModel,
  NodeViewModel,
} from "../../../../../adapters/ui/views/NodeViewModel.js";
import { FakeResizeObserver } from "../../../../fixtures/fakeResizeObserver.js";
import {
  cleanupLitFixtures,
  mountLitElement,
} from "../../../../fixtures/litElementFixture.js";

/**
 * Vitest unit tests for `<tree-graph-screen>`. The shell delegates rendering
 * of the focused node + children to `<parent-identity-strip>` and
 * `<children-grid>`; these tests confirm the composition wiring
 * (vm/slots propagation, loading state, orientation reflection) without
 * re-asserting the per-kind/per-role view contract that the views already
 * own (SPEC §17.9).
 */

let originalRO: typeof globalThis.ResizeObserver;

beforeEach(() => {
  originalRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  FakeResizeObserver.reset();
});

afterEach(() => {
  cleanupLitFixtures();
  globalThis.ResizeObserver = originalRO;
});

const textVm: NodeViewModel = {
  kind: "TextNode",
  id: "uuid-root",
  title: "Quarterly review",
  description: "Top-level scorecard",
};

function nodeSlot(id: string, title: string, weight = 1): ChildSlotViewModel {
  return {
    slot: "node",
    weight,
    vm: { kind: "TextNode", id, title, description: "" },
  };
}

function plusSlot(parentId: string, weight = 1): ChildSlotViewModel {
  return { slot: "plus", weight, parentId };
}

function focusedView(
  center: NodeViewModel,
  children: readonly ChildSlotViewModel[],
): FocusedTreeViewModel {
  return { center, children };
}

describe("<tree-graph-screen>", () => {
  it("renders a loading placeholder when view is null", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
    const loading = el.shadowRoot?.querySelector('[data-testid="loading"]');
    expect(loading).not.toBeNull();
    expect(el.shadowRoot?.querySelector("parent-identity-strip")).toBeNull();
    expect(el.shadowRoot?.querySelector("children-grid")).toBeNull();
  });

  it("composes <parent-identity-strip> + <children-grid> when view is set", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, [nodeSlot("a", "A"), plusSlot("uuid-root")]);
    });

    const strip = el.shadowRoot?.querySelector(
      "parent-identity-strip",
    ) as ParentIdentityStrip | null;
    const grid = el.shadowRoot?.querySelector(
      "children-grid",
    ) as ChildrenGrid | null;

    expect(strip).not.toBeNull();
    expect(grid).not.toBeNull();
    expect(strip?.vm).toEqual(textVm);
    expect(grid?.slots).toHaveLength(2);
    expect(grid?.slots[0]).toMatchObject({ slot: "node", vm: { id: "a" } });
    expect(grid?.slots[1]).toMatchObject({ slot: "plus", parentId: "uuid-root" });
  });

  it("re-propagates the new vm/slots when view changes", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, [nodeSlot("a", "A")]);
    });

    const next: NodeViewModel = {
      kind: "TextNode",
      id: "uuid-other",
      title: "Other",
      description: "",
    };
    el.view = focusedView(next, [nodeSlot("b", "B"), nodeSlot("c", "C")]);
    await el.updateComplete;

    const strip = el.shadowRoot?.querySelector(
      "parent-identity-strip",
    ) as ParentIdentityStrip | null;
    const grid = el.shadowRoot?.querySelector(
      "children-grid",
    ) as ChildrenGrid | null;
    expect(strip?.vm?.id).toBe("uuid-other");
    expect(grid?.slots).toHaveLength(2);
    expect(grid?.slots[0]?.slot).toBe("node");
  });

  it("reflects the controller's orientation onto the layout wrapper", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, []);
    });

    let layout = el.shadowRoot?.querySelector(
      '[data-testid="layout"]',
    ) as HTMLElement | null;
    expect(layout?.dataset["orientation"]).toBe("landscape");

    const observer = FakeResizeObserver.instances.find((o) => o.observed.has(el));
    expect(observer).toBeDefined();
    observer!.fire([{ target: el, rect: { width: 200, height: 800 } }]);
    await el.updateComplete;

    layout = el.shadowRoot?.querySelector(
      '[data-testid="layout"]',
    ) as HTMLElement | null;
    expect(layout?.dataset["orientation"]).toBe("portrait");
  });

  it("hides the loading placeholder once a view is set", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
    expect(el.shadowRoot?.querySelector('[data-testid="loading"]')).not.toBeNull();

    el.view = focusedView(textVm, []);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('[data-testid="loading"]')).toBeNull();
  });
});
