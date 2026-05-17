/**
 * Composition root (SPEC §14.5).
 *
 * The only file in `src/` that imports concrete adapters and wires them
 * into application services. Layered import contract: this file is the
 * single allowed bridge from `domain` + `application` to `adapters`.
 *
 * §17.110 Phase E cutover — every wiring slot constructs the v4
 * successor: `LocalStorageBoardCollectionRepositoryV4` over the
 * §17.106 `createJsonCodecV4`-built codec, `BoardCollectionServiceV4`,
 * `TreeNavigationServiceV4` (v4 `Tree` over the board's root),
 * `AddChildServiceV4` + `EditNodeServiceV4` (`Clock`-injected per
 * §17.100a/§17.101a), `ImportExportServiceV4`.
 *
 * §17.112 Phase F v3 sweep — the v3 codec + bridge + nodes + cards +
 * VOs + capabilities + services + ports + adapters are all gone. The
 * §17.110 `codecWithV3Fallback` testBridge wrapper retires alongside
 * the LSR's v3-fallback decode shim (the §17.107 silent-migration
 * window closed: any operator install that booted a §17.110+ build
 * has already re-emitted its persisted envelope as `v: 2` v4-native).
 * Pre-§17.110 `v: 1` envelopes now surface a clean load error; e2e
 * fixtures under `src/test/e2e/fixtures/trees/*.json` are converted
 * to the v4 wire envelope shape in this same strand.
 *
 * **Modal payload translation shims** — `EditNodeModal` / `AddChildModal`
 * still emit v3-shaped payloads (the v4-native modal migration is a
 * follow-on strand). `toV4AddChildPayload` + `toV4EditPayload` rewrite
 * the kind tag (`BusinessScoreCardNode` → `BusinessScore` or
 * `ComputedBusinessScore` when `computed:true`, defaulting to
 * `ComputationKind.AVERAGE` per the §17.99c migration choice) and the
 * objective shape (`{initialValue, targetValue, targetDate}` →
 * `{value: targetValue, at: targetDate}`; `initialValue` becomes the
 * `initialHistory` seed on Add when absent). The two payload types
 * (`AddChildPayload`, `EditNodePayload`) moved from the (deleted)
 * v3 application services into the modal files themselves in this
 * strand — adapter-owned outbound contracts, no application reach.
 *
 * **`computation-kind-change` wiring** — §17.104 `<computed-card>` /
 * `<computed-business-score-card>` dispatch this event on the
 * dropdown's `change`; the handler routes to
 * `EditNodeServiceV4.editFields` with `{ computationKind: ... }`
 * resolved through `ComputationKind.fromName`.
 */

import { LocalStorageBoardCollectionRepositoryV4 } from "./adapters/persistence/LocalStorageBoardCollectionRepositoryV4.js";
import { createJsonCodecV4 } from "./adapters/persistence/jsonCodecV4.js";
import { HashRouter } from "./adapters/routing/HashRouter.js";
import type {
  AddChildConfirmDetail,
  AddChildPayload,
} from "./adapters/ui/modal/AddChildModal.js";
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
  EditNodePayload,
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
import "./adapters/ui/shell/TreeMapScreen.js";
import type { TreeMapScreen } from "./adapters/ui/shell/TreeMapScreen.js";
import type { ComputationKindChangeDetail } from "./adapters/ui/views/ComputedNode/ComputedCards.js";
import type { InlineEditWeightDetail } from "./adapters/ui/views/childWeight/weightEditEvents.js";
import type { InlineEditTitleDetail } from "./adapters/ui/views/inlineEditEvents.js";
import type { InlineEditValueDetail } from "./adapters/ui/views/inlineEditEvents.js";
import { mapFocusedToViewModelV4 } from "./adapters/ui/views/viewModelMapperV4.js";
import {
  AddChildServiceV4,
  type AddChildPayloadV4,
} from "./application/AddChildServiceV4.js";
import { BoardCollectionServiceV4 } from "./application/BoardCollectionServiceV4.js";
import {
  EditNodeServiceV4,
  type EditNodePayloadV4,
} from "./application/EditNodeServiceV4.js";
import { ImportExportServiceV4 } from "./application/ImportExportServiceV4.js";
import { TreeNavigationServiceV4 } from "./application/TreeNavigationServiceV4.js";
import type { Clock } from "./domain/capabilities/Clock.js";
import { ComputationKind } from "./domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "./domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "./domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "./domain/nodes/ComputedNode.js";
import type { Node } from "./domain/nodes/Node.js";
import { StrictRangeNode } from "./domain/nodes/StrictRangeNode.js";
import { TextNodeV4 } from "./domain/nodes/TextNodeV4.js";
import { Tree } from "./domain/Tree.js";
import { Timestamp } from "./domain/values/Timestamp.js";
import { Weight } from "./domain/values/Weight.js";
import "./index.css";

