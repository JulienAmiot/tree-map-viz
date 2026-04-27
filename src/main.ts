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
 * `AddChildService` and `ImportExportService` are wired in Phases 7/8 when
 * their consumers (modal, drawer) land — see §17 for the as-built phase log.
 */

import { LocalStorageBoardCollectionRepository } from "./adapters/persistence/LocalStorageBoardCollectionRepository.js";
import { decode, encode } from "./adapters/persistence/jsonCodec.js";
import { HashRouter } from "./adapters/routing/HashRouter.js";
import "./adapters/ui/shell/TreeGraphScreen.js";
import type { TreeGraphScreen } from "./adapters/ui/shell/TreeGraphScreen.js";
import { mapFocusedToViewModel } from "./adapters/ui/views/viewModelMapper.js";
import { BoardCollectionService } from "./application/BoardCollectionService.js";
import { TreeNavigationService } from "./application/TreeNavigationService.js";
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
  };

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

void main().catch((err: unknown) => {
  console.error("composition: app boot failed", err);
});
