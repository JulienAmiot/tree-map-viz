import type { TreeNode } from "../../domain/nodes/TreeNode.js";

/**
 * A board pairs a user-visible name with the tree it shows.
 *
 * Application-layer value type — `tree` is a live aggregate root, so callers
 * mutate it through domain methods (`attach`, `detach`, ...) and re-persist
 * the whole snapshot via the repository.
 */
export type Board = {
  readonly id: string;
  readonly name: string;
  readonly tree: TreeNode<unknown>;
};

/**
 * Full persisted state of the board collection.
 *
 * A snapshot is always non-empty: `boards.length >= 1` and `currentBoardId`
 * matches some `boards[i].id`. Repository implementations seed a default
 * board on first run so the service never sees an empty snapshot.
 */
export type BoardCollectionSnapshot = {
  readonly boards: readonly Board[];
  readonly currentBoardId: string;
};

/**
 * Application port: persistence of the whole board collection.
 *
 * The service treats `load`/`save` as opaque async I/O. Adapter
 * implementations choose the storage medium (LocalStorage today,
 * IndexedDB / remote API later). A contract test (Phase 4) is shared
 * across implementations.
 */
export interface BoardCollectionRepository {
  /**
   * Returns the persisted snapshot. Adapters that find no stored data MUST
   * seed a default board and return a non-empty snapshot.
   */
  load(): Promise<BoardCollectionSnapshot>;

  /**
   * Persists the entire snapshot atomically (one storage write per call).
   *
   * Adapters surface storage faults as typed errors (e.g. `StorageFullError`
   * from the LocalStorage adapter when quota is exceeded).
   */
  save(snapshot: BoardCollectionSnapshot): Promise<void>;
}
