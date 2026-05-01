/**
 * Composition root (SPEC §14.5).
 *
 * The only file in `src/` that imports concrete adapters and wires them
 * into application services. Layered import contract: this file is the
 * single allowed bridge from `domain` + `application` to `adapters`.
 *
 * Phase 5 wiring (DT-9 — BDD harness):
 *   IdGen → LocalStorageRepo → BoardCollectionService.create
 *   → TreeNavigationService over the current board's tree
 *   → HashRouter ↔ navigation (URL is the source of truth for focus)
 *   → `<tree-graph-screen>` rendered through a plain VM
 *   → Test bridge installed iff `?test=1` (lazy import, tree-shaken otherwise)
 *
 * Phase 6 wiring (DT-5 — Lit views):
 *   + `mapFocusedToViewModel` translates `FocusedTreeView` (domain types)
 *     into the plain `FocusedTreeViewModel` consumed by `<tree-graph-screen>`
 *     and the `<node-view>` dispatcher. Domain types still never cross the
 *     UI property boundary; the mapper itself sits under `adapters/ui/views/`.
 *
 * Phase 7 wiring (DT-6 — Lit shell + chrome):
 *   + The shell now also receives `boardName` (from the current board on
 *     `BoardCollectionService`) and a `breadcrumbPath` (from
 *     `walkPath(boardTree, focusedId)` mapped to plain `{ id, title }`).
 *     Both are recomputed on every refresh, so the drawer chrome stays in
 *     sync with the focus + board state.
 *   + The shell emits `breadcrumb-navigate` `{ nodeId }` when the user taps
 *     an ancestor segment; the composition root drives `nav.focusByUuid` +
 *     `refresh()` synchronously and also `router.push(...)` so the URL stays
 *     in sync with focus state (SPEC §11.3). `router.push` uses
 *     `history.pushState`, which does NOT fire `hashchange`, so the
 *     `router.onChange` listener wouldn't see internal navigation; we drive
 *     the state update locally and let `router.onChange` cover external
 *     changes (browser back/forward, manual hash edits, the test bridge).
 *   + `burger-menu-action` `{ action }` is logged today as a placeholder;
 *     the real Import / Export / Boards consumers (`ImportExportService`,
 *     `BoardCollectionService` mutation surface) wire in Phase 10
 *     per SPEC §15.4 + §17.3.
 *
 * Phase 8 wiring (DT-7 — Add-child modal):
 *   + `AddChildService` lands here. Its `Persister` callback re-saves the
 *     current board collection through the `BoardCollectionRepository`
 *     port; the in-memory tree mutation done by `parent.attach(child)` is
 *     captured by `repo.save({ boards: list, currentBoardId })` because
 *     each board's `tree` is the same reference the service mutated.
 *   + `add-child-confirm` `{ parentId, payload }` triggers
 *     `AddChildService.addChild(parent, payload)`. On success the modal
 *     closes and `refresh()` repaints the focused view (with the new
 *     child + the now-correctly-budgeted plus-tile slot, per
 *     `shouldRenderPlusTile`). On failure the screen renders an inline
 *     error and the modal stays open for retry.
 *
 * Phase 9 wiring (drill animation), rewritten in §17.32:
 *   + `tile-drill` `{ nodeId }` from `<children-grid>` triggers
 *     `screen.runDrillAnimation(nodeId, commit)` where `commit` runs the
 *     same `nav.focusByUuid + router.push + refresh` triple that the
 *     breadcrumb handler uses. The `nodeId` lets the shell locate the
 *     tapped tile and morph it (FLIP-style) into the parent-identity-
 *     strip's bounding rect while siblings fade out. Reduced-motion
 *     (or testBridge `dismissAnimations`) makes the helper short-
 *     circuit the animation and commit synchronously, so the e2e
 *     suite doesn't need to wait for the settle window.
 */

