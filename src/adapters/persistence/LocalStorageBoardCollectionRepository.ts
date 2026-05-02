/**
 * `BoardCollectionRepository` adapter backed by `Storage` (typically the
 * browser's `localStorage`). Per SPEC §11 line 334:
 *
 *  - `load()` empty → seed (returns a non-empty snapshot, also persists it
 *    so subsequent loads are stable).
 *  - `save()` writes to a single key.
 *  - Storage quota faults are translated to a typed `StorageFullError`.
 *
 * The wire envelope:
 * ```json
 * {
 *   "v": 1,
 *   "currentBoardId": "...",
 *   "boards": [
 *     { "id": "...", "name": "...", "tree": <jsonCodec wire shape> }
 *   ]
 * }
 * ```
 *
 * Each board's `tree` re-uses the per-tree wire format produced by
 * `src/adapters/persistence/jsonCodec.ts`. The double parse/stringify across
 * the codec boundary is intentional: it keeps the codec's contract
 * (string ↔ tree) untouched while letting this adapter store the whole
 * collection as a single JSON document.
 */

import type {
  Board,
  BoardCollectionRepository,
  BoardCollectionSnapshot,
} from "../../application/ports/BoardCollectionRepository.js";
import type { TreeNode } from "../../domain/nodes/TreeNode.js";
import { buildShowcaseBoard } from "../showcaseSeed.js";

import { decode, encode } from "./jsonCodec.js";

/** Default storage key. Versioned (`v1`) so future migrations can rename without collisions. */
export const STORAGE_KEY = "tree-graph-viz/board-collection/v1";

const ENVELOPE_VERSION = 1;

/** Typed storage-quota error surfaced from `save()`; UI maps it to a user-friendly message. */
export class StorageFullError extends Error {
  constructor(cause?: unknown) {
    super("Local storage quota exceeded — cannot persist the board collection.");
    this.name = "StorageFullError";
    if (cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = cause;
    }
  }
}

type WireBoard = {
  id: string;
  name: string;
  tree: unknown;
  /**
   * SPEC §17.42 — `freshDateColor` was retired with the per-board
   * fresh-date-colour theming hint (§17.21 / §17.31). New writes never
   * emit the field; legacy reads tolerate and discard any leftover
   * value so the kiosk doesn't reject a perfectly good stored payload
   * just because the operator's previous build wrote one. Typed as
   * `unknown` so a hostile / corrupted value can't slip through.
   */
  freshDateColor?: unknown;
};
type WireEnvelope = { v: number; currentBoardId: string; boards: WireBoard[] };

export type LocalStorageBoardCollectionRepositoryOptions = {
  /** The Storage to read/write. Inject jsdom's `localStorage` in app code, in-memory fakes in tests. */
  storage: Storage;
  /** Storage key. Defaults to {@link STORAGE_KEY}. */
  key?: string;
  /** Factory used by `load()` when storage is empty. Defaults to a single empty TextNode root. */
  seed?: () => BoardCollectionSnapshot;
};

export class LocalStorageBoardCollectionRepository implements BoardCollectionRepository {
  private readonly storage: Storage;
  private readonly key: string;
  private readonly buildSeed: () => BoardCollectionSnapshot;

  constructor(opts: LocalStorageBoardCollectionRepositoryOptions) {
    this.storage = opts.storage;
    this.key = opts.key ?? STORAGE_KEY;
    this.buildSeed = opts.seed ?? defaultSeed;
  }

  async load(): Promise<BoardCollectionSnapshot> {
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      const seeded = this.buildSeed();
      this.storage.setItem(this.key, this.serialize(seeded));
      return seeded;
    }
    return this.deserialize(raw);
  }

  async save(snapshot: BoardCollectionSnapshot): Promise<void> {
    try {
      this.storage.setItem(this.key, this.serialize(snapshot));
    } catch (err) {
      if (LocalStorageBoardCollectionRepository.isQuotaExceeded(err)) {
        throw new StorageFullError(err);
      }
      throw err;
    }
  }

  private serialize(snapshot: BoardCollectionSnapshot): string {
    const envelope: WireEnvelope = {
      v: ENVELOPE_VERSION,
      currentBoardId: snapshot.currentBoardId,
      boards: snapshot.boards.map((b) => {
        const wire: WireBoard = {
          id: b.id,
          name: b.name,
          tree: JSON.parse(encode(b.tree)) as unknown,
        };
        return wire;
      }),
    };
    return JSON.stringify(envelope);
  }

  private deserialize(raw: string): BoardCollectionSnapshot {
    const parsed = JSON.parse(raw) as WireEnvelope;
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("LocalStorageBoardCollectionRepository: stored payload is not an object");
    }
    if (typeof parsed.currentBoardId !== "string" || !Array.isArray(parsed.boards)) {
      throw new Error("LocalStorageBoardCollectionRepository: stored payload is missing required fields");
    }
    const boards: Board[] = parsed.boards.map((b) => {
      // §17.42 — discard any legacy `freshDateColor` carried by older
      // payloads; the field is no longer part of the Board type.
      const board: Board = {
        id: b.id,
        name: b.name,
        tree: decode(JSON.stringify(b.tree)) as TreeNode<unknown>,
      };
      return board;
    });
    return { boards, currentBoardId: parsed.currentBoardId };
  }

  /**
   * Detect the various flavours of quota-exceeded errors browsers throw.
   * - WHATWG `DOMException` with `name === "QuotaExceededError"`
   * - Legacy WebKit code 22 (`QUOTA_EXCEEDED_ERR`)
   * - Firefox legacy `NS_ERROR_DOM_QUOTA_REACHED`
   * - Legacy IE-style code 1014
   */
  private static isQuotaExceeded(err: unknown): boolean {
    if (err === null || typeof err !== "object") {
      return false;
    }
    const e = err as { name?: string; code?: number };
    return (
      e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014
    );
  }
}

function defaultSeed(): BoardCollectionSnapshot {
  // SPEC §17.21 — first-boot kiosk lands on the showcase board, which
  // exercises every visible UI branch (TextNode + BSC, all three
  // computed-value branches, eligible/non-eligible mix, dates spanning
  // the timestamp age gradient). Pre-§17.21 callers that relied on the
  // empty single-TextNode "Default Board" should inject a custom
  // `seed` factory through the constructor options.
  const board = buildShowcaseBoard();
  return {
    boards: [board],
    currentBoardId: board.id,
  };
}