async function main(): Promise<void> {
  const idGen = (): string => crypto.randomUUID();
  // SPEC §17.57 / §17.58 — domain ports' real-clock binding (mirrors
  // IdGenerator's no-adapter-file pattern). `Timestamp.of` validates
  // `getTime()` so a `NaN`-Date would surface here at the boundary.
  const clock: Clock = { now: () => Timestamp.of(new Date()) };
  const codec = createJsonCodecV4(clock);
  const repo = new LocalStorageBoardCollectionRepositoryV4({
    storage: window.localStorage,
    codec,
    clock,
  });
  const boards = await BoardCollectionServiceV4.create(repo, idGen);
  const router = new HashRouter(window);

  const board = boards.getCurrentBoard();
  const nav = new TreeNavigationServiceV4(board.tree);

  const screen = document.querySelector<TreeMapScreen>("tree-map-screen");
  if (!screen) {
    throw new Error("composition: <tree-map-screen> not present in document");
  }

  const persistCurrent = async (): Promise<void> => {
    await repo.save({
      boards: [...boards.list()],
      currentBoardId: boards.getCurrentBoardId(),
    });
  };
  const addChildSvc = new AddChildServiceV4(idGen, clock, persistCurrent);
  const editNodeSvc = new EditNodeServiceV4(clock, persistCurrent);
  const importExportSvc = new ImportExportServiceV4(
    codec,
    () => boards.getCurrentBoard().tree,
    async (tree) => {
      await boards.replaceCurrentTree(tree);
    },
  );

  const refresh = (): void => {
    const view = nav.getFocusedView();
    const current = boards.getCurrentBoard();
    if (view) {
      screen.view = mapFocusedToViewModelV4(view.center, view.childrenNodes, {
        cards: current.tree.cards,
      });
    } else {
      screen.view = null;
    }
    screen.boardName = current.name;
    screen.breadcrumbPath = computeBreadcrumb(current.tree, nav.getFocusedId());
  };

  screen.addEventListener("add-child-confirm", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<AddChildConfirmDetail>).detail;
      const parent = current().findById(detail.parentId);
      if (!parent) {
        screen.setAddChildError(`Parent node "${detail.parentId}" not found.`);
        return;
      }
      const result = await addChildSvc.addChild(parent, toV4AddChildPayload(detail.payload, clock));
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
    if (!r.ok) return;
    router.push({ boardId: boards.getCurrentBoardId(), focusNodeUuid: detail.nodeId });
    refresh();
  });

  // SPEC §17.23 — close-X on the focused-panel strip emits this event
  // with the parent's id. Stale id (rejection) silently no-ops.
  screen.addEventListener("focus-close-to-parent", (e) => {
    const detail = (e as CustomEvent<FocusCloseToParentDetail>).detail;
    const r = nav.focusByUuid(detail.parentId);
    if (!r.ok) return;
    router.push({ boardId: boards.getCurrentBoardId(), focusNodeUuid: detail.parentId });
    refresh();
  });

  screen.addEventListener("edit-node-open", (e) => {
    const detail = (e as CustomEvent<EditNodeOpenDetail>).detail;
    const node = current().findById(detail.nodeId);
    if (!node) return;
    const target = buildEditTarget(node);
    if (!target) return;
    screen.openEditNodeModal(target);
  });

  screen.addEventListener("edit-node-confirm", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<EditNodeConfirmDetail>).detail;
      const node = current().findById(detail.nodeId);
      if (!node) {
        screen.setEditNodeError(`Node "${detail.nodeId}" not found.`);
        return;
      }
      const result = await editNodeSvc.editFields(node, toV4EditPayload(detail.payload), {
        cards: boards.getCurrentBoard().tree.cards,
      });
      if (!result.ok) {
        screen.setEditNodeError(result.reason);
        return;
      }
      screen.closeEditNodeModal();
      refresh();
    })();
  });

  screen.addEventListener("inline-edit-title", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<InlineEditTitleDetail>).detail;
      const node = current().findById(detail.nodeId);
      if (!node) return;
      const kind = inferV4Kind(node);
      if (!kind) return;
      await editNodeSvc.editFields(node, { kind, title: detail.title } as EditNodePayloadV4);
      refresh();
    })();
  });

  screen.addEventListener("inline-edit-value", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<InlineEditValueDetail>).detail;
      const node = current().findById(detail.nodeId);
      if (!node) return;
      await editNodeSvc.appendValue(node, detail.value, detail.asOf);
      refresh();
    })();
  });

  screen.addEventListener("inline-edit-weight", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<InlineEditWeightDetail>).detail;
      const node = current().findById(detail.nodeId);
      if (!node) return;
      const kind = inferV4Kind(node);
      if (!kind) return;
      await editNodeSvc.editFields(node, { kind, weight: detail.weight } as EditNodePayloadV4);
      refresh();
    })();
  });

  // SPEC §17.110 — §17.104 dropdown switches the Computed* node's
  // strategy via EditNodeServiceV4 (atomic + rolled-back on persist
  // failure, same as the modal path). The dropdown only renders on
  // nodes that already are Computed* so the kind-match in the
  // service never rejects on the happy path; an unknown name (e.g.
  // a stale build's enum) surfaces as `{ ok: false }` and the next
  // refresh re-paints the unchanged dropdown.
  screen.addEventListener("computation-kind-change", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<ComputationKindChangeDetail>).detail;
      const node = current().findById(detail.nodeId);
      if (!node) return;
      const computationKind = ComputationKind.fromName(detail.newKind);
      if (!computationKind) return;
      const kind = computedKindFor(node);
      if (!kind) return;
      await editNodeSvc.editFields(node, { kind, computationKind } as EditNodePayloadV4);
      refresh();
    })();
  });

  screen.addEventListener("tile-drill", (e) => {
    const detail = (e as CustomEvent<TileDrillDetail>).detail;
    screen.runDrillAnimation(detail.nodeId, () => {
      const r = nav.focusByUuid(detail.nodeId);
      if (!r.ok) return;
      router.push({ boardId: boards.getCurrentBoardId(), focusNodeUuid: detail.nodeId });
      refresh();
    });
  });

  screen.addEventListener("burger-menu-action", (e) => {
    const detail = (e as CustomEvent<BurgerMenuActionDetail>).detail;
    if (detail.action === "settings") {
      const cur = boards.getCurrentBoard();
      screen.openBoardSettingsModal({ boardId: cur.id, name: cur.name, canDelete: boards.list().length > 1 });
      return;
    }
    if (detail.action === "export") { runExport(); return; }
    if (detail.action === "import") { void runImport(); return; }
    if (detail.action === "boards") {
      screen.openBoardsPanelModal({
        boards: boards.list().map((b) => ({ id: b.id, name: b.name })),
        currentBoardId: boards.getCurrentBoardId(),
      });
      return;
    }
    if (detail.action === "about") screen.openAboutModal();
  });

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

  async function runImport(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    document.body.appendChild(input);
    try {
      await new Promise<void>((resolve) => {
        input.addEventListener("change", () => {
          void (async () => {
            try {
              const file = input.files?.[0];
              if (!file) return;
              const text = await file.text();
              const result = await importExportSvc.importIntoCurrentBoard(text);
              if (!result.ok) { window.alert(`Import failed: ${result.reason}`); return; }
              const newCurrent = boards.getCurrentBoard();
              nav.replaceTree(newCurrent.tree);
              router.replace({ boardId: newCurrent.id, focusNodeUuid: newCurrent.tree.root.id });
              refresh();
            } finally { resolve(); }
          })();
        }, { once: true });
        input.click();
      });
    } finally {
      if (input.parentNode === document.body) document.body.removeChild(input);
    }
  }

  screen.addEventListener("board-settings-confirm", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<BoardSettingsConfirmDetail>).detail;
      const result = await boards.updateSettings(detail.boardId, { name: detail.name });
      if (!result.ok) { screen.setBoardSettingsError(result.reason); return; }
      screen.closeBoardSettingsModal();
      refresh();
    })();
  });

  screen.addEventListener("boards-panel-switch", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<BoardsPanelSwitchDetail>).detail;
      const result = await boards.switchTo(detail.boardId);
      if (!result.ok) { screen.setBoardsPanelError(result.reason); return; }
      const newCurrent = boards.getCurrentBoard();
      nav.replaceTree(newCurrent.tree);
      router.replace({ boardId: newCurrent.id, focusNodeUuid: newCurrent.tree.root.id });
      screen.closeBoardsPanelModal();
      refresh();
    })();
  });

  screen.addEventListener("boards-panel-create", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<BoardsPanelCreateDetail>).detail;
      const seedTree = makeNewBoardSeedTree(detail.name, idGen, clock);
      const result = await boards.createBoard(detail.name, seedTree);
      if (!result.ok) { screen.setBoardsPanelError(result.reason); return; }
      const newCurrent = boards.getCurrentBoard();
      nav.replaceTree(newCurrent.tree);
      router.replace({ boardId: newCurrent.id, focusNodeUuid: newCurrent.tree.root.id });
      screen.closeBoardsPanelModal();
      refresh();
    })();
  });

  screen.addEventListener("board-settings-delete", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<BoardSettingsDeleteDetail>).detail;
      const result = await boards.deleteBoard(detail.boardId);
      if (!result.ok) { screen.setBoardSettingsError(result.reason); return; }
      const newCurrent = boards.getCurrentBoard();
      nav.replaceTree(newCurrent.tree);
      router.replace({ boardId: newCurrent.id, focusNodeUuid: newCurrent.tree.root.id });
      screen.closeBoardSettingsModal();
      refresh();
    })();
  });

  function current(): Tree {
    return boards.getCurrentBoard().tree;
  }

  const startRoute = router.current();
  if (startRoute && startRoute.boardId === boards.getCurrentBoardId()) {
    nav.focusByUuid(startRoute.focusNodeUuid);
  } else {
    router.replace({ boardId: boards.getCurrentBoardId(), focusNodeUuid: nav.getRoot().root.id });
  }
  refresh();

  router.onChange((state) => {
    if (!state || state.boardId !== boards.getCurrentBoardId()) return;
    const r = nav.focusByUuid(state.focusNodeUuid);
    if (!r.ok) {
      const rootId = nav.getRoot().root.id;
      router.replace({ boardId: boards.getCurrentBoardId(), focusNodeUuid: rootId });
      nav.focusByUuid(rootId);
    }
    refresh();
  });

  if (new URL(window.location.href).searchParams.get("test") === "1") {
    const { installTestBridge } = await import("./adapters/testBridge.js");
    installTestBridge(window, { repo, codec, router });
  }
}