import { LocalStorageBoardCollectionRepository } from "./adapters/persistence/LocalStorageBoardCollectionRepository.js";
import { decode, encode } from "./adapters/persistence/jsonCodec.js";
import { HashRouter } from "./adapters/routing/HashRouter.js";
import type { AddChildConfirmDetail } from "./adapters/ui/modal/AddChildModal.js";
import type {
  BoardSettingsConfirmDetail,
  BoardSettingsDeleteDetail,
} from "./adapters/ui/modal/BoardSettingsModal.js";
import type {
  EditNodeConfirmDetail,
  EditNodeTarget,
} from "./adapters/ui/modal/EditNodeModal.js";
import type {
  BreadcrumbNavigateDetail,
  BreadcrumbSegment,
} from "./adapters/ui/shell/Breadcrumb.js";
import type { BurgerMenuActionDetail } from "./adapters/ui/shell/BurgerMenu.js";
import type { TileDrillDetail } from "./adapters/ui/shell/ChildrenGrid.js";
import type {
  EditNodeOpenDetail,
  FocusCloseToParentDetail,
} from "./adapters/ui/shell/ParentIdentityStrip.js";
import "./adapters/ui/shell/TreeGraphScreen.js";
import type { TreeGraphScreen } from "./adapters/ui/shell/TreeGraphScreen.js";
import type { InlineEditTitleDetail } from "./adapters/ui/views/inlineEditEvents.js";
import type { InlineEditValueDetail } from "./adapters/ui/views/inlineEditEvents.js";
import { DEFAULT_FRESH_COLOR } from "./adapters/ui/views/dateAgeColor.js";
import { mapFocusedToViewModel } from "./adapters/ui/views/viewModelMapper.js";
import { AddChildService } from "./application/AddChildService.js";
import { BoardCollectionService } from "./application/BoardCollectionService.js";
import { EditNodeService } from "./application/EditNodeService.js";
import { TreeNavigationService } from "./application/TreeNavigationService.js";
import { BusinessScoreCardNode } from "./domain/nodes/BusinessScoreCardNode.js";
import { TextNode } from "./domain/nodes/TextNode.js";
import type { TreeNode } from "./domain/nodes/TreeNode.js";
import { findNodeById, walkPath } from "./domain/treeQueries.js";
import "./index.css";

