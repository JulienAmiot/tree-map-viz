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
 *   "appMajor": 0,
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
 *
 * §17.86 — Runtime version-mismatch handling. The envelope gains an
 * `appMajor: number` field at write time; `load()` classifies the
 * persisted major against the running major into 4 branches (equal /
 * lower / higher / legacy) — see {@link classifyAndMaybeMigrate}.
 */

import type {
  Board,
  BoardCollectionRepository,
  BoardCollectionSnapshot,
} from "../../application/ports/BoardCollectionRepository.js";
import type { TreeNode } from "../../domain/nodes/TreeNode.js";
import { APP_MAJOR } from "../../version.js";
import { buildShowcaseBoard } from "../showcaseSeed.js";

import { decode, encode } from "./jsonCodec.js";

/** Default storage key. Versioned (`v1`) so future migrations can rename without collisions. */
export const STORAGE_KEY = "tree-map-viz/board-collection/v1";

/**
 * Legacy storage key — pre-§17.63 builds wrote the board collection here
 * (project was named `tree-graph-viz`; renamed to `tree-map-viz` in §17.63).
 * Retained as a read-side migration hook in {@link LocalStorageBoardCollectionRepository.load};
 * never written to. See SPEC §17.4 / §17.63.
 */
export const LEGACY_STORAGE_KEY = "tree-graph-viz/board-collection/v1";

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
type WireEnvelope = {
  v: number;
  /** §17.86 — optional so pre-§17.86 envelopes (no field) load via the legacy branch. */
  appMajor?: number;
  currentBoardId: string;
  boards: WireBoard[];
};

/** §17.86 — surfaced to the composition root on a major mismatch (see SPEC §17.86). */
export type VersionMismatchInfo =
  | { kind: "migration-failed"; persistedMajor: number; runningMajor: number }
  | { kind: "future-data"; persistedMajor: number; runningMajor: number };

/** §17.86 — `undefined` means "this migrator doesn't handle the jump"; chain falls through. */
export type EnvelopeMigrator = (
  envelope: WireEnvelope,
  from: number,
  to: number,
) => WireEnvelope | undefined;

export type LocalStorageBoardCollectionRepositoryOptions = {
  storage: Storage;
  key?: string;
  seed?: () => BoardCollectionSnapshot;
  /** §17.86 — running app's MAJOR; defaults to {@link APP_MAJOR}. */
  appMajor?: number;
  /** §17.86 — invoked on a major mismatch (callback is the §17.86b banner seam). */
  onVersionMismatch?: (info: VersionMismatchInfo) => void;
  /** §17.86 — chain tried on a lower persisted major; empty until Phase E codec migration. */
  migrators?: readonly EnvelopeMigrator[];
  /** §17.86b -- when `true`, `save()` is a no-op. Composition root flips a closure flag the banner toggles. */
  isReadOnly?: () => boolean;
};

export class LocalStorageBoardCollectionRepository implements BoardCollectionRepository {
  private readonly storage: Storage;
  private readonly key: string;
  private readonly buildSeed: () => BoardCollectionSnapshot;
  private readonly appMajor: number;
  private readonly onVersionMismatch: (info: VersionMismatchInfo) => void;
  private readonly migrators: readonly EnvelopeMigrator[];
  private readonly isReadOnly: () => boolean;

  constructor(opts: LocalStorageBoardCollectionRepositoryOptions) {
    this.storage = opts.storage;
    this.key = opts.key ?? STORAGE_KEY;
    this.buildSeed = opts.seed ?? defaultSeed;
    this.appMajor = opts.appMajor ?? APP_MAJOR;
    this.onVersionMismatch = opts.onVersionMismatch ?? noop;
    this.migrators = opts.migrators ?? [];
    this.isReadOnly = opts.isReadOnly ?? alwaysFalse;
  }

  async load(): Promise<BoardCollectionSnapshot> {
    this.migrateLegacyKeyIfNeeded();
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      const seeded = this.buildSeed();
      this.storage.setItem(this.key, this.serialize(seeded));
      return seeded;
    }
    const envelope = JSON.parse(raw) as WireEnvelope;
    const compatible = this.classifyAndMaybeMigrate(envelope);
    if (compatible === null) {
      // §17.86 future-data: seed + persist the seed (overwrites the
      // future payload). §17.86b banner offers the operator a recovery.
      const seeded = this.buildSeed();
      this.storage.setItem(this.key, this.serialize(seeded));
      return seeded;
    }
    return this.envelopeToSnapshot(compatible);
  }

  /** §17.86 — returns envelope to decode (possibly migrated), or null on future-data refusal. */
  private classifyAndMaybeMigrate(envelope: WireEnvelope): WireEnvelope | null {
    const persistedMajor = envelope.appMajor;
    if (typeof persistedMajor !== "number") return envelope; // legacy: silent (§17.42 pattern)
    if (persistedMajor === this.appMajor) return envelope;
    if (persistedMajor < this.appMajor) {
      for (const migrate of this.migrators) {
        const migrated = migrate(envelope, persistedMajor, this.appMajor);
        if (migrated !== undefined) return migrated;
      }
      this.onVersionMismatch({ kind: "migration-failed", persistedMajor, runningMajor: this.appMajor });
      return envelope;
    }
    this.onVersionMismatch({ kind: "future-data", persistedMajor, runningMajor: this.appMajor });
    return null;
  }

  /**
   * SPEC §17.63 — silent project-rename migration. The §17.4 storage-key
   * prefix flipped from `tree-graph-viz/...` to `tree-map-viz/...` at the
   * project level (npm package + Sonar key + repo all renamed alongside it).
   * Operators upgrading from a pre-§17.63 build still have their boards
   * under the {@link LEGACY_STORAGE_KEY}; on first load AFTER the upgrade
   * we copy the legacy payload byte-for-byte into the new key and delete
   * the legacy entry. No UI surface, no operator interaction — the rename
   * is invisible to the kiosk. The envelope version stays at `v1`: only
   * the key prefix changed, not the wire shape, so a copy-and-delete is
   * the minimum-risk migration (no decode → re-encode round-trip that
   * could surface a subtle wire-shape bug at the worst possible moment).
   *
   * Guards:
   *   - only fires when the consumer is using the default {@link STORAGE_KEY}
   *     (a custom-key caller has its own storage discipline and migration
   *     policy; we don't reach across it);
   *   - never overwrites an existing new-key payload (idempotent across
   *     repeat boots — a legacy leftover that survived a previous run
   *     because of a crash mid-migration is silently ignored once the
   *     new key is populated; the operator's already-saved post-rename
   *     boards win).
   */
  private migrateLegacyKeyIfNeeded(): void {
    if (this.key !== STORAGE_KEY) {
      return;
    }
    if (this.storage.getItem(this.key) !== null) {
      return;
    }
    const legacy = this.storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === null) {
      return;
    }
    this.storage.setItem(this.key, legacy);
    this.storage.removeItem(LEGACY_STORAGE_KEY);
  }

  async save(snapshot: BoardCollectionSnapshot): Promise<void> {
    if (this.isReadOnly()) return; // §17.86b read-only mode

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
      appMajor: this.appMajor,
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

  private envelopeToSnapshot(parsed: WireEnvelope): BoardCollectionSnapshot {
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

/** §17.86 — default `onVersionMismatch`; composition root replaces with banner-surface callback. */
function noop(): void {}

/** §17.86b — default `isReadOnly`; composition root replaces with a closure flag the banner flips. */
function alwaysFalse(): boolean { return false; }

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
