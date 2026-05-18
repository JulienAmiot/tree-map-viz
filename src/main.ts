/**
 * Composition root (SPEC §14.5).
 *
 * The only file in `src/` that imports concrete adapters and wires them
 * into application services. Layered import contract: this file is the
 * single allowed bridge from `domain` + `application` to `adapters`.
 *
 * §17.110 Phase E cutover — every wiring slot constructs the v4
 * successor: `LocalStorageBoardCollectionRepository` over the
 * §17.106 `createJsonCodec`-built codec, `BoardCollectionService`,
 * `TreeNavigationService` (v4 `Tree` over the board's root),
 * `AddChildService` + `EditNodeService` (`Clock`-injected per
 * §17.100a/§17.101a), `ImportExportService`.
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
 * follow-on strand). `toAppAddChildPayload` + `toAppEditPayload`
 * rewrite the kind tag (`BusinessScoreCardNode` → `BusinessScore`)
 * and the objective shape (`{initialValue, targetValue, targetDate}`
 * → `{value: targetValue, at: targetDate}`; `initialValue` becomes
 * the `initialHistory` seed on Add when absent). The v3-era
 * `computed` checkbox retired from the modal payload at the
 * cleanup-stale-bsc-flags strand (post-§17.99c) — picking a
 * `ComputedBusinessScore` will route through a dedicated modal
 * kind option in a follow-on strand. The two modal payload types
 * (`AddChildModalPayload`, `EditNodeModalPayload`) live in the
 * modal files themselves (adapter-owned outbound contracts, no
 * application reach); the canonical `AddChildPayload` /
 * `EditNodePayload` names belong to the application-layer 5-kind
 * unions (§17.114-followup-payloads).
 *
 * **`computation-kind-change` wiring** — §17.104 `<computed-card>` /
 * `<computed-business-score-card>` dispatch this event on the
 * dropdown's `change`; the handler routes to
 * `EditNodeService.editFields` with `{ computationKind: ... }`
 * resolved through `ComputationKind.fromName`.
 */

