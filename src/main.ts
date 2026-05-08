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
 *     Both are recomputed on every refresh, so the permanent top bar
 *     stays in sync with the focus + board state.
 *   + The shell emits `breadcrumb-navigate` `{ nodeId }` when the user taps
 *     an ancestor segment; the composition root drives `nav.focusByUuid` +
 *     `refresh()` synchronously and also `router.push(...)` so the URL stays
 *     in sync with focus state (SPEC §11.3). `router.push` uses
 *     `history.pushState`, which does NOT fire `hashchange`, so the
 *     `router.onChange` listener wouldn't see internal navigation; we drive
 *     the state update locally and let `router.onChange` cover external
 *     changes (browser back/forward, manual hash edits, the test bridge).
 *   + `burger-menu-action` `{ action }`:
 *     - `import` / `export` wire to `ImportExportService` (SPEC §17.33).
 *       Export streams a JSON download via a transient `<a>`; Import
 *       opens a native file picker, decodes, then replaces the
 *       current board's tree atomically (validate-before-replace).
 *     - `boards` lands in §17.34 (boards-panel modal); placeholder
 *       log today.
 *     - `settings` opens `<board-settings-modal>` (§17.31).
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
  BoardsPanelCreateDetail,
  BoardsPanelSwitchDetail,
} from "./adapters/ui/modal/BoardsPanelModal.js";
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
import type { InlineEditWeightDetail } from "./adapters/ui/views/childWeight/weightEditEvents.js";
import type { InlineEditTitleDetail } from "./adapters/ui/views/inlineEditEvents.js";
import type { InlineEditValueDetail } from "./adapters/ui/views/inlineEditEvents.js";
import { mapFocusedToViewModel } from "./adapters/ui/views/viewModelMapper.js";
import { AddChildService } from "./application/AddChildService.js";
import { BoardCollectionService } from "./application/BoardCollectionService.js";
import { EditNodeService } from "./application/EditNodeService.js";
import { ImportExportService } from "./application/ImportExportService.js";
import { TreeNavigationService } from "./application/TreeNavigationService.js";
import type { Clock } from "./application/ports/Clock.js";
import { BusinessScoreCardNode } from "./domain/nodes/BusinessScoreCardNode.js";
import { TextCard } from "./domain/nodes/TextCard.js";
import { TextNode } from "./domain/nodes/TextNode.js";
import type { TreeNode } from "./domain/nodes/TreeNode.js";
import { findNodeById, walkPath } from "./domain/treeQueries.js";
import { Description } from "./domain/values/Description.js";
import { NodeIdentity } from "./domain/values/NodeIdentity.js";
import { TimestampedValue } from "./domain/values/TimestampedValue.js";
import { Title } from "./domain/values/Title.js";
import { Weight } from "./domain/values/Weight.js";
import "./index.css";

