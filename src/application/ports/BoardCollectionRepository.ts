import type { Tree } from "../../domain/Tree.js";

/**
 * v4 successor to `Board` (SPEC §17.102). Pairs the user-visible board
 * name with the §17.79 `Tree` container holding the v4 root + the
 * §17.100.5 cards sidecar. The application service treats `tree` as
 * opaque — mutations happen through v4 domain methods (`AddChildService`
 * / `EditNodeService` / `Tree.findById` / `Node.attach` / `Node.detach`)
 * and the whole snapshot re-persists through the repository.
 *
 * Parallel-additive to the v3 `Board` (§17.31) — v3 stays live in
 * `main.ts` until §17.110 Phase E cutover.
 */
export type Board = {
  readonly id: string;
  readonly name: string;
  readonly tree: Tree;
};

/**
 * v4 successor to `BoardCollectionSnapshot`. Same shape, different
 * `tree` type. Invariant: `boards.length >= 1` and `currentBoardId`
 * matches some `boards[i].id` — adapters seed a default board on
 * first run.
 */
export type BoardCollectionSnapshot = {
  readonly boards: readonly Board[];
  readonly currentBoardId: string;
};

/**
 * v4 successor to `BoardCollectionRepository`. Same shape, different
 * snapshot type. Adapter implementations choose the storage medium;
 * the v4 LocalStorage adapter lands at §17.107 after the codec
 * migration (§17.105 / §17.106).
 */
export interface BoardCollectionRepository {
  load(): Promise<BoardCollectionSnapshot>;
  save(snapshot: BoardCollectionSnapshot): Promise<void>;
}
