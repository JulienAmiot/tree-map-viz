import type { TreeNode } from "../domain/nodes/TreeNode.js";

import type {
  Board,
  BoardCollectionRepository,
  BoardCollectionSnapshot,
} from "./ports/BoardCollectionRepository.js";
import type { IdGenerator } from "./ports/IdGenerator.js";

/**
 * Application service: manages the collection of boards (list / switch /
 * rename / create) and persists every mutation through a
 * `BoardCollectionRepository` port.
 *
 * Construction is async because the initial state is loaded from the port;
 * use the {@link BoardCollectionService.create} factory.
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

  list(): readonly Board[] {
    return [...this.boards];
  }

  getCurrentBoardId(): string {
    return this.currentBoardId;
  }

  getCurrentBoard(): Board {
    const found = this.boards.find((b) => b.id === this.currentBoardId);
    if (!found) {
      throw new Error(
        `BoardCollectionService invariant violated: currentBoardId='${this.currentBoardId}' has no matching board.`,
      );
    }
    return found;
  }

  async switchTo(boardId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (!this.boards.some((b) => b.id === boardId)) {
      return { ok: false, reason: "Board not found." };
    }
    if (boardId === this.currentBoardId) {
      return { ok: true };
    }
    this.currentBoardId = boardId;
    await this.persist();
    return { ok: true };
  }

  async rename(
    boardId: string,
    newName: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      return { ok: false, reason: "Board name cannot be empty." };
    }
    const idx = this.boards.findIndex((b) => b.id === boardId);
    if (idx === -1) {
      return { ok: false, reason: "Board not found." };
    }
    const existing = this.boards[idx]!;
    this.boards[idx] = {
      id: existing.id,
      name: trimmed,
      tree: existing.tree,
    };
    await this.persist();
    return { ok: true };
  }

  async createBoard(
    name: string,
    tree: TreeNode<unknown>,
  ): Promise<{ ok: true; board: Board } | { ok: false; reason: string }> {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { ok: false, reason: "Board name cannot be empty." };
    }
    const id = this.idGen();
    const board: Board = {
      id,
      name: trimmed,
      tree,
    };
    this.boards.push(board);
    this.currentBoardId = id;
    await this.persist();
    return { ok: true, board };
  }

  /**
   * SPEC §17.31 — patch a board's mutable settings. §17.42 retired
   * the per-board fresh-date colour, leaving `name` as the only
   * mutable field; the method still exists (rather than collapsing
   * into `rename`) so the modal's confirm event has a single
   * service-level entry point and we keep room to add future
   * board-level settings without churning callers again.
   *
   * Validation:
   *   - `name`, when supplied, is trimmed and must be non-empty (same
   *     rule as `rename` and `createBoard`).
   *   - The board must exist; the same `Board not found` reason as
   *     `rename` / `switchTo` is returned otherwise.
   */
  async updateSettings(
    boardId: string,
    settings: {
      readonly name?: string;
    },
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const idx = this.boards.findIndex((b) => b.id === boardId);
    if (idx === -1) {
      return { ok: false, reason: "Board not found." };
    }
    const existing = this.boards[idx]!;
    let nextName = existing.name;
    if (settings.name !== undefined) {
      const trimmed = settings.name.trim();
      if (trimmed.length === 0) {
        return { ok: false, reason: "Board name cannot be empty." };
      }
      nextName = trimmed;
    }
    this.boards[idx] = {
      id: existing.id,
      name: nextName,
      tree: existing.tree,
    };
    await this.persist();
    return { ok: true };
  }

  /**
   * SPEC §17.33 — atomically swap the current board's tree for a
   * different one. Used by the Import flow (`ImportExportService`'s
   * `replaceCurrentTree` callable) so a successful decode replaces
   * the current board's tree in one persistence round-trip; the
   * other boards in the collection are untouched (SPEC §13.2:
   * "Import behaviour: replace the **current board**; other boards
   * in the collection are untouched.").
   *
   * The new tree is taken at face value — no validation on shape,
   * id uniqueness, etc., because the codec already enforced that
   * before this method is reached.
   */
  async replaceCurrentTree(tree: TreeNode<unknown>): Promise<void> {
    const idx = this.boards.findIndex((b) => b.id === this.currentBoardId);
    if (idx === -1) {
      throw new Error(
        `BoardCollectionService invariant violated: currentBoardId='${this.currentBoardId}' has no matching board.`,
      );
    }
    const existing = this.boards[idx]!;
    this.boards[idx] = {
      id: existing.id,
      name: existing.name,
      tree,
    };
    await this.persist();
  }

  /**
   * SPEC §17.31 — remove a board from the collection. If the deleted
   * board was the current one, the first remaining board becomes
   * current; if the user deletes a non-current board the current id
   * stays put.
   *
   * Refuses when the board is the **only** one in the collection:
   * `getCurrentBoard` enforces an "at least one board exists"
   * invariant, and the showcase / default-seed flow assumes a board
   * is always available. The settings UI is expected to disable the
   * Delete button accordingly; the service-side guard is the
   * defence-in-depth contract.
   */
  async deleteBoard(
    boardId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const idx = this.boards.findIndex((b) => b.id === boardId);
    if (idx === -1) {
      return { ok: false, reason: "Board not found." };
    }
    if (this.boards.length <= 1) {
      return {
        ok: false,
        reason: "Cannot delete the last remaining board.",
      };
    }
    const wasCurrent = boardId === this.currentBoardId;
    this.boards.splice(idx, 1);
    if (wasCurrent) {
      this.currentBoardId = this.boards[0]!.id;
    }
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