async function main(): Promise<void> {
  const idGen = (): string => crypto.randomUUID();
  // SPEC §17.57 — domain ports' real-clock binding lives here, alongside
  // `idGen`. Inline rather than in a dedicated `SystemClock` adapter
  // file because the IdGenerator port set the precedent for tiny
  // single-method ports being bound right in the composition root.
  const clock: Clock = { now: () => new Date() };
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
  const editNodeSvc = new EditNodeService(clock, persistCurrent);
  // SPEC §17.33 — Phase 10 wiring half A. The Import / Export menu items
  // ride on `ImportExportService`'s validate-before-replace contract:
  // a successful decode replaces the current board's tree atomically
  // through `boards.replaceCurrentTree` (which preserves the board's
  // name); a failed decode never touches the in-memory tree. Surfacing follows the §17.33 decision: `window.alert(reason)`
  // for the rare error path, kiosk-acceptable for an op operators
  // rarely hit.
  const importExportSvc = new ImportExportService(
    codec,
    () => boards.getCurrentBoard().tree,
    async (tree) => {
      await boards.replaceCurrentTree(tree);
    },
  );

  const refresh = (): void => {
    const view = nav.getFocusedView();
    const current = boards.getCurrentBoard();
    // §17.42 retired the per-board fresh-date colour the §17.21 /
    // §17.31 wiring carried. The mapper now needs no board-level
    // option; the focused-panel title uses a hard-coded bright
    // off-white from CSS, and the timestamp gradient is fixed
    // white → dark-grey inside `dateAgeColor`.
    screen.view = view
      ? mapFocusedToViewModel(view.center, view.childrenNodes)
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
      // SPEC §17.57 — `appendValue`'s `asOf` is optional; when the
      // inline-edit detail omits it the service stamps the entry with
      // `clock.now()`. The `?? new Date()` fallback that used to live
      // here is gone (no `new Date()` outside the composition root's
      // `clock` binding any more for the inline value-edit path).
      const result = await editNodeSvc.appendValue(node, detail.value, detail.asOf);
      if (!result.ok) {
        refresh();
        return;
      }
      refresh();
    })();
  });

  // SPEC §17.52 — child-tile inline weight edit. Dispatched by
  // `<weight-edit-popover>` once the operator releases the slider
  // thumb (the native `change` event on `<input type="range">`,
  // i.e. commit-on-release). Same service path as the modal's
  // weight field but with a one-field payload (just `weight`); the
  // kind is inferred from the in-memory node so the operator
  // doesn't have to know whether the tile is a TextNode or a BSC.
  // Domain rejection (e.g. `Weight.of` rejects an out-of-range
  // value because of a stale browser slipping past the slider's
  // min / max) surfaces silently — the view re-renders from the
  // unchanged tree on the failure path's `refresh()`.
  screen.addEventListener("inline-edit-weight", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<InlineEditWeightDetail>).detail;
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
        weight: detail.weight,
      });
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
        canDelete: boards.list().length > 1,
      });
      return;
    }
    if (detail.action === "export") {
      // SPEC §17.33 — write the current board's tree to a JSON file
      // the operator can save somewhere else (USB stick / cloud).
      // Synchronous code path: encode into a string, wrap in a Blob,
      // and trigger a download via a transient `<a download>`. The
      // navigation, persistence, and view layer are not touched.
      runExport();
      return;
    }
    if (detail.action === "import") {
      // SPEC §17.33 — open a native file picker, read the chosen
      // JSON, run it through `ImportExportService.importIntoCurrentBoard`
      // which validates with the codec BEFORE replacing the in-memory
      // tree. On success the navigation service is re-seated over the
      // new tree (the prior `focusedId` almost certainly does not
      // exist in the imported tree), the URL is replaced (not pushed
      // — destructive ops don't accumulate history), and the view
      // refreshes. On failure `window.alert(reason)` surfaces the
      // codec's error message; the existing tree stays put.
      void runImport();
      return;
    }
    if (detail.action === "boards") {
      // SPEC §17.34 — open the collection-level boards panel. The
      // composition root assembles a plain snapshot from
      // `BoardCollectionService.list()` (id + name only — domain
      // `tree`s never cross the modal boundary) so the modal stays a
      // pure consumer.
      screen.openBoardsPanelModal({
        boards: boards.list().map((b) => ({ id: b.id, name: b.name })),
        currentBoardId: boards.getCurrentBoardId(),
      });
      return;
    }
  });

  /**
   * SPEC §17.33 — export the current board's tree to a JSON file.
   * The download is triggered via a transient `<a>` so the browser
   * uses its native "Save as…" mechanism; no new modal, no kiosk
   * chrome. The blob URL is revoked after a short delay so the
   * download has time to start (revoking immediately can race the
   * kick-off in some browsers).
   */
  function runExport(): void {
    const json = importExportSvc.exportCurrentTree();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(boards.getCurrentBoard().name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * SPEC §17.33 — open a native file picker for JSON, decode the
   * chosen file, and replace the current board's tree on success.
   * Uses a transient `<input type="file">` (appended to the body,
   * removed after the change handler runs) so production gets a
   * standard file picker and Playwright e2e can intercept the
   * `filechooser` event for deterministic seeding.
   *
   * Error handling honours the §17.33 decision: a decode failure
   * (or an empty selection / read error) becomes a `window.alert`;
   * the import never replaces the tree on failure (the
   * validate-before-replace contract from §17.3 is preserved by
   * `ImportExportService`).
   */
  async function runImport(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    document.body.appendChild(input);
    try {
      await new Promise<void>((resolve) => {
        input.addEventListener(
          "change",
          () => {
            void (async () => {
              try {
                const file = input.files?.[0];
                if (!file) {
                  return;
                }
                const text = await file.text();
                const result = await importExportSvc.importIntoCurrentBoard(text);
                if (!result.ok) {
                  window.alert(`Import failed: ${result.reason}`);
                  return;
                }
                // Re-seat the navigation service over the new tree —
                // the old `focusedId` almost certainly does not exist
                // in the freshly-decoded tree, and a stale focus
                // would silently break `getFocusedView` (`findNodeById`
                // would return null). `replaceTree(...)` snaps the
                // focus to the new root.
                const newCurrent = boards.getCurrentBoard();
                nav.replaceTree(newCurrent.tree);
                router.replace({
                  boardId: newCurrent.id,
                  focusNodeUuid: newCurrent.tree.id,
                });
                refresh();
              } finally {
                resolve();
              }
            })();
          },
          { once: true },
        );
        input.click();
      });
    } finally {
      if (input.parentNode === document.body) {
        document.body.removeChild(input);
      }
    }
  }

  screen.addEventListener("board-settings-confirm", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<BoardSettingsConfirmDetail>).detail;
      const result = await boards.updateSettings(detail.boardId, {
        name: detail.name,
      });
      if (!result.ok) {
        screen.setBoardSettingsError(result.reason);
        return;
      }
      screen.closeBoardSettingsModal();
      refresh();
    })();
  });

  // SPEC §17.34 — boards-panel switch. The service's same-id guard
  // makes this a no-op when the row matches the current board, but
  // the modal already filters those out by rendering the `(current)`
  // badge instead of a Switch button. On success we re-seat the
  // navigation service over the newly-current board's tree and
  // `replace` the URL (destructive jump — no history entry); on
  // failure surface the reason inline.
  screen.addEventListener("boards-panel-switch", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<BoardsPanelSwitchDetail>).detail;
      const result = await boards.switchTo(detail.boardId);
      if (!result.ok) {
        screen.setBoardsPanelError(result.reason);
        return;
      }
      const newCurrent = boards.getCurrentBoard();
      nav.replaceTree(newCurrent.tree);
      router.replace({
        boardId: newCurrent.id,
        focusNodeUuid: newCurrent.tree.id,
      });
      screen.closeBoardsPanelModal();
      refresh();
    })();
  });

  // SPEC §17.34 — boards-panel create. We seed every brand-new
  // board with a one-node TextNode root titled with the board's
  // name (a single welcome `TimestampedValue` so `currentValue()`
  // doesn't throw `EmptyHistoryError` on the first render). The
  // service is the conversion boundary — it generates the board id
  // through `idGen` and persists. After a successful create the
  // collection's `currentBoardId` already points at the new board
  // (per `BoardCollectionService.createBoard`), so re-seating
  // navigation + URL is the same triple as `switchTo`.
  screen.addEventListener("boards-panel-create", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<BoardsPanelCreateDetail>).detail;
      const seedTree = makeNewBoardSeedTree(detail.name, idGen, clock);
      const result = await boards.createBoard(detail.name, seedTree);
      if (!result.ok) {
        screen.setBoardsPanelError(result.reason);
        return;
      }
      const newCurrent = boards.getCurrentBoard();
      nav.replaceTree(newCurrent.tree);
      router.replace({
        boardId: newCurrent.id,
        focusNodeUuid: newCurrent.tree.id,
      });
      screen.closeBoardsPanelModal();
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

