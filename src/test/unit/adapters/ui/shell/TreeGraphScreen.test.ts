import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../../../../adapters/ui/shell/TreeGraphScreen.js";
import type { TreeGraphScreen } from "../../../../../adapters/ui/shell/TreeGraphScreen.js";
import type { AddChildModal } from "../../../../../adapters/ui/modal/AddChildModal.js";
import type { FocusBreadcrumb } from "../../../../../adapters/ui/shell/Breadcrumb.js";
import type { ChildrenGrid } from "../../../../../adapters/ui/shell/ChildrenGrid.js";
import type { ParentIdentityStrip } from "../../../../../adapters/ui/shell/ParentIdentityStrip.js";
import type {
  ChildSlotViewModel,
  FocusedTreeViewModel,
  NodeViewModel,
} from "../../../../../adapters/ui/views/NodeViewModel.js";
import { PLUS_TILE_ACTIVATE_EVENT } from "../../../../../adapters/ui/views/plus/PlusTile.js";
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
  value: { text: "Quarterly review", dateIso: "2026-04-23T00:00:00.000Z" },
};

function nodeSlot(id: string, title: string, weight = 1): ChildSlotViewModel {
  return {
    slot: "node",
    weight,
    vm: {
      kind: "TextNode",
      id,
      title,
      value: { text: title, dateIso: "2026-04-23T00:00:00.000Z" },
    },
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
      value: { text: "Other", dateIso: "2026-04-23T00:00:00.000Z" },
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

  it("renders the drawer + drawer-content (board name, breadcrumb, burger) at all times — even before view is set", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.boardName = "Quarterly OKRs";
      e.breadcrumbPath = [
        { id: "uuid-root", title: "Root" },
        { id: "uuid-eng", title: "Engineering" },
      ];
    });

    const drawer = el.shadowRoot?.querySelector('[data-testid="drawer"]');
    const boardName = el.shadowRoot?.querySelector('[data-testid="board-name"]');
    const crumb = el.shadowRoot?.querySelector(
      "focus-breadcrumb",
    ) as FocusBreadcrumb | null;
    const burger = el.shadowRoot?.querySelector("burger-menu");

    expect(drawer).not.toBeNull();
    expect(boardName?.textContent?.trim()).toBe("Quarterly OKRs");
    expect(burger).not.toBeNull();
    expect(crumb?.path).toHaveLength(2);
    expect(crumb?.path[0]?.title).toBe("Root");
    expect(crumb?.path[1]?.title).toBe("Engineering");
  });

  it("propagates updates to boardName + breadcrumbPath into the slotted children", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.boardName = "First";
      e.breadcrumbPath = [{ id: "uuid-root", title: "Root" }];
    });

    el.boardName = "Second";
    el.breadcrumbPath = [
      { id: "uuid-root", title: "Root" },
      { id: "uuid-x", title: "X" },
      { id: "uuid-y", title: "Y" },
    ];
    await el.updateComplete;

    const boardName = el.shadowRoot?.querySelector(
      '[data-testid="board-name"]',
    );
    const crumb = el.shadowRoot?.querySelector(
      "focus-breadcrumb",
    ) as FocusBreadcrumb | null;
    expect(boardName?.textContent?.trim()).toBe("Second");
    expect(crumb?.path.map((s) => s.id)).toEqual([
      "uuid-root",
      "uuid-x",
      "uuid-y",
    ]);
  });

  it("renders an <add-child-modal> overlay (closed by default) at all times", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
    const modal = el.shadowRoot?.querySelector("add-child-modal") as
      | AddChildModal
      | null;
    expect(modal).not.toBeNull();
    expect(modal?.hasAttribute("open")).toBe(false);
    expect(el.isAddChildModalOpen).toBe(false);
  });

  it("`plus-tile-activate` from inside the layout opens the modal with the supplied parentId", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, [nodeSlot("a", "A"), plusSlot("uuid-root")]);
    });
    expect(el.isAddChildModalOpen).toBe(false);

    const layout = el.shadowRoot?.querySelector(
      '[data-testid="layout"]',
    ) as HTMLElement | null;
    expect(layout).not.toBeNull();
    layout!.dispatchEvent(
      new CustomEvent(PLUS_TILE_ACTIVATE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { parentId: "uuid-root" },
      }),
    );
    await el.updateComplete;

    const modal = el.shadowRoot?.querySelector("add-child-modal") as
      | AddChildModal
      | null;
    expect(el.isAddChildModalOpen).toBe(true);
    expect(modal?.hasAttribute("open")).toBe(true);
    expect(modal?.parentId).toBe("uuid-root");
  });

  it("`add-child-cancel` from the modal closes it (without re-emitting through the screen)", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, [plusSlot("uuid-root")]);
    });
    const layout = el.shadowRoot?.querySelector(
      '[data-testid="layout"]',
    ) as HTMLElement;
    layout.dispatchEvent(
      new CustomEvent(PLUS_TILE_ACTIVATE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { parentId: "uuid-root" },
      }),
    );
    await el.updateComplete;
    expect(el.isAddChildModalOpen).toBe(true);

    const modal = el.addChildModalElement!;
    modal.dispatchEvent(
      new CustomEvent("add-child-cancel", { bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(el.isAddChildModalOpen).toBe(false);
  });

  it("`closeAddChildModal()` is the public seam for the composition root", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
    const layout = el.shadowRoot?.querySelector('[data-testid="loading"]');
    expect(layout).not.toBeNull(); // sanity: shell still renders before view
    el.dispatchEvent(
      new CustomEvent(PLUS_TILE_ACTIVATE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { parentId: "uuid-x" },
      }),
    );
    // No layout wrapper (view=null) ⇒ event handler isn't attached;
    // simulate the open state directly via the public seam instead.
    el.setAddChildError("nope");
    expect(el.addChildError).toBe("nope");
    el.closeAddChildModal();
    expect(el.addChildError).toBeNull();
    expect(el.isAddChildModalOpen).toBe(false);
  });

  it("`add-child-confirm` does NOT auto-close the modal — the composition root must call `closeAddChildModal()`", async () => {
    // Why: the composition root needs to call AddChildService and only on
    // success close. The shell deliberately does NOT close on confirm so a
    // failed addChild can leave the modal open with an error.
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, [plusSlot("uuid-root")]);
    });
    const layout = el.shadowRoot?.querySelector(
      '[data-testid="layout"]',
    ) as HTMLElement;
    layout.dispatchEvent(
      new CustomEvent(PLUS_TILE_ACTIVATE_EVENT, {
        bubbles: true,
        composed: true,
        detail: { parentId: "uuid-root" },
      }),
    );
    await el.updateComplete;
    expect(el.isAddChildModalOpen).toBe(true);

    const modal = el.addChildModalElement!;
    const confirmHandler = vi.fn();
    el.addEventListener("add-child-confirm", confirmHandler);
    modal.dispatchEvent(
      new CustomEvent("add-child-confirm", {
        bubbles: true,
        composed: true,
        detail: { parentId: "uuid-root", payload: { kind: "TextNode", title: "ok" } },
      }),
    );
    await el.updateComplete;
    // Event bubbled to the shell:
    expect(confirmHandler).toHaveBeenCalledTimes(1);
    // Modal stayed open — the shell does not auto-close:
    expect(el.isAddChildModalOpen).toBe(true);
  });
});
