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
      ...(existing.freshDateColor !== undefined
        ? { freshDateColor: existing.freshDateColor }
        : {}),
    };
    await this.persist();
    return { ok: true };
  }

  async createBoard(
    name: string,
    tree: TreeNode<unknown>,
    freshDateColor?: string,
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
      ...(freshDateColor !== undefined ? { freshDateColor } : {}),
    };
    this.boards.push(board);
    this.currentBoardId = id;
    await this.persist();
    return { ok: true, board };
  }

  private async persist(): Promise<void> {
    const snapshot: BoardCollectionSnapshot = {
      boards: [...this.boards],
      currentBoardId: this.currentBoardId,
    };
    await this.repo.save(snapshot);
  }
}