function computeBreadcrumb(tree: Tree, focusedId: string): readonly BreadcrumbSegment[] {
  const focused = tree.findById(focusedId);
  if (!focused) return [];
  const path: Node[] = [];
  let cursor: Node | undefined = focused;
  while (cursor) {
    path.unshift(cursor);
    cursor = cursor.parent ?? undefined;
  }
  return path.map((n) => ({ id: n.id, title: n.title }));
}

/**
 * SPEC §17.110 — v4 successor to the v3 `buildEditTarget`. The modal
 * is still v3-typed (`EditNodeTarget` carries `BusinessScoreCardNode`
 * as a kind tag); the round-7 leaf kinds (StrictRange, Computed,
 * ComputedBusinessScore) silently no-op here pending a v4-native
 * modal in a follow-on strand.
 */
function buildEditTarget(node: Node): EditNodeTarget | null {
  if (node instanceof TextNodeV4) {
    return { nodeId: node.id, kind: "TextNode", title: node.title, weight: node.weight.value };
  }
  if (node instanceof BusinessScoreNode && !(node instanceof ComputedBusinessScoreNode)) {
    const obj = node.objective;
    return {
      nodeId: node.id,
      kind: "BusinessScoreCardNode",
      title: node.title,
      description: node.getDescription(),
      weight: node.weight.value,
      unit: node.unit,
      objective: {
        initialValue: 0,
        targetValue: Number(obj.value),
        targetDateIso: obj.at.moment.toISOString().slice(0, 10),
      },
      computed: false,
      eligibleForParentComputation: !node.disabled,
    };
  }
  return null;
}

