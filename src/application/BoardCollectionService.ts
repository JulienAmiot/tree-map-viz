import type { Tree } from "../domain/Tree.js";
import {
  DEFAULT_WORKFLOW_STATUSES,
  type WorkflowStatus,
} from "../domain/values/WorkflowStatus.js";

import type {
  Board,
  BoardCollectionRepository,
  BoardCollectionSnapshot,
} from "./ports/BoardCollectionRepository.js";
import type { IdGenerator } from "./ports/IdGenerator.js";

type Outcome<T = void> = T extends void
  ? { readonly ok: true } | { readonly ok: false; readonly reason: string }
  : { readonly ok: true; readonly board: Board } | { readonly ok: false; readonly reason: string };

/**
 * v4 successor to `BoardCollectionService` (SPEC §17.102). Same
 * behaviour, different `tree` type: stores §17.79 `Tree` containers
 * instead of v3 `TreeNode<unknown>` aggregates. The service treats
 * trees as opaque — no read of the v4 node graph, just identity +
 * mutation + persistence orchestration.
 *
 * Parallel-additive to v3 `BoardCollectionService` per §17.94 Phase C
 * — v3 stays live in `main.ts` until §17.110 Phase E cutover.
 */
export class BoardCollectionService {
  private boards: Board[];
  private currentBoardId: string;

  private constructor(
    private readonly repo: BoardCollectionRepository,
    private readonly idGen: IdGenerator,
    boards: readonly Board[],
    currentBoardId: string,
  ) {
    this.boards = [...boards];
    this.currentBoardId = currentBoardId;
  }

  static async create(
    repo: BoardCollectionRepository,
    idGen: IdGenerator,
  ): Promise<BoardCollectionService> {
    const snapshot = await repo.load();
    return new BoardCollectionService(repo, idGen, snapshot.boards, snapshot.currentBoardId);
  }

  list(): readonly Board[] { return [...this.boards]; }
  getCurrentBoardId(): string { return this.currentBoardId; }

  getCurrentBoard(): Board {
    const found = this.boards.find((b) => b.id === this.currentBoardId);
    if (!found) throw new Error(`BoardCollectionService invariant violated: currentBoardId='${this.currentBoardId}' has no matching board.`);
    return found;
  }

  async switchTo(boardId: string): Promise<Outcome> {
    if (!this.boards.some((b) => b.id === boardId)) return { ok: false, reason: "Board not found." };
    if (boardId === this.currentBoardId) return { ok: true };
    this.currentBoardId = boardId;
    await this.persist();
    return { ok: true };
  }

  async rename(boardId: string, newName: string): Promise<Outcome> {
    const trimmed = newName.trim();
    if (trimmed.length === 0) return { ok: false, reason: "Board name cannot be empty." };
    const idx = this.boards.findIndex((b) => b.id === boardId);
    if (idx === -1) return { ok: false, reason: "Board not found." };
    this.boards[idx] = withBoard(this.boards[idx], { name: trimmed });
    await this.persist();
    return { ok: true };
  }

  async createBoard(
    name: string,
    tree: Tree,
    options: { readonly workflowStatuses?: readonly WorkflowStatus[] } = {},
  ): Promise<Outcome<Board>> {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { ok: false, reason: "Board name cannot be empty." };
    const board: Board = {
      id: this.idGen(),
      name: trimmed,
      tree,
      // §17.117 — every new board seeds the PDCA defaults unless the
      // caller passes a bespoke status table (no current call site
      // does; the future board-settings strand will).
      workflowStatuses: options.workflowStatuses ?? DEFAULT_WORKFLOW_STATUSES,
    };
    this.boards.push(board);
    this.currentBoardId = board.id;
    await this.persist();
    return { ok: true, board };
  }

  /**
   * SPEC §17.31 (v4) — patch a board's mutable settings.
   * §17.117 — `workflowStatuses` joins the patch surface so a future
   * board-settings strand can swap the lookup table for an existing
   * board without rebuilding the board object on the call-site side.
   * Today no UI exposes the field; the typed surface is in place so
   * the settings strand only has to wire the modal.
   */
  async updateSettings(
    boardId: string,
    settings: {
      readonly name?: string;
      readonly workflowStatuses?: readonly WorkflowStatus[];
    },
  ): Promise<Outcome> {
    const idx = this.boards.findIndex((b) => b.id === boardId);
    if (idx === -1) return { ok: false, reason: "Board not found." };
    let nextName = this.boards[idx].name;
    if (settings.name !== undefined) {
      const trimmed = settings.name.trim();
      if (trimmed.length === 0) return { ok: false, reason: "Board name cannot be empty." };
      nextName = trimmed;
    }
    this.boards[idx] = withBoard(this.boards[idx], {
      name: nextName,
      workflowStatuses: settings.workflowStatuses,
    });
    await this.persist();
    return { ok: true };
  }

  /** SPEC §17.33 (v4) — atomically swap the current board's tree (used by Import). */
  async replaceCurrentTree(tree: Tree): Promise<void> {
    const idx = this.boards.findIndex((b) => b.id === this.currentBoardId);
    if (idx === -1) throw new Error(`BoardCollectionService invariant violated: currentBoardId='${this.currentBoardId}' has no matching board.`);
    this.boards[idx] = withBoard(this.boards[idx], { tree });
    await this.persist();
  }

  /** SPEC §17.31 (v4) — remove a board (refuses on the last remaining one). */
  async deleteBoard(boardId: string): Promise<Outcome> {
    const idx = this.boards.findIndex((b) => b.id === boardId);
    if (idx === -1) return { ok: false, reason: "Board not found." };
    if (this.boards.length <= 1) return { ok: false, reason: "Cannot delete the last remaining board." };
    const wasCurrent = boardId === this.currentBoardId;
    this.boards.splice(idx, 1);
    if (wasCurrent) this.currentBoardId = this.boards[0].id;
    await this.persist();
    return { ok: true };
  }

  private async persist(): Promise<void> {
    const snapshot: BoardCollectionSnapshot = {
      boards: [...this.boards],
      currentBoardId: this.currentBoardId,
    };
    await this.repo.save(snapshot);
  }
}

/**
 * Helper that rebuilds a `Board` immutably while preserving every
 * field the caller did NOT explicitly patch. Lives at the bottom of
 * the service module rather than getting inlined four times so the
 * §17.117 addition of `workflowStatuses` does not require touching
 * every Board literal whenever the Board shape grows another field;
 * each call site only mentions the field(s) it actually changes.
 */
function withBoard(
  existing: Board,
  patch: {
    readonly name?: string;
    readonly tree?: Tree;
    readonly workflowStatuses?: readonly WorkflowStatus[];
  },
): Board {
  return {
    id: existing.id,
    name: patch.name ?? existing.name,
    tree: patch.tree ?? existing.tree,
    workflowStatuses: patch.workflowStatuses ?? existing.workflowStatuses,
  };
}
