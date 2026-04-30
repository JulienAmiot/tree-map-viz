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
 */

import { LocalStorageBoardCollectionRepository } from "./adapters/persistence/LocalStorageBoardCollectionRepository.js";
import { decode, encode } from "./adapters/persistence/jsonCodec.js";
import { HashRouter } from "./adapters/routing/HashRouter.js";
import type {
  BreadcrumbNavigateDetail,
  BreadcrumbSegment,
} from "./adapters/ui/shell/Breadcrumb.js";
import type { BurgerMenuActionDetail } from "./adapters/ui/shell/BurgerMenu.js";
import "./adapters/ui/shell/TreeGraphScreen.js";
import type { TreeGraphScreen } from "./adapters/ui/shell/TreeGraphScreen.js";
import { mapFocusedToViewModel } from "./adapters/ui/views/viewModelMapper.js";
import { BoardCollectionService } from "./application/BoardCollectionService.js";
import { TreeNavigationService } from "./application/TreeNavigationService.js";
import { walkPath } from "./domain/treeQueries.js";
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

  const refresh = (): void => {
    const view = nav.getFocusedView();
    screen.view = view ? mapFocusedToViewModel(view.center, view.childrenNodes) : null;
    const current = boards.getCurrentBoard();
    screen.boardName = current.name;
    screen.breadcrumbPath = computeBreadcrumb(current.tree, nav.getFocusedId());
  };

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

  screen.addEventListener("burger-menu-action", (e) => {
    const detail = (e as CustomEvent<BurgerMenuActionDetail>).detail;
    // Placeholder: the real Import / Export / Boards consumers land in
    // Phase 10 (Persistence + Routing), per SPEC §15.4 + §17.3.
    console.info("[main] burger-menu-action (placeholder)", detail.action);
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
  root: import("./domain/nodes/TreeNode.js").TreeNode<unknown>,
  focusedId: string,
): readonly BreadcrumbSegment[] {
  const path = walkPath(root, focusedId);
  if (!path) {
    return [];
  }
  return path.map((n) => ({ id: n.id, title: n.identity.title.value }));
}

void main().catch((err: unknown) => {
  console.error("composition: app boot failed", err);
});