/**
 * SPEC §17.33 — derive a filesystem-friendly download name from
 * the current board's user-visible name. Lower-cases, replaces
 * whitespace + filesystem-illegal chars with `-`, collapses runs,
 * and trims to a sane length. Falls back to `board` if the cleaned
 * string is empty (e.g. a board named with only emoji on a
 * platform whose filesystem rejects non-ASCII filenames).
 *
 * The browser's "Save as…" dialog still lets the operator rename
 * the file, so this is just a sensible default — not a contract.
 */
function exportFileName(boardName: string): string {
  const slug = boardName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "board"}.json`;
}

/** SPEC §17.28 — per-kind discriminator used by the inline-edit-title path. */
function inferKind(
  node: TreeNode<unknown>,
): "TextNode" | "BusinessScoreCardNode" | null {
  if (node instanceof TextNode) return "TextNode";
  if (node instanceof BusinessScoreCardNode) return "BusinessScoreCardNode";
  return null;
}

/**
 * SPEC §17.34 — build a minimal, non-empty tree for a freshly-created
 * board. The new board lands on a single `TextNode` root titled with
 * the board's name, weight 1, and a one-entry history dated "now"
 * carrying a friendly welcome message. Why not an empty `TextCard`?
 * `TextNode.currentValue()` throws `EmptyHistoryError` for an empty
 * history (per §3); the focused-panel view tolerates that today, but
 * shipping a brand-new board with a visible value gives the operator
 * something to drill on top of (and exercises the rendering path on
 * day one). The text content is intentionally short — operators will
 * inline-edit it (§17.28) within minutes.
 */
function makeNewBoardSeedTree(
  boardName: string,
  idGen: () => string,
  clock: Clock,
): TreeNode<unknown> {
  const id = idGen();
  const trimmed = boardName.trim() || "New board";
  const identity = NodeIdentity.of(Title.of(trimmed), Description.of(""));
  const card = TextCard.of([
    TimestampedValue.of(`Welcome to **${trimmed}**.`, clock.now()),
  ]);
  return new TextNode(id, identity, Weight.of(1), card);
}

void main().catch((err: unknown) => {
  console.error("composition: app boot failed", err);
});