async function main(): Promise<void> {
  const idGen = (): string => crypto.randomUUID();
  const codec = { encode, decode };
  const repo = new LocalStorageBoardCollectionRepository({ storage: window.localStorage });
  const boards = await BoardCollectionService.create(repo, idGen);
  const router = new HashRouter(window);

  const board = boards.getCurrentBoard();
  const nav = new TreeNavigationService(board.tree);

  const screen = document.querySelector<TreeGraphScreen>("tree-graph-screen");
  if (!screen) {
    throw new Error("composition: <tree-graph-screen> not present in document");
  }

  const persistCurrent = async (): Promise<void> => {
    await repo.save({
      boards: [...boards.list()],
      currentBoardId: boards.getCurrentBoardId(),
    });
  };
  const addChildSvc = new AddChildService(idGen, persistCurrent);
  const editNodeSvc = new EditNodeService(persistCurrent);

  const refresh = (): void => {
    const view = nav.getFocusedView();
    const current = boards.getCurrentBoard();
    // SPEC §17.21 — every refresh threads the board's `freshDateColor`
    // through the mapper so each tile's pre-baked `dateColor` reflects
    // the current board's theme. Boards without a colour fall back to
    // the §17.18 default warm orange inside `dateAgeColor`.
    const freshColor = current.freshDateColor ?? DEFAULT_FRESH_COLOR;
    const mapperOptions = current.freshDateColor
      ? { freshDateColor: current.freshDateColor }
      : {};
    // SPEC §17.31 — also expose the resolved fresh-colour as a CSS
    // custom property on the screen host so non-timestamp surfaces
    // (focused-panel title) can paint themselves with the same board
    // accent. Custom properties cascade through shadow boundaries
    // downward, so setting `--board-fresh` once on the screen host
    // is visible to every per-view shadow tree without further
    // plumbing. The fallback applies for boards that have no
    // `freshDateColor` set, mirroring the mapper's
    // `dateAgeColor` fallback so the title and the timestamp's fresh
    // endpoint always agree.
    screen.style.setProperty("--board-fresh", freshColor);
    screen.view = view
      ? mapFocusedToViewModel(view.center, view.childrenNodes, mapperOptions)
      : null;
    screen.boardName = current.name;
    screen.breadcrumbPath = computeBreadcrumb(current.tree, nav.getFocusedId());
  };

  screen.addEventListener("add-child-confirm", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<AddChildConfirmDetail>).detail;
      const parent = findNodeById(boards.getCurrentBoard().tree, detail.parentId);
      if (!parent) {
        screen.setAddChildError(`Parent node "${detail.parentId}" not found.`);
        return;
      }
      const result = await addChildSvc.addChild(parent, detail.payload);
      if (!result.ok) {
        screen.setAddChildError(result.reason);
        return;
      }
      screen.closeAddChildModal();
      refresh();
    })();
  });

  screen.addEventListener("breadcrumb-navigate", (e) => {
    const detail = (e as CustomEvent<BreadcrumbNavigateDetail>).detail;
    const r = nav.focusByUuid(detail.nodeId);
    if (!r.ok) {
      return;
    }
    router.push({
      boardId: boards.getCurrentBoardId(),
      focusNodeUuid: detail.nodeId,
    });
    refresh();
  });

  // SPEC §17.23 — the close-X on the focused-panel strip emits this event
  // with the parent's id. Same commit triple as breadcrumb-navigate; we
  // intentionally do NOT animate (the §17.20 drill-out cue `encap--leave`
  // is deferred). If `focusByUuid` rejects (stale id), we silently
  // ignore — the strip won't render the X next refresh anyway.
  screen.addEventListener("focus-close-to-parent", (e) => {
    const detail = (e as CustomEvent<FocusCloseToParentDetail>).detail;
    const r = nav.focusByUuid(detail.parentId);
    if (!r.ok) {
      return;
    }
    router.push({
      boardId: boards.getCurrentBoardId(),
      focusNodeUuid: detail.parentId,
    });
    refresh();
  });

  // SPEC §17.28 — the pencil button on the focused-panel strip emits
  // `edit-node-open { nodeId }`. The composition root resolves the
  // domain node from the current board's tree, builds the pre-edit
  // snapshot (the modal is a pure consumer that doesn't know about
  // `TreeNode`), and asks the screen to open `<edit-node-modal>`. A
  // stale id (the focused id changed between render and tap) silently
  // no-ops; the strip won't render the pencil for an absent vm.
  screen.addEventListener("edit-node-open", (e) => {
    const detail = (e as CustomEvent<EditNodeOpenDetail>).detail;
    const node = findNodeById(boards.getCurrentBoard().tree, detail.nodeId);
    if (!node) {
      return;
    }
    const target = buildEditTarget(node);
    if (!target) {
      return;
    }
    screen.openEditNodeModal(target);
  });

  // SPEC §17.28 — modal Confirm path. The service is the conversion
  // boundary: it folds the plain payload into domain value objects,
  // applies the partial update in place, persists, and rolls back on
  // failure. On success we close the modal and refresh; on failure
  // the modal stays open and surfaces the reason inline.
  screen.addEventListener("edit-node-confirm", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<EditNodeConfirmDetail>).detail;
      const node = findNodeById(boards.getCurrentBoard().tree, detail.nodeId);
      if (!node) {
        screen.setEditNodeError(`Node "${detail.nodeId}" not found.`);
        return;
      }
      const result = await editNodeSvc.editFields(node, detail.payload);
      if (!result.ok) {
        screen.setEditNodeError(result.reason);
        return;
      }
      screen.closeEditNodeModal();
      refresh();
    })();
  });

  // SPEC §17.28 — inline title edit on the focused-panel views. Same
  // service path as the modal confirm, but with a one-field payload
  // (just `title`). Rejection (e.g. empty title trips `Title.of`)
  // surfaces silently — the view restores the previous title on its
  // next refresh because we don't call `refresh()` on failure.
  screen.addEventListener("inline-edit-title", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<InlineEditTitleDetail>).detail;
      const node = findNodeById(boards.getCurrentBoard().tree, detail.nodeId);
      if (!node) {
        return;
      }
      const kind = inferKind(node);
      if (!kind) {
        return;
      }
      const result = await editNodeSvc.editFields(node, {
        kind,
        title: detail.title,
      });
      if (!result.ok) {
        // Force a refresh anyway so the view re-paints with the
        // pre-edit title (the local input reverts to whatever the
        // VM says, which is unchanged because the rollback restored
        // it).
        refresh();
        return;
      }
      refresh();
    })();
  });

  // SPEC §17.28 — inline value edit on the focused-panel views.
  // Appends a new `TimestampedValue` to the node's history; the date
  // defaults to "now" (the inline edit doesn't expose a date field —
  // the kiosk operator's "I just measured this" flow). The view
  // re-renders from the latest history entry on `refresh()`.
  screen.addEventListener("inline-edit-value", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<InlineEditValueDetail>).detail;
      const node = findNodeById(boards.getCurrentBoard().tree, detail.nodeId);
      if (!node) {
        return;
      }
      const asOf = detail.asOf ?? new Date();
      const result = await editNodeSvc.appendValue(node, detail.value, asOf);
      if (!result.ok) {
        refresh();
        return;
      }
      refresh();
    })();
  });

  screen.addEventListener("tile-drill", (e) => {
    const detail = (e as CustomEvent<TileDrillDetail>).detail;
    // §17.32 — the screen needs the tapped nodeId so it can locate the
    // tile element + drive the FLIP morph from its current position to
    // the parent-identity-strip's bounding rect. The commit closure is
    // unchanged from §17.20.
    screen.runDrillAnimation(detail.nodeId, () => {
      const r = nav.focusByUuid(detail.nodeId);
      if (!r.ok) {
        return;
      }
      router.push({
        boardId: boards.getCurrentBoardId(),
        focusNodeUuid: detail.nodeId,
      });
      refresh();
    });
  });

  screen.addEventListener("burger-menu-action", (e) => {
    const detail = (e as CustomEvent<BurgerMenuActionDetail>).detail;
    if (detail.action === "settings") {
      // SPEC §17.31 — open the board-settings modal pre-filled with
      // the current board. `canDelete` is false when the collection
      // holds a single board (the `getCurrentBoard` invariant).
      const current = boards.getCurrentBoard();
      screen.openBoardSettingsModal({
        boardId: current.id,
        name: current.name,
        freshDateColor: current.freshDateColor ?? "",
        canDelete: boards.list().length > 1,
      });
      return;
    }
    // Placeholder: the real Import / Export / Boards consumers land in
    // Phase 10 (Persistence + Routing), per SPEC §15.4 + §17.3.
    console.info("[main] burger-menu-action (placeholder)", detail.action);
  });

  screen.addEventListener("board-settings-confirm", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<BoardSettingsConfirmDetail>).detail;
      const result = await boards.updateSettings(detail.boardId, {
        name: detail.name,
        freshDateColor: detail.freshDateColor,
      });
      if (!result.ok) {
        screen.setBoardSettingsError(result.reason);
        return;
      }
      screen.closeBoardSettingsModal();
      refresh();
    })();
  });

  screen.addEventListener("board-settings-delete", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<BoardSettingsDeleteDetail>).detail;
      const result = await boards.deleteBoard(detail.boardId);
      if (!result.ok) {
        screen.setBoardSettingsError(result.reason);
        return;
      }
      // After a delete the current board may have changed; refresh
      // the tree (router stays on the old board id but the focus
      // resolves to the new current's root via the fallback path).
      const newCurrent = boards.getCurrentBoard();
      const newRootId = newCurrent.tree.id;
      // Re-seat the navigation service to the (now-current) board's
      // tree root so the next refresh resolves valid focus.
      nav.replaceTree(newCurrent.tree);
      router.replace({
        boardId: newCurrent.id,
        focusNodeUuid: newRootId,
      });
      screen.closeBoardSettingsModal();
      refresh();
    })();
  });

  const startRoute = router.current();
  if (startRoute && startRoute.boardId === boards.getCurrentBoardId()) {
    nav.focusByUuid(startRoute.focusNodeUuid);
  } else {
    router.replace({ boardId: boards.getCurrentBoardId(), focusNodeUuid: nav.getRoot().id });
  }
  refresh();

  router.onChange((state) => {
    if (!state || state.boardId !== boards.getCurrentBoardId()) {
      return;
    }
    const r = nav.focusByUuid(state.focusNodeUuid);
    if (!r.ok) {
      router.replace({ boardId: boards.getCurrentBoardId(), focusNodeUuid: nav.getRoot().id });
      nav.focusByUuid(nav.getRoot().id);
    }
    refresh();
  });

  if (new URL(window.location.href).searchParams.get("test") === "1") {
    const { installTestBridge } = await import("./adapters/testBridge.js");
    installTestBridge(window, { repo, codec, router });
  }
}