import { LocalStorageBoardCollectionRepository } from "./adapters/persistence/LocalStorageBoardCollectionRepository.js";
import { createJsonCodec } from "./adapters/persistence/jsonCodec.js";
import { HashRouter } from "./adapters/routing/HashRouter.js";
import type {
  AddChildConfirmDetail,
  AddChildModalPayload,
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
  EditNodeModalPayload,
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
import { mapFocusedToViewModel } from "./adapters/ui/views/viewModelMapper.js";
import {
  AddChildService,
  type AddChildPayload,
} from "./application/AddChildService.js";
import { BoardCollectionService } from "./application/BoardCollectionService.js";
import {
  EditNodeService,
  type EditNodePayload,
} from "./application/EditNodeService.js";
import { ImportExportService } from "./application/ImportExportService.js";
import { TreeNavigationService } from "./application/TreeNavigationService.js";
import type { Clock } from "./domain/capabilities/Clock.js";
import { ComputationKind } from "./domain/computation/ComputationKind.js";
import { BusinessScoreNode } from "./domain/nodes/BusinessScoreNode.js";
import { ComputedBusinessScoreNode } from "./domain/nodes/ComputedBusinessScoreNode.js";
import { ComputedNode } from "./domain/nodes/ComputedNode.js";
import type { Node } from "./domain/nodes/Node.js";
import { PictureNode } from "./domain/nodes/PictureNode.js";
import { StrictRangeNode } from "./domain/nodes/StrictRangeNode.js";
import { TextNode } from "./domain/nodes/TextNode.js";
import { WorkflowNode } from "./domain/nodes/WorkflowNode.js";
import { URLNode } from "./domain/nodes/URLNode.js";
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
  const codec = createJsonCodec(clock);
  const repo = new LocalStorageBoardCollectionRepository({
    storage: window.localStorage,
    codec,
    clock,
  });
  const boards = await BoardCollectionService.create(repo, idGen);
  const router = new HashRouter(window);

  const board = boards.getCurrentBoard();
  const nav = new TreeNavigationService(board.tree);

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
  const addChildSvc = new AddChildService(idGen, clock, persistCurrent);
  const editNodeSvc = new EditNodeService(clock, persistCurrent);
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
    if (view) {
      screen.view = mapFocusedToViewModel(view.center, view.childrenNodes, {
        cards: current.tree.cards,
        workflowStatuses: current.workflowStatuses,
      });
    } else {
      screen.view = null;
    }
    screen.boardName = current.name;
    screen.breadcrumbPath = computeBreadcrumb(current.tree, nav.getFocusedId());
    // SPEC §17.118 — push the active board's workflow-status catalogue
    // down so both modals' status dropdown reflects the live table
    // (PDCA defaults out of the box; per-board configuration once the
    // board-settings UI ships). Updated on every refresh so a board
    // switch picks up the new catalogue without a dedicated event.
    screen.workflowStatuses = current.workflowStatuses;
  };

  screen.addEventListener("add-child-confirm", (e) => {
    void (async () => {
      const detail = (e as CustomEvent<AddChildConfirmDetail>).detail;
      const parent = current().findById(detail.parentId);
      if (!parent) {
        screen.setAddChildError(`Parent node "${detail.parentId}" not found.`);
        return;
      }
      const result = await addChildSvc.addChild(parent, toAppAddChildPayload(detail.payload, clock));
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
      const result = await editNodeSvc.editFields(node, toAppEditPayload(detail.payload), {
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
      await editNodeSvc.editFields(node, { kind, title: detail.title } as EditNodePayload);
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
      await editNodeSvc.editFields(node, { kind, weight: detail.weight } as EditNodePayload);
      refresh();
    })();
  });

  // SPEC §17.110 — §17.104 dropdown switches the Computed* node's
  // strategy via EditNodeService (atomic + rolled-back on persist
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
      await editNodeSvc.editFields(node, { kind, computationKind } as EditNodePayload);
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
  // SPEC §17.119 — Picture branch checked BEFORE the TextNode-via-
  // inheritance branch below would have a chance to misclassify a
  // subclass (PictureNode extends ValueNode<string>, not TextNode,
  // so the order matters less than in the workflow strand, but
  // surfacing the snapshot leaf early keeps the read pattern
  // consistent with `viewModelMapper`'s subclass-first ordering).
  if (node instanceof PictureNode) {
    return {
      nodeId: node.id,
      kind: "PictureNode",
      title: node.title,
      weight: node.weight.value,
      imageUrl: node.imageUrl,
    };
  }
  // SPEC §17.118 — WorkflowNode subclasses TextNode, so check the
  // narrower class FIRST; otherwise the TextNode branch would shadow
  // the Workflow branch and the edit modal would drop the status field.
  if (node instanceof WorkflowNode) {
    return {
      nodeId: node.id,
      kind: "Workflow",
      title: node.title,
      weight: node.weight.value,
      statusId: node.statusId,
    };
  }
  // SPEC §17.120 — URLNode branch checked BEFORE TextNode (same
  // reasoning as the §17.119 PictureNode branch above: URLNode is a
  // ValueNode<string> subclass that is structurally distinct from
  // TextNode, so surfacing it early keeps the read pattern
  // consistent with `viewModelMapper`'s subclass-first ordering).
  // The `url` field is read via the URLNode.url getter (which
  // delegates to the inherited description slot per the §17.120
  // contract).
  if (node instanceof URLNode) {
    return {
      nodeId: node.id,
      kind: "URLNode",
      title: node.title,
      weight: node.weight.value,
      url: node.url,
    };
  }
  if (node instanceof TextNode) {
    return { nodeId: node.id, kind: "TextNode", title: node.title, weight: node.weight.value };
  }
  // SPEC §17.77 / §17.94 — StrictRangeNode branch surfaces the
  // structural `[min, max]` bounds (read-only in the modal) plus
  // the editable description. Checked BEFORE the ValueNode-based
  // generic branches would have a chance to misclassify it; the
  // bounds are read off the `StrictRange` value object exposed by
  // the node, so the modal pre-fills the read-only bounds row
  // with the operator's current contract. Title flows through for
  // the inline-edit seam (the modal does not edit titles per
  // §17.50).
  if (node instanceof StrictRangeNode) {
    // SPEC §17.77 / §17.94 — surface the structural `[min, max]`
    // bounds from the underlying `StrictRange<T>`. The modal renders
    // them read-only (the application service's `StrictRange` edit
    // shape is `CommonEdit` only), but pre-filling them keeps the
    // operator informed of the active contract while editing
    // description / weight. The modal is currently typed against
    // numeric ranges; non-numeric `T` lands as the JS `Number(...)`
    // coercion at the snapshot boundary, which matches every
    // existing in-app usage (every persisted StrictRange is numeric
    // per the §17.77 jsonCodec contract).
    const range = node.range;
    return {
      nodeId: node.id,
      kind: "StrictRangeNode",
      title: node.title,
      description: node.getDescription(),
      weight: node.weight.value,
      bounds: { min: Number(range.minimalValue), max: Number(range.maximalValue) },
    };
  }
  // SPEC §17.94 / §17.95 — ComputedBusinessScoreNode branch checked
  // BEFORE the ComputedNode + BusinessScoreNode branches below; CBSN
  // extends both, so the narrower class must come first. Combines
  // the BSC slots (`unit` + `objective`) with the Computed strategy
  // name into a single snapshot the modal renders through the
  // §17.95 combined form (description / weight / unit / objective /
  // computation-kind dropdown).
  if (node instanceof ComputedBusinessScoreNode) {
    const obj = node.objective;
    return {
      nodeId: node.id,
      kind: "ComputedBusinessScoreNode",
      title: node.title,
      description: node.getDescription(),
      weight: node.weight.value,
      unit: node.unit,
      objective: {
        initialValue: 0,
        targetValue: Number(obj.value),
        targetDateIso: obj.at.moment.toISOString().slice(0, 10),
      },
      computationKindName: node.computationKind.name,
    };
  }
  // SPEC §17.94 / §17.95 — ComputedNode branch checked AFTER the
  // narrower ComputedBusinessScoreNode check above. The canonical
  // `computationKind.name` flows through the snapshot; the dropdown
  // re-resolves it to the singleton on confirm via `main.ts`'s
  // `toAppEditPayload`.
  if (node instanceof ComputedNode) {
    return {
      nodeId: node.id,
      kind: "ComputedNode",
      title: node.title,
      description: node.getDescription(),
      weight: node.weight.value,
      computationKindName: node.computationKind.name,
    };
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
 * paths. Returns the application service's kind tag (or `null` for
 * the three round-7 leaf kinds the inline UIs don't surface yet).
 */
function inferV4Kind(node: Node): EditNodePayload["kind"] | null {
  // SPEC §17.119 — PictureNode checked first; the rest of the
  // ladder follows the existing subclass-first ordering
  // (ComputedBusinessScore before BusinessScore, etc.).
  if (node instanceof PictureNode) return "Picture";
  // SPEC §17.118 — WorkflowNode subclasses TextNode; the narrower
  // check must come first so inline edits route to the Workflow
  // branch (statusId-preserving) rather than the generic TextNode
  // path (which would still work for title/value but would skip the
  // Workflow-specific assertions).
  if (node instanceof WorkflowNode) return "Workflow";
  // SPEC §17.120 — URLNode → "URL" kind tag, parity with PictureNode
  // → "Picture". Checked before TextNode for the same subclass-first
  // ordering reason as the §17.119 PictureNode branch above.
  if (node instanceof URLNode) return "URL";
  if (node instanceof TextNode) return "TextNode";
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
 * Seeds a fresh board with a single `TextNode` root titled with
 * the board's name and one history entry stamped "now" so the
 * focused-panel view has a value to render on day one.
 */
function makeNewBoardSeedTree(boardName: string, idGen: () => string, clock: Clock): Tree {
  const trimmed = boardName.trim() || "New board";
  const root = new TextNode(idGen(), trimmed, Weight.of(1), clock);
  root.addValue(clock.now(), `Welcome to **${trimmed}**.`);
  return new Tree(root);
}

/**
 * SPEC §17.110 — `AddChildModal` still emits the v3-shaped
 * `AddChildModalPayload`. Map to the application's
 * `AddChildPayload`: `BusinessScoreCardNode` → `BusinessScore`;
 * v3 `objective.initialValue` becomes an `initialHistory` seed
 * entry stamped at `clock.now()` when no explicit history was
 * provided. The v3-era `computed` checkbox retired post-§17.99c
 * (a "computed BSC" is now created by picking the dedicated
 * `Computed` / `ComputedBusinessScore` kind from the modal
 * catalogue once that strand wires them in); for now, the BSC
 * branch always routes to `BusinessScore`.
 */
function toAppAddChildPayload(payload: AddChildModalPayload, clock: Clock): AddChildPayload {
  if (payload.kind === "TextNode") {
    return {
      kind: "TextNode",
      title: payload.title,
      weight: payload.weight,
      initialHistory: payload.initialHistory,
    };
  }
  if (payload.kind === "PictureNode") {
    // SPEC §17.119 — modal-side "PictureNode" kind rewrites to the
    // application's "Picture" kind tag (mirrors the
    // BusinessScoreCardNode → BusinessScore translation a few
    // lines below). No history seed: PictureNode is a snapshot
    // leaf (`ValueNode<string>`, not `HistorizableValueNode<string>`).
    return {
      kind: "Picture",
      title: payload.title,
      weight: payload.weight,
      imageUrl: payload.imageUrl,
    };
  }
  // SPEC §17.118 — Workflow is a TextNode-with-status; the modal payload
  // is a 1:1 superset of the TextNode payload plus a mandatory
  // `statusId` referencing the active Board's `workflowStatuses` table.
  if (payload.kind === "Workflow") {
    return {
      kind: "Workflow",
      title: payload.title,
      weight: payload.weight,
      statusId: payload.statusId,
      initialHistory: payload.initialHistory,
    };
  }
  if (payload.kind === "URLNode") {
    // SPEC §17.120 — modal-side "URLNode" kind rewrites to the
    // application's "URL" kind tag. Parity with the §17.119
    // PictureNode rewrite: same shape, same snapshot-leaf semantics
    // (no history seed — URLNode is a ValueNode<string>, not a
    // HistorizableValueNode<string>).
    return {
      kind: "URL",
      title: payload.title,
      weight: payload.weight,
      url: payload.url,
    };
  }
  if (payload.kind === "StrictRangeNode") {
    // SPEC §17.77 / §17.94 — modal-side "StrictRangeNode" rewrites
    // to the application-layer "StrictRange" kind tag (parity with
    // the BSC / Picture / URL kind-tag rewrites). Forward every
    // field verbatim; the service builds the `StrictRange` value
    // object + replays `initialHistory` through `addValue` which
    // gates on `StrictRange.requireValue` (throws `OutOfRangeError`
    // for a seed value outside the bounds — surfaced as
    // `{ ok: false }` by the service).
    return {
      kind: "StrictRange",
      title: payload.title,
      description: payload.description,
      weight: payload.weight,
      min: payload.min,
      max: payload.max,
      initialHistory: payload.initialHistory,
    };
  }
  if (payload.kind === "ComputedNode") {
    // SPEC §17.94 / §17.95 — modal-side "ComputedNode" rewrites to
    // the application-layer "Computed" kind tag. The service builds
    // the `ComputedNode<number>` directly (no seed history, no
    // objective, no unit, no range — children + the strategy carry
    // every value). The picked `ComputationKind` flows through as
    // the canonical singleton (`ComputationKind.fromName` resolved
    // it in `buildComputedPayload`, so reference equality with the
    // `static readonly` slots holds end-to-end).
    return {
      kind: "Computed",
      title: payload.title,
      description: payload.description,
      weight: payload.weight,
      computationKind: payload.computationKind,
    };
  }
  if (payload.kind === "ComputedBusinessScoreNode") {
    // SPEC §17.94 / §17.95 — modal-side "ComputedBusinessScoreNode"
    // rewrites to the application-layer "ComputedBusinessScore"
    // kind tag. Rewrites the modal's objective shape
    // (`{ targetValue, targetDate }`) to the application's
    // (`{ value, at }`); no seed history (the strategy + children
    // produce the value).
    return {
      kind: "ComputedBusinessScore",
      title: payload.title,
      description: payload.description,
      weight: payload.weight,
      unit: payload.unit,
      objective: {
        value: payload.objective.targetValue,
        at: payload.objective.targetDate,
      },
      computationKind: payload.computationKind,
    };
  }
  const objective = {
    value: payload.objective.targetValue,
    at: payload.objective.targetDate,
  };
  const seededHistory = payload.initialHistory ?? [
    { value: payload.objective.initialValue, asOf: new Date(clock.now().moment) },
  ];
  return {
    kind: "BusinessScore",
    title: payload.title,
    description: payload.description,
    weight: payload.weight,
    unit: payload.unit,
    objective,
    initialHistory: seededHistory,
  };
}

/**
 * SPEC §17.110 — `EditNodeModal` still emits the v3-shaped
 * `EditNodeModalPayload`. Map to the application's
 * `EditNodePayload`: rename `BusinessScoreCardNode` kind to
 * `BusinessScore`; drop the v3 `initialValue` field (v4 makes
 * history canonical and edits never re-seed initial history);
 * rewrite the objective shape; ignore v3-only `computed` /
 * `eligibleForParentComputation` flags on the edit path (kind
 * morphing isn't allowed by the application service — the §17.99c
 * migration already pinned the kind at load).
 */
function toAppEditPayload(payload: EditNodeModalPayload): EditNodePayload {
  if (payload.kind === "TextNode") {
    return { kind: "TextNode", title: payload.title, weight: payload.weight };
  }
  if (payload.kind === "PictureNode") {
    // SPEC §17.119 — modal-side "PictureNode" → application
    // "Picture" kind tag, identical pattern to the add-child path.
    // Title is intentionally forwarded from the payload even
    // though the modal never sets it (the inline title editor
    // is the canonical entry point); leaving the field on the
    // wire shape keeps a future "edit title in the modal"
    // strand non-breaking.
    return {
      kind: "Picture",
      title: payload.title,
      weight: payload.weight,
      imageUrl: payload.imageUrl,
    };
  }
  // SPEC §17.118 — Workflow mirrors TextNode edits and adds an optional
  // `statusId` swap. The service treats `undefined` as "no change"; an
  // explicit string replaces the badge atomically with the title/weight
  // edits so undo restores the prior status alongside everything else.
  if (payload.kind === "Workflow") {
    return {
      kind: "Workflow",
      title: payload.title,
      weight: payload.weight,
      statusId: payload.statusId,
    };
  }
  if (payload.kind === "URLNode") {
    // SPEC §17.120 — modal-side "URLNode" → application "URL"
    // kind tag. Parity with the §17.119 PictureNode rewrite —
    // same title-forwarding rationale (the inline editor is
    // canonical; leaving the field on the wire shape keeps a
    // future "edit title in the modal" strand non-breaking).
    return {
      kind: "URL",
      title: payload.title,
      weight: payload.weight,
      url: payload.url,
    };
  }
  if (payload.kind === "StrictRangeNode") {
    // SPEC §17.77 / §17.94 — modal-side "StrictRangeNode" → app
    // "StrictRange" kind tag (parity with the add-child rewrite).
    // Only `CommonEdit` fields flow through (title / weight /
    // description); range bounds are structural and not editable
    // from this modal, so no min/max here. Title-forwarding
    // rationale identical to Picture / URL above.
    return {
      kind: "StrictRange",
      title: payload.title,
      description: payload.description,
      weight: payload.weight,
    };
  }
  if (payload.kind === "ComputedNode") {
    // SPEC §17.94 / §17.95 — modal-side "ComputedNode" → app
    // "Computed" kind tag (parity with the add-child rewrite).
    // The dropdown emits the canonical `ComputationKind.name`;
    // resolve back to the singleton through `ComputationKind.from
    // Name` so reference equality with the `static readonly` slots
    // holds end-to-end. An unknown name (post-enum-shrink) drops
    // to `undefined` and the service treats it as "no change".
    const computationKind = payload.computationKindName
      ? (ComputationKind.fromName(payload.computationKindName) ?? undefined)
      : undefined;
    return {
      kind: "Computed",
      title: payload.title,
      description: payload.description,
      weight: payload.weight,
      computationKind,
    };
  }
  if (payload.kind === "ComputedBusinessScoreNode") {
    // SPEC §17.94 / §17.95 — modal-side "ComputedBusinessScoreNode"
    // → app "ComputedBusinessScore" kind tag. Combines the BSC
    // objective rewrite (`{ value, at }` shape) with the Computed
    // strategy resolution (same fromName lookup as plain Computed).
    const computationKind = payload.computationKindName
      ? (ComputationKind.fromName(payload.computationKindName) ?? undefined)
      : undefined;
    return {
      kind: "ComputedBusinessScore",
      title: payload.title,
      description: payload.description,
      weight: payload.weight,
      unit: payload.unit,
      objective: payload.objective
        ? { value: payload.objective.targetValue, at: payload.objective.targetDate }
        : undefined,
      computationKind,
    };
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
