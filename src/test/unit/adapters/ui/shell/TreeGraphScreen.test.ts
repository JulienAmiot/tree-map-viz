import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRILL_CLASS } from "../../../../../adapters/ui/animations/drillTransitions.js";
import "../../../../../adapters/ui/shell/TreeGraphScreen.js";
import { TreeGraphScreen } from "../../../../../adapters/ui/shell/TreeGraphScreen.js";
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
  value: {
    text: "Quarterly review",
    dateIso: "2026-04-23T00:00:00.000Z",
    dateColor: "rgb(255, 145, 50)",
  },
};

function nodeSlot(id: string, title: string, weight = 1): ChildSlotViewModel {
  return {
    slot: "node",
    weight,
    vm: {
      kind: "TextNode",
      id,
      title,
      value: {
        text: title,
        dateIso: "2026-04-23T00:00:00.000Z",
        dateColor: "rgb(255, 145, 50)",
      },
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
      value: {
        text: "Other",
        dateIso: "2026-04-23T00:00:00.000Z",
        dateColor: "rgb(255, 145, 50)",
      },
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

  it("`runDrillAnimation` commits immediately when the layout wrapper isn't rendered (view=null)", async () => {
    // Without a view, `.layout` doesn't exist; the helper has no host to
    // animate against, so commit fires synchronously. Pinned so a future
    // refactor doesn't accidentally swallow the commit on the loading path.
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
    const commit = vi.fn();
    el.runDrillAnimation("uuid-anything", commit);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("`runDrillAnimation` commits immediately when the tapped tile cannot be located (no children rendered)", async () => {
    // The shell falls through to a synchronous commit if the queried
    // `[data-id="<nodeId>"]` returns nothing — for instance after a
    // focus that has no real children, where the grid only renders a
    // plus tile. The navigation must still land; we just skip the
    // animation.
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, [plusSlot("uuid-root")]);
    });
    const commit = vi.fn();
    el.runDrillAnimation("uuid-missing", commit);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("`runDrillAnimation` morphs the tapped tile into the parent strip's geometry and commits after the settle window (\u00a717.32)", async () => {
    // jsdom returns 0/0 from getBoundingClientRect by default which would
    // trip the helper's degenerate-rect guard, so we stub both rects on
    // the live shell DOM. The assertion is that the `tile--drilling`
    // class lands on the tapped tile (not the layout wrapper) and the
    // commit fires after the settle window — i.e. the FLIP morph took
    // the place of the legacy `encap--drill` keyframe.
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, [nodeSlot("uuid-a", "A"), nodeSlot("uuid-b", "B")]);
    });
    const grid = el.shadowRoot?.querySelector("children-grid") as ChildrenGrid;
    // ChildrenGrid renders 0 tiles until its `ResizeObserver` callback
    // seeds non-zero dimensions (jsdom defaults are 0×0). Pick the
    // most recent observer that's watching this grid host and fire
    // a synthetic resize so the squarify layout produces tile
    // elements with `data-id="..."`.
    const gridObserver = FakeResizeObserver.instances
      .filter((obs) =>
        Array.from(obs.observed).some(
          (target) => target.tagName.toLowerCase() === "children-grid",
        ),
      )
      .at(-1);
    expect(gridObserver).toBeDefined();
    gridObserver!.fire([{ target: grid, rect: { width: 600, height: 300 } }]);
    await grid.updateComplete;

    vi.useFakeTimers();
    try {
      const tile = grid.shadowRoot?.querySelector<HTMLElement>(
        '[data-id="uuid-a"]',
      );
      const strip = el.shadowRoot?.querySelector<HTMLElement>(
        "parent-identity-strip",
      );
      expect(tile).not.toBeNull();
      expect(strip).not.toBeNull();
      // Stub rects so the FLIP math has real numbers to work with.
      tile!.getBoundingClientRect = (): DOMRect =>
        ({
          x: 100,
          y: 400,
          left: 100,
          top: 400,
          width: 200,
          height: 150,
          right: 300,
          bottom: 550,
          toJSON: () => "",
        }) as DOMRect;
      strip!.getBoundingClientRect = (): DOMRect =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          width: 800,
          height: 200,
          right: 800,
          bottom: 200,
          toJSON: () => "",
        }) as DOMRect;

      const commit = vi.fn();
      el.runDrillAnimation("uuid-a", commit);

      // While in flight: drill class on the tapped tile, translate
      // applied, custom-prop set so .title recolours (NOT a direct
      // `color` write that would cascade to every text node), strip
      // faded to 0 so the morphed tile owns the strip's slot during
      // the morph, commit not yet called.
      expect(tile!.classList.contains(DRILL_CLASS)).toBe(true);
      expect(tile!.style.transform).toContain("translate(-100px, -400px)");
      expect(tile!.style.getPropertyValue("--drill-title-color")).toBe(
        "var(--board-fresh)",
      );
      expect(tile!.style.color).toBe("");
      expect(strip!.style.opacity).toBe("0");
      expect(commit).not.toHaveBeenCalled();
      // §17.32 — the grid host's :host { overflow: hidden } would
      // otherwise clip the morphed tile's painted pixels at the
      // grid's top edge; the shell flips it to `visible` for the
      // duration of the drill so the tile is visible above the
      // grid's box (i.e. landing in the parent strip's territory).
      expect((grid as HTMLElement).style.overflow).toBe("visible");

      vi.runAllTimers();
      // updateComplete resolves on the microtask queue; flush.
      await Promise.resolve();
      expect(commit).toHaveBeenCalledTimes(1);
      expect(tile!.classList.contains(DRILL_CLASS)).toBe(false);
      // The inline overflow override is restored after commit so the
      // grid host's :host clipping rule resumes for normal renders.
      expect((grid as HTMLElement).style.overflow).toBe("");
      // §17.32 follow-up: the strip is the SAME element across focus
      // changes (Lit just updates its `vm` property), so the inline
      // `opacity: 0` we wrote during the drill MUST be cleared after
      // commit or the freshly-rendered parent pane stays invisible.
      expect(strip!.style.opacity).toBe("");
      expect(strip!.style.transition).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-exports `DRILL_CLASS` so callers/tests can pin the class name symbolically", () => {
    // Catches a future rename of the drill class without forcing every
    // test to reach into the helper.
    expect(TreeGraphScreen.DRILL_CLASS).toBe(DRILL_CLASS);
  });

  // -- §17.23 close-to-parent propagation -------------------------------

  it("threads the second-to-last breadcrumb segment into <parent-identity-strip>.parentId (§17.23)", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, [nodeSlot("a", "A")]);
      e.breadcrumbPath = [
        { id: "uuid-root", title: "Root" },
        { id: "uuid-parent", title: "Eng" },
        { id: "uuid-root", title: "Quarterly review" }, // focus
      ];
    });
    const strip = el.shadowRoot?.querySelector(
      "parent-identity-strip",
    ) as ParentIdentityStrip | null;
    expect(strip?.parentId).toBe("uuid-parent");
  });

  it("at root focus (path length \u2264 1) the strip's parentId is empty (no close-X) (§17.23)", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, []);
      e.breadcrumbPath = [{ id: "uuid-root", title: "Root" }];
    });
    const strip = el.shadowRoot?.querySelector(
      "parent-identity-strip",
    ) as ParentIdentityStrip | null;
    expect(strip?.parentId).toBe("");
  });

  it("recomputes the strip's parentId when breadcrumbPath updates (§17.23)", async () => {
    const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen", (e) => {
      e.view = focusedView(textVm, []);
      e.breadcrumbPath = [{ id: "uuid-root", title: "Root" }];
    });
    let strip = el.shadowRoot?.querySelector(
      "parent-identity-strip",
    ) as ParentIdentityStrip | null;
    expect(strip?.parentId).toBe("");

    el.breadcrumbPath = [
      { id: "uuid-root", title: "Root" },
      { id: "uuid-eng", title: "Eng" },
      { id: "uuid-deep", title: "Deep" },
    ];
    await el.updateComplete;
    strip = el.shadowRoot?.querySelector(
      "parent-identity-strip",
    ) as ParentIdentityStrip | null;
    expect(strip?.parentId).toBe("uuid-eng");
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

  // -- §17.28 edit-node modal seam ------------------------------------

  describe("edit-node modal seam (\u00a717.28)", () => {
    it("renders an <edit-node-modal> overlay (closed by default)", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      const modal = el.shadowRoot?.querySelector("edit-node-modal");
      expect(modal).not.toBeNull();
      expect(modal?.hasAttribute("open")).toBe(false);
      expect(el.isEditNodeModalOpen).toBe(false);
    });

    it("`openEditNodeModal(target)` opens the modal and seeds editTarget", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      el.openEditNodeModal({
        nodeId: "uuid-root",
        kind: "TextNode",
        title: "Quarterly review",
        weight: 2,
      });
      await el.updateComplete;
      const modal = el.editNodeModalElement!;
      expect(el.isEditNodeModalOpen).toBe(true);
      expect(modal.hasAttribute("open")).toBe(true);
      expect(modal.editTarget?.nodeId).toBe("uuid-root");
    });

    it("`edit-node-cancel` from the modal closes it", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      el.openEditNodeModal({
        nodeId: "uuid-root",
        kind: "TextNode",
        title: "X",
        weight: 1,
      });
      await el.updateComplete;
      expect(el.isEditNodeModalOpen).toBe(true);

      const modal = el.editNodeModalElement!;
      modal.dispatchEvent(
        new CustomEvent("edit-node-cancel", { bubbles: true, composed: true }),
      );
      await el.updateComplete;
      expect(el.isEditNodeModalOpen).toBe(false);
    });

    it("`closeEditNodeModal()` + `setEditNodeError(...)` are the public seams for the composition root", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      el.openEditNodeModal({
        nodeId: "uuid-root",
        kind: "TextNode",
        title: "X",
        weight: 1,
      });
      el.setEditNodeError("nope");
      expect(el.editNodeError).toBe("nope");
      el.closeEditNodeModal();
      expect(el.isEditNodeModalOpen).toBe(false);
      expect(el.editNodeError).toBeNull();
    });

    it("`edit-node-confirm` does NOT auto-close the modal -- composition root must call closeEditNodeModal()", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      el.openEditNodeModal({
        nodeId: "uuid-root",
        kind: "TextNode",
        title: "X",
        weight: 1,
      });
      await el.updateComplete;
      const modal = el.editNodeModalElement!;
      const handler = vi.fn();
      el.addEventListener("edit-node-confirm", handler);
      modal.dispatchEvent(
        new CustomEvent("edit-node-confirm", {
          bubbles: true,
          composed: true,
          detail: {
            nodeId: "uuid-root",
            payload: { kind: "TextNode", title: "Renamed" },
          },
        }),
      );
      await el.updateComplete;
      expect(handler).toHaveBeenCalledTimes(1);
      expect(el.isEditNodeModalOpen).toBe(true);
    });
  });

  // -- §17.34 boards-panel modal seam ---------------------------------

  describe("boards-panel modal seam (\u00a717.34)", () => {
    it("renders a <boards-panel-modal> overlay (closed by default)", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      const modal = el.shadowRoot?.querySelector("boards-panel-modal");
      expect(modal).not.toBeNull();
      expect(modal?.hasAttribute("open")).toBe(false);
      expect(el.isBoardsPanelModalOpen).toBe(false);
    });

    it("`openBoardsPanelModal(target)` opens the modal and seeds the target", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      el.openBoardsPanelModal({
        boards: [
          { id: "uuid-A", name: "Showcase" },
          { id: "uuid-B", name: "Personal" },
        ],
        currentBoardId: "uuid-A",
      });
      await el.updateComplete;
      const modal = el.boardsPanelModalElement!;
      expect(el.isBoardsPanelModalOpen).toBe(true);
      expect(modal.hasAttribute("open")).toBe(true);
      expect(modal.target?.currentBoardId).toBe("uuid-A");
      expect(modal.target?.boards).toHaveLength(2);
    });

    it("`boards-panel-cancel` from the modal closes it", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      el.openBoardsPanelModal({
        boards: [{ id: "uuid-A", name: "Showcase" }],
        currentBoardId: "uuid-A",
      });
      await el.updateComplete;
      expect(el.isBoardsPanelModalOpen).toBe(true);
      const modal = el.boardsPanelModalElement!;
      modal.dispatchEvent(
        new CustomEvent("boards-panel-cancel", {
          bubbles: true,
          composed: true,
        }),
      );
      await el.updateComplete;
      expect(el.isBoardsPanelModalOpen).toBe(false);
    });

    it("`closeBoardsPanelModal()` + `setBoardsPanelError(...)` are the public seams for the composition root", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      el.openBoardsPanelModal({
        boards: [{ id: "uuid-A", name: "Showcase" }],
        currentBoardId: "uuid-A",
      });
      el.setBoardsPanelError("Board name cannot be empty.");
      expect(el.boardsPanelError).toBe("Board name cannot be empty.");
      el.closeBoardsPanelModal();
      expect(el.isBoardsPanelModalOpen).toBe(false);
      expect(el.boardsPanelError).toBeNull();
    });

    it("`boards-panel-switch` does NOT auto-close the modal -- composition root must call closeBoardsPanelModal()", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      el.openBoardsPanelModal({
        boards: [
          { id: "uuid-A", name: "Showcase" },
          { id: "uuid-B", name: "Personal" },
        ],
        currentBoardId: "uuid-A",
      });
      await el.updateComplete;
      const modal = el.boardsPanelModalElement!;
      const handler = vi.fn();
      el.addEventListener("boards-panel-switch", handler);
      modal.dispatchEvent(
        new CustomEvent("boards-panel-switch", {
          bubbles: true,
          composed: true,
          detail: { boardId: "uuid-B" },
        }),
      );
      await el.updateComplete;
      expect(handler).toHaveBeenCalledTimes(1);
      expect(el.isBoardsPanelModalOpen).toBe(true);
    });

    it("`boards-panel-create` does NOT auto-close the modal -- composition root must call closeBoardsPanelModal()", async () => {
      const el = await mountLitElement<TreeGraphScreen>("tree-graph-screen");
      el.openBoardsPanelModal({
        boards: [{ id: "uuid-A", name: "Showcase" }],
        currentBoardId: "uuid-A",
      });
      await el.updateComplete;
      const modal = el.boardsPanelModalElement!;
      const handler = vi.fn();
      el.addEventListener("boards-panel-create", handler);
      modal.dispatchEvent(
        new CustomEvent("boards-panel-create", {
          bubbles: true,
          composed: true,
          detail: { name: "Roadmap" },
        }),
      );
      await el.updateComplete;
      expect(handler).toHaveBeenCalledTimes(1);
      expect(el.isBoardsPanelModalOpen).toBe(true);
    });
  });
});