/** SPEC §17.110 — kind tag for `computation-kind-change` (Computed* only). */
function computedKindFor(node: Node): "Computed" | "ComputedBusinessScore" | null {
  if (node instanceof ComputedBusinessScoreNode) return "ComputedBusinessScore";
  if (node instanceof ComputedNode) return "Computed";
  return null;
}

/**
 * SPEC §17.110 — per-kind discriminator used by the inline edit
 * paths. Returns the v4 service's kind tag (or `null` for the
 * three round-7 leaf kinds the inline UIs don't surface yet).
 */
function inferV4Kind(node: Node): EditNodePayloadV4["kind"] | null {
  if (node instanceof TextNodeV4) return "TextNode";
  if (node instanceof ComputedBusinessScoreNode) return "ComputedBusinessScore";
  if (node instanceof BusinessScoreNode) return "BusinessScore";
  if (node instanceof StrictRangeNode) return "StrictRange";
  if (node instanceof ComputedNode) return "Computed";
  return null;
}

function exportFileName(boardName: string): string {
  const slug = boardName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "board"}.json`;
}

/**
 * SPEC §17.110 — v4 successor to the v3 `makeNewBoardSeedTree`.
 * Seeds a fresh board with a single `TextNodeV4` root titled with
 * the board's name and one history entry stamped "now" so the
 * focused-panel view has a value to render on day one.
 */
function makeNewBoardSeedTree(boardName: string, idGen: () => string, clock: Clock): Tree {
  const trimmed = boardName.trim() || "New board";
  const root = new TextNodeV4(idGen(), trimmed, Weight.of(1), clock);
  root.addValue(clock.now(), `Welcome to **${trimmed}**.`);
  return new Tree(root);
}

/**
 * SPEC §17.110 — `AddChildModal` still emits v3-shaped
 * `AddChildPayload`. Map to v4: `BusinessScoreCardNode` →
 * `BusinessScore` (or `ComputedBusinessScore` when `computed:true`,
 * defaulting to `ComputationKind.AVERAGE` per the §17.99c bridge
 * choice); v3 `objective.initialValue` becomes an `initialHistory`
 * seed entry stamped at `clock.now()` when no explicit history
 * was provided.
 */
function toV4AddChildPayload(payload: AddChildPayload, clock: Clock): AddChildPayloadV4 {
  if (payload.kind === "TextNode") {
    return {
      kind: "TextNode",
      title: payload.title,
      weight: payload.weight,
      initialHistory: payload.initialHistory,
    };
  }
  const objective = {
    value: payload.objective.targetValue,
    at: payload.objective.targetDate,
  };
  const seededHistory = payload.initialHistory ?? [
    { value: payload.objective.initialValue, asOf: new Date(clock.now().moment) },
  ];
  if (payload.computed) {
    return {
      kind: "ComputedBusinessScore",
      title: payload.title,
      description: payload.description,
      weight: payload.weight,
      unit: payload.unit,
      objective,
      computationKind: ComputationKind.AVERAGE,
      disabled: payload.eligibleForParentComputation === false,
    };
  }
  return {
    kind: "BusinessScore",
    title: payload.title,
    description: payload.description,
    weight: payload.weight,
    unit: payload.unit,
    objective,
    disabled: payload.eligibleForParentComputation === false,
    initialHistory: seededHistory,
  };
}

/**
 * SPEC §17.110 — `EditNodeModal` still emits v3-shaped
 * `EditNodePayload`. Map to v4: rename `BusinessScoreCardNode` kind
 * to `BusinessScore`; drop the v3 `initialValue` field (v4 makes
 * history canonical and edits never re-seed initial history);
 * rewrite the objective shape; ignore v3-only `computed` /
 * `eligibleForParentComputation` flags on the edit path (kind
 * morphing isn't allowed by the v4 service — the §17.99c migration
 * already pinned the kind at load).
 */
function toV4EditPayload(payload: EditNodePayload): EditNodePayloadV4 {
  if (payload.kind === "TextNode") {
    return { kind: "TextNode", title: payload.title, weight: payload.weight };
  }
  return {
    kind: "BusinessScore",
    title: payload.title,
    description: payload.description,
    weight: payload.weight,
    unit: payload.unit,
    objective: payload.objective
      ? { value: payload.objective.targetValue, at: payload.objective.targetDate }
      : undefined,
  };
}

void main().catch((err: unknown) => {
  console.error("composition: app boot failed", err);
});