function computeBreadcrumb(
  root: TreeNode<unknown>,
  focusedId: string,
): readonly BreadcrumbSegment[] {
  const path = walkPath(root, focusedId);
  if (!path) {
    return [];
  }
  return path.map((n) => ({ id: n.id, title: n.identity.title.value }));
}

/**
 * SPEC §17.28 — build the pre-edit snapshot the modal consumes from a
 * domain node. Encoded here (not in the modal) because translating
 * `TreeNode → EditNodeTarget` is the same domain → plain-data boundary
 * the rest of the composition root crosses; the modal stays a pure
 * consumer. Returns `null` for unknown subclasses so the caller can
 * silently no-op (defensive — every TreeNode in the codebase is one
 * of the two known kinds today).
 *
 * `objective.targetDateIso` is the UTC ISO `YYYY-MM-DD` slice expected
 * by `<input type="date">`; the modal converts it back to a real `Date`
 * on confirm.
 */
function buildEditTarget(node: TreeNode<unknown>): EditNodeTarget | null {
  const title = node.identity.title.value;
  const weight = node.weight.value;
  if (node instanceof TextNode) {
    return {
      nodeId: node.id,
      kind: "TextNode",
      title,
      weight,
    };
  }
  if (node instanceof BusinessScoreCardNode) {
    const objective = node.card.objective;
    return {
      nodeId: node.id,
      kind: "BusinessScoreCardNode",
      title,
      description: node.identity.description.value,
      weight,
      unit: node.card.unit.value,
      objective: {
        initialValue: Number(objective.initialValue),
        targetValue: Number(objective.targetValue),
        targetDateIso: objective.targetDate.toISOString().slice(0, 10),
      },
      computed: node.computed,
      eligibleForParentComputation: node.eligibleForParentComputation,
    };
  }
  return null;
}

/** SPEC §17.28 — per-kind discriminator used by the inline-edit-title path. */
function inferKind(
  node: TreeNode<unknown>,
): "TextNode" | "BusinessScoreCardNode" | null {
  if (node instanceof TextNode) return "TextNode";
  if (node instanceof BusinessScoreCardNode) return "BusinessScoreCardNode";
  return null;
}

void main().catch((err: unknown) => {
  console.error("composition: app boot failed", err);
});
