import type { Tree } from "../domain/Tree.js";

import type {
  BoardV4,
  BoardCollectionRepositoryV4,
  BoardCollectionSnapshotV4,
} from "./ports/BoardCollectionRepositoryV4.js";
import type { IdGenerator } from "./ports/IdGenerator.js";

type Outcome<T = void> = T extends void
  ? { readonly ok: true } | { readonly ok: false; readonly reason: string }
  : { readonly ok: true; readonly board: BoardV4 } | { readonly ok: false; readonly reason: string };

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
export class BoardCollectionServiceV4 {
  private boards: BoardV4[];
  private currentBoardId: string;

  private constructor(
    private readonly repo: BoardCollectionRepositoryV4,
    private readonly idGen: IdGenerator,
    boards: readonly BoardV4[],
    currentBoardId: string,
  ) {
    this.boards = [...boards];
    this.currentBoardId = currentBoardId;
  }

  static async create(
    repo: BoardCollectionRepositoryV4,
    idGen: IdGenerator,
  ): Promise<BoardCollectionServiceV4> {
    const snapshot = await repo.load();
    return new BoardCollectionServiceV4(repo, idGen, snapshot.boards, snapshot.currentBoardId);
  }

  list(): readonly BoardV4[] { return [...this.boards]; }
  getCurrentBoardId(): string { return this.currentBoardId; }

  getCurrentBoard(): BoardV4 {
    const found = this.boards.find((b) => b.id === this.currentBoardId);
    if (!found) throw new Error(`BoardCollectionServiceV4 invariant violated: currentBoardId='${this.currentBoardId}' has no matching board.`);
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
    const existing = this.boards[idx];
    this.boards[idx] = { id: existing.id, name: trimmed, tree: existing.tree };
    await this.persist();
    return { ok: true };
  }

  async createBoard(name: string, tree: Tree): Promise<Outcome<BoardV4>> {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { ok: false, reason: "Board name cannot be empty." };
    const board: BoardV4 = { id: this.idGen(), name: trimmed, tree };
    this.boards.push(board);
    this.currentBoardId = board.id;
    await this.persist();
    return { ok: true, board };
  }

  /** SPEC §17.31 (v4) — patch a board's mutable settings (name only post-§17.42). */
  async updateSettings(boardId: string, settings: { readonly name?: string }): Promise<Outcome> {
    const idx = this.boards.findIndex((b) => b.id === boardId);
    if (idx === -1) return { ok: false, reason: "Board not found." };
    const existing = this.boards[idx];
    let nextName = existing.name;
    if (settings.name !== undefined) {
      const trimmed = settings.name.trim();
      if (trimmed.length === 0) return { ok: false, reason: "Board name cannot be empty." };
      nextName = trimmed;
    }
    this.boards[idx] = { id: existing.id, name: nextName, tree: existing.tree };
    await this.persist();
    return { ok: true };
  }

  /** SPEC §17.33 (v4) — atomically swap the current board's tree (used by Import). */
  async replaceCurrentTree(tree: Tree): Promise<void> {
    const idx = this.boards.findIndex((b) => b.id === this.currentBoardId);
    if (idx === -1) throw new Error(`BoardCollectionServiceV4 invariant violated: currentBoardId='${this.currentBoardId}' has no matching board.`);
    const existing = this.boards[idx];
    this.boards[idx] = { id: existing.id, name: existing.name, tree };
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
    const snapshot: BoardCollectionSnapshotV4 = {
      boards: [...this.boards],
      currentBoardId: this.currentBoardId,
    };
    await this.repo.save(snapshot);
  }
}
