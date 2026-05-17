import type { Tree } from "../../domain/Tree.js";
import type { WorkflowStatus } from "../../domain/values/WorkflowStatus.js";

/**
 * v4 successor to `Board` (SPEC §17.102). Pairs the user-visible board
 * name with the §17.79 `Tree` container holding the v4 root + the
 * §17.100.5 cards sidecar. The application service treats `tree` as
 * opaque — mutations happen through v4 domain methods (`AddChildService`
 * / `EditNodeService` / `Tree.findById` / `Node.attach` / `Node.detach`)
 * and the whole snapshot re-persists through the repository.
 *
 * §17.117 — `workflowStatuses` joins the Board shape as the board-level
 * lookup table referenced by `WorkflowNode.statusId`. Every Board MUST
 * carry the field; the `DEFAULT_WORKFLOW_STATUSES` PDCA seed is the
 * default fill used by the showcase seed, the new-board factory, AND
 * the LSR's `v: 2 → v: 3` envelope migration. Status definitions live
 * on the Board (rather than inside the Tree) because they are a per-
 * board configuration surface — independent of the tree topology, and
 * about to grow a settings modal whose persisted state must NOT round-
 * trip through the §17.106 tree codec.
 *
 * Parallel-additive to the v3 `Board` (§17.31) — v3 stays live in
 * `main.ts` until §17.110 Phase E cutover.
 */
export type Board = {
  readonly id: string;
  readonly name: string;
  readonly tree: Tree;
  readonly workflowStatuses: readonly WorkflowStatus[];
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
